import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AIService } from './ai.service';

describe('AIService', () => {
  let service: AIService;

  function buildModule(provider: string) {
    return Test.createTestingModule({
      providers: [
        AIService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'AI_PROVIDER') return provider;
              if (key === 'AI_SERVICE_URL') return '';
              if (key === 'AI_SERVICE_INTERNAL_KEY') return '';
              return undefined;
            }),
            getOrThrow: jest.fn().mockImplementation((key: string) => {
              if (key === 'GEMINI_API_KEY') return 'fake-key';
              throw new Error(`Missing required env: ${key}`);
            }),
          },
        },
        { provide: HttpService, useValue: { post: jest.fn() } },
      ],
    }).compile();
  }

  describe('with unknown provider (mock mode)', () => {
    beforeEach(async () => {
      const module: TestingModule = await buildModule('mock');
      service = module.get<AIService>(AIService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('classify returns fallback result', async () => {
      const result = await service.classify('https://example.com/image.jpg');
      expect(result.confidence).toBe(0);
      expect(result.type).toBe('unknown');
    });

    it('removeBg returns the same URL', async () => {
      const url = 'https://example.com/image.jpg';
      const result = await service.removeBg(url);
      expect(result.processedUrl).toBe(url);
    });
  });

  describe('with gemini provider', () => {
    beforeEach(async () => {
      const module: TestingModule = await buildModule('gemini');
      service = module.get<AIService>(AIService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('classify returns fallback when Gemini fails (no real network)', async () => {
      // In unit tests there's no network — Gemini call fails, fallback kicks in
      const result = await service.classify('https://example.com/image.jpg');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('confidence');
    });

    it('removeBg returns same URL (passthrough)', async () => {
      const url = 'https://example.com/image.jpg';
      const result = await service.removeBg(url);
      expect(result.processedUrl).toBe(url);
    });
  });
});
