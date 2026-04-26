import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { R2Service } from './r2.service';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn().mockResolvedValue({}) })),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed-url.example.com'),
}));

describe('R2Service', () => {
  let service: R2Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        R2Service,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined),
            getOrThrow: jest.fn().mockImplementation((key: string) => {
              const values: Record<string, string> = {
                R2_ACCOUNT_ID: 'test-account',
                R2_ACCESS_KEY_ID: 'test-key',
                R2_SECRET_ACCESS_KEY: 'test-secret',
                R2_BUCKET_WARDROBE: 'wardrobe',
                R2_BUCKET_TRYON: 'tryon',
                R2_BUCKET_AVATARS: 'avatars',
              };
              return values[key] ?? 'test';
            }),
          },
        },
      ],
    }).compile();

    service = module.get<R2Service>(R2Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return bucket names', () => {
    expect(service.bucketWardrobe()).toBe('wardrobe');
    expect(service.bucketTryon()).toBe('tryon');
    expect(service.bucketAvatars()).toBe('avatars');
  });

  it('should return signed URL', async () => {
    const url = await service.getSignedReadUrl('wardrobe', 'test-key.jpg');
    expect(url).toBe('https://signed-url.example.com');
  });
});
