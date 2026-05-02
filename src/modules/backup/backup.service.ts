import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { spawn } from 'child_process';
import { R2Service } from '../storage/r2.service';

const BACKUP_PREFIX = 'backups/';
const MAX_BACKUPS = 8;

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly mongoUri: string;
  private readonly bucket: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly r2Service: R2Service,
  ) {
    this.mongoUri = this.configService.getOrThrow<string>('MONGODB_URI');
    this.bucket = this.configService.getOrThrow<string>('R2_BUCKET_WARDROBE');
  }

  @Cron('0 2 * * 0', { name: 'weekly-mongo-backup', timeZone: 'UTC' })
  async runWeeklyBackup(): Promise<void> {
    await this.backup();
  }

  async backup(): Promise<{ key: string; sizeMB: string; durationMs: number }> {
    const dateStr = new Date().toISOString().slice(0, 10);
    const key = `${BACKUP_PREFIX}stylo-ai-backup-${dateStr}.gz`;
    const t0 = Date.now();

    this.logger.log(JSON.stringify({ msg: 'Backup started', key }));

    const buffer = await this.runMongodump();
    const sizeMB = (buffer.byteLength / 1024 / 1024).toFixed(2);

    await this.r2Service.uploadStream(this.bucket, key, buffer, 'application/gzip');

    const durationMs = Date.now() - t0;
    this.logger.log(
      JSON.stringify({ msg: 'Backup uploaded', key, sizeMB, durationMs }),
    );

    await this.rotate();

    return { key, sizeMB, durationMs };
  }

  private runMongodump(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const args = [`--uri=${this.mongoUri}`, '--gzip', '--archive'];
      const chunks: Buffer[] = [];
      const proc = spawn('mongodump', args, { stdio: ['ignore', 'pipe', 'pipe'] });

      proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      proc.stderr.on('data', (chunk: Buffer) => {
        this.logger.debug(`mongodump: ${chunk.toString().trim()}`);
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`mongodump exited with code ${String(code)}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`mongodump spawn error: ${err.message}`));
      });
    });
  }

  private async rotate(): Promise<void> {
    const objects = await this.r2Service.listObjectMetas(this.bucket, BACKUP_PREFIX);
    const sorted = objects.sort(
      (a, b) => a.lastModified.getTime() - b.lastModified.getTime(),
    );

    const excess = sorted.slice(0, Math.max(0, sorted.length - MAX_BACKUPS));
    for (const obj of excess) {
      await this.r2Service.deleteObject(this.bucket, obj.key);
      this.logger.log(JSON.stringify({ msg: 'Backup rotated', deletedKey: obj.key }));
    }

    if (excess.length === 0) {
      this.logger.log(JSON.stringify({ msg: 'Rotation: no old backups to delete', total: sorted.length }));
    }
  }
}
