import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BackupService } from './backup.service';
import { AdminTokenGuard } from '../wardrobe/wardrobe-enrichment.controller';

@ApiTags('admin')
@Controller('admin/backup')
@UseGuards(AdminTokenGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post('run')
  @ApiOperation({ summary: 'Trigger a manual MongoDB backup to R2 (admin only)' })
  async runBackup(): Promise<{ key: string; sizeMB: string; durationMs: number }> {
    return this.backupService.backup();
  }
}
