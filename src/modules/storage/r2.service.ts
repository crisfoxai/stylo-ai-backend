import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private readonly client: S3Client;
  private readonly endpoint: string;
  private readonly publicUrl: string | undefined;
  private readonly mockMode: boolean;

  constructor(private readonly configService: ConfigService) {
    // Mock mode is ONLY activated by explicit STORAGE_MOCK=true flag
    this.mockMode = configService.get<string>('STORAGE_MOCK') === 'true';

    const accountId = configService.getOrThrow<string>('R2_ACCOUNT_ID');
    this.endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    // Optional public CDN URL (e.g. https://pub-XXX.r2.dev) — used as the returned URL for uploaded objects
    this.publicUrl = configService.get<string>('R2_PUBLIC_URL');

    if (this.mockMode) {
      this.logger.warn('R2Service running in MOCK mode (STORAGE_MOCK=true)');
      this.client = null as unknown as S3Client;
    } else {
      this.client = new S3Client({
        region: 'auto',
        endpoint: this.endpoint,
        credentials: {
          accessKeyId: configService.getOrThrow<string>('R2_ACCESS_KEY_ID'),
          secretAccessKey: configService.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
        },
      });
      this.logger.log(`R2Service initialized — public URL: ${this.publicUrl ?? this.endpoint}`);
    }
  }

  async uploadStream(
    bucket: string,
    key: string,
    stream: Readable | Buffer,
    contentType: string,
  ): Promise<string> {
    if (this.mockMode) {
      return `https://mock-storage/${bucket}/${key}`;
    }

    const body = Buffer.isBuffer(stream) ? stream : stream;
    const contentLength = Buffer.isBuffer(stream) ? stream.byteLength : undefined;

    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ...(contentLength !== undefined ? { ContentLength: contentLength } : {}),
      }),
    );

    // Use public CDN URL if configured (R2 public bucket), otherwise use S3 endpoint URL
    return this.publicUrl
      ? `${this.publicUrl}/${key}`
      : `${this.endpoint}/${bucket}/${key}`;
  }

  async getSignedReadUrl(bucket: string, key: string, ttlSeconds = 3600): Promise<string> {
    if (this.mockMode) return `https://mock-storage/${bucket}/${key}`;
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: ttlSeconds },
    );
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    if (this.mockMode) return;
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  bucketWardrobe(): string {
    return this.configService.getOrThrow<string>('R2_BUCKET_WARDROBE');
  }

  bucketTryon(): string {
    return this.configService.getOrThrow<string>('R2_BUCKET_TRYON');
  }

  bucketAvatars(): string {
    return this.configService.getOrThrow<string>('R2_BUCKET_AVATARS');
  }
}
