import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { BadGatewayException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AIService } from './ai.service';
import { AxiosResponse } from 'axios';

describe('AIService', () => {
  let service: AIService;
  let mockHttpService: { post: jest.Mock };

  beforeEach(async () => {
    mockHttpService = { post: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockImplementation((key: string) => {
              if (key === 'AI_SERVICE_URL') return 'http://localhost:8000';
              return 'test-key';
            }),
          },
        },
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    service = module.get<AIService>(AIService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('classify', () => {
    it('should return classification result', async () => {
      const mockResult = { type: 'top', color: 'red', category: 'top', material: 'cotton', confidence: 0.9 };
      mockHttpService.post.mockReturnValue(of({ data: mockResult } as AxiosResponse));

      const result = await service.classify('https://example.com/image.jpg');
      expect(result).toEqual(mockResult);
    });

    it('should throw BadGatewayException after max retries', async () => {
      mockHttpService.post.mockReturnValue(throwError(() => new Error('Connection refused')));

      await expect(service.classify('https://example.com/image.jpg')).rejects.toThrow(
        BadGatewayException,
      );
      expect(mockHttpService.post).toHaveBeenCalledTimes(4); // initial + 3 retries
    }, 10000);
  });
});
