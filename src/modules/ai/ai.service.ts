import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { GoogleGenerativeAI } from '@google/generative-ai';
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

// Fallback classification when AI fails — keeps the pipeline moving
const FALLBACK_CLASSIFY: ClassifyResult = {
  type: 'unknown',
  color: 'unknown',
  category: 'unknown',
  material: 'unknown',
  confidence: 0,
};

// Public test image used for classification when imageUrl is a mock URL
const QA_TEST_IMAGE_URL =
  'https://images.pexels.com/photos/1152077/pexels-photo-1152077.jpeg?auto=compress&cs=tinysrgb&w=400';

const CLASSIFY_PROMPT =
  'Analyze this clothing item and respond with ONLY valid JSON, no markdown, no explanation: ' +
  '{"type": string, "category": string, "color": string, "material": string, "confidence": number}. ' +
  'type options: top/bottom/shoes/outerwear/accessory. ' +
  'category: shirt/pants/dress/jacket/sneakers/boots/bag/hat/etc. ' +
  'color: main color name in English. ' +
  'material: cotton/polyester/leather/denim/wool/silk/synthetic/etc. ' +
  'confidence: 0.0-1.0 float indicating classification confidence.';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly provider: string;
  private geminiClient?: GoogleGenerativeAI;

  // Legacy HTTP proxy fields (used when AI_PROVIDER=custom)
  private readonly baseUrl: string;
  private readonly internalKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.provider = configService.get<string>('AI_PROVIDER') ?? 'gemini';
    this.baseUrl = configService.get<string>('AI_SERVICE_URL') ?? '';
    this.internalKey = configService.get<string>('AI_SERVICE_INTERNAL_KEY') ?? '';

    if (this.provider === 'gemini') {
      const apiKey = configService.getOrThrow<string>('GEMINI_API_KEY');
      this.geminiClient = new GoogleGenerativeAI(apiKey);
      this.logger.log('AIService using Gemini Vision provider');
    } else {
      this.logger.warn(`AIService provider="${this.provider}" — falling back to mock`);
    }
  }

  async classify(imageUrl: string): Promise<ClassifyResult> {
    if (this.provider === 'gemini' && this.geminiClient) {
      return this.classifyWithGemini(imageUrl);
    }
    // mock / unknown provider
    return { ...FALLBACK_CLASSIFY };
  }

  async removeBg(imageUrl: string): Promise<RemoveBgResult> {
    // removeBg stays as passthrough until remove.bg integration
    return { processedUrl: imageUrl };
  }

  async tryon(userPhotoUrl: string, itemUrls: string[]): Promise<TryonResult> {
    if (this.provider === 'custom' && this.baseUrl) {
      return this.callWithRetry<TryonResult>('/tryon', { userPhotoUrl, itemUrls });
    }
    return { resultUrl: userPhotoUrl };
  }

  private async classifyWithGemini(imageUrl: string): Promise<ClassifyResult> {
    try {
      const effectiveUrl = imageUrl.startsWith('https://mock-storage/')
        ? QA_TEST_IMAGE_URL
        : imageUrl;

      const imageResponse = await fetch(effectiveUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const base64Image = imageBuffer.toString('base64');
      const mimeType =
        (imageResponse.headers.get('content-type') ?? 'image/jpeg').split(';')[0];

      const model = this.geminiClient!.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent([
        { inlineData: { data: base64Image, mimeType } },
        CLASSIFY_PROMPT,
      ]);

      const text = result.response.text().trim();
      // Strip markdown code fences if Gemini adds them
      const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(jsonText) as ClassifyResult;

      return {
        type: String(parsed.type ?? 'unknown'),
        category: String(parsed.category ?? 'unknown'),
        color: String(parsed.color ?? 'unknown'),
        material: String(parsed.material ?? 'unknown'),
        confidence: Number(parsed.confidence ?? 0.8),
      };
    } catch (err) {
      this.logger.error(`Gemini classify failed: ${(err as Error).message}`);
      return { ...FALLBACK_CLASSIFY };
    }
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
          throw error;
        }
      }
    }

    throw new Error('AI_UNAVAILABLE');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
