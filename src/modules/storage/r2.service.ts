import { Injectable } from '@nestjs/common';
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
  private readonly client: S3Client;
  private readonly endpoint: string;

  constructor(private readonly configService: ConfigService) {
    const accountId = configService.getOrThrow<string>('R2_ACCOUNT_ID');
    this.endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

    this.client = new S3Client({
      region: 'auto',
      endpoint: this.endpoint,
      credentials: {
        accessKeyId: configService.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: configService.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
      },
    });
  }

  async uploadStream(
    bucket: string,
    key: string,
    stream: Readable | Buffer,
    contentType: string,
  ): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: stream,
        ContentType: contentType,
      }),
    );
    return `${this.endpoint}/${bucket}/${key}`;
  }

  async getSignedReadUrl(bucket: string, key: string, ttlSeconds = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: ttlSeconds },
    );
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
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
