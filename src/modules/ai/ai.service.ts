import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

export interface ClassifyResult {
  type: string;
  color: string;
  category: string;
  material: string;
  confidence: number;
}

export interface RemoveBgResult {
  processedUrl: string;
}

export interface TryonResult {
  resultUrl: string;
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly baseUrl: string;
  private readonly internalKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.baseUrl = configService.getOrThrow<string>('AI_SERVICE_URL');
    this.internalKey = configService.getOrThrow<string>('AI_SERVICE_INTERNAL_KEY');
  }

  async classify(imageUrl: string): Promise<ClassifyResult> {
    return this.callWithRetry<ClassifyResult>('/classify', { imageUrl });
  }

  async removeBg(imageUrl: string): Promise<RemoveBgResult> {
    return this.callWithRetry<RemoveBgResult>('/remove-bg', { imageUrl });
  }

  async tryon(userPhotoUrl: string, itemUrls: string[]): Promise<TryonResult> {
    return this.callWithRetry<TryonResult>('/tryon', { userPhotoUrl, itemUrls });
  }

  private async callWithRetry<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const requestId = uuidv4();
    const delays = [200, 400, 800];

    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.post<T>(`${this.baseUrl}${path}`, body, {
            headers: {
              'X-Internal-Key': this.internalKey,
              'X-Request-Id': requestId,
            },
            timeout: 60000,
          }),
        );
        return response.data;
      } catch (error) {
        if (attempt < delays.length) {
          const jitter = Math.random() * 100;
          await this.sleep(delays[attempt] + jitter);
          this.logger.warn(`AI call to ${path} retrying (attempt ${attempt + 1})`);
        } else {
          this.logger.error(`AI call to ${path} failed after ${attempt + 1} attempts`);
          throw new BadGatewayException({ error: 'AI_UNAVAILABLE' });
        }
      }
    }

    throw new BadGatewayException({ error: 'AI_UNAVAILABLE' });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
