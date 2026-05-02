import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private readonly client: S3Client;
  private readonly endpoint: string;
  private readonly publicBaseUrl: string | undefined;
  private readonly mockMode: boolean;

  constructor(private readonly configService: ConfigService) {
    // Mock mode is ONLY activated by explicit STORAGE_MOCK=true flag
    this.mockMode = configService.get<string>('STORAGE_MOCK') === 'true';

    const accountId = configService.getOrThrow<string>('R2_ACCOUNT_ID');
    this.endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    // Optional public CDN URL (e.g. https://pub-XXX.r2.dev) — used as the returned URL for uploaded objects
    this.publicBaseUrl = configService.get<string>('R2_PUBLIC_BASE_URL');

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
      this.logger.log(`R2Service initialized — public URL: ${this.publicBaseUrl ?? this.endpoint}`);
    }
  }

  async uploadStream(
    bucket: string,
    key: string,
    stream: Readable | Buffer,
    contentType: string,
    metadata?: Record<string, string>,
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
        ...(metadata ? { Metadata: metadata } : {}),
      }),
    );

    // Use public CDN URL if configured (R2 public bucket), otherwise use S3 endpoint URL
    return this.publicBaseUrl
      ? `${this.publicBaseUrl}/${key}`
      : `${this.endpoint}/${bucket}/${key}`;
  }

  getPublicUrl(bucket: string, key: string): string {
    if (this.mockMode) return `https://mock-storage/${bucket}/${key}`;
    return this.publicBaseUrl
      ? `${this.publicBaseUrl}/${key}`
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

  async deleteByPrefix(bucket: string, prefix: string): Promise<void> {
    if (this.mockMode) return;
    let continuationToken: string | undefined;
    do {
      const listRes = await this.client.send(
        new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken }),
      );
      const objects = listRes.Contents ?? [];
      if (objects.length > 0) {
        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: objects.map((o) => ({ Key: o.Key! })), Quiet: true },
          }),
        );
        this.logger.log(`R2 deleteByPrefix: deleted ${objects.length} objects from ${bucket}/${prefix}`);
      }
      continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : undefined;
    } while (continuationToken);
  }

  async listObjectMetas(
    bucket: string,
    prefix: string,
  ): Promise<{ key: string; lastModified: Date; size: number }[]> {
    if (this.mockMode) return [];
    const results: { key: string; lastModified: Date; size: number }[] = [];
    let continuationToken: string | undefined;

    do {
      const res = await this.client.send(
        new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken }),
      );
      for (const obj of res.Contents ?? []) {
        if (obj.Key) {
          results.push({
            key: obj.Key,
            lastModified: obj.LastModified ?? new Date(0),
            size: obj.Size ?? 0,
          });
        }
      }
      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (continuationToken);

    return results;
  }

  async ping(): Promise<void> {
    if (this.mockMode) return;
    const bucket = this.configService.getOrThrow<string>('R2_BUCKET_WARDROBE');
    await this.client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
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
