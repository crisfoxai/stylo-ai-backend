import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import Replicate from 'replicate';
import Anthropic from '@anthropic-ai/sdk';
import { AiUsageService } from '../ai-usage/ai-usage.service';

export interface ClassifyResult {
  name: string;
  type: string;
  color: string;
  category: string;
  material: string;
  confidence: number;
  materials?: string[];
  style?: string;
  fit?: string;
  occasions?: string[];
  seasons?: string[];
}

export interface RemoveBgResult {
  processedUrl: string;
}

export interface TryonResult {
  resultUrl: string;
}

export interface DetectedGarment {
  tipo: string;
  color: string;
  descripcion: string;
  categoria: string;
  material: string | null;
  fit: string | null;
  materials: string[];
  style: string | null;
  occasions: string[];
  seasons: string[];
}

// Fallback classification when AI fails — keeps the pipeline moving
const FALLBACK_CLASSIFY: ClassifyResult = {
  name: '',
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
  '{"name": string, "type": string, "category": string, "color": string, "material": string, "confidence": number, ' +
  '"materials": string[], "style": string, "fit": string, "occasions": string[], "seasons": string[]}. ' +
  'name: descriptive name in Spanish, e.g. "Remera gris de algodón", "Pantalón negro de jean", "Zapatillas blancas". ' +
  'type options: top/bottom/shoes/outerwear/accessory. ' +
  'category: shirt/pants/dress/jacket/sneakers/boots/bag/hat/etc. ' +
  'color: main color name in English. ' +
  'material: cotton/polyester/leather/denim/wool/silk/synthetic/etc. ' +
  'confidence: 0.0-1.0 float indicating classification confidence. ' +
  'materials: array from [cotton, polyester, wool, silk, linen, denim, leather, synthetic, cashmere, velvet, spandex, fleece, nylon]. ' +
  'style: one of casual/formal/sport/elegant/smart-casual/beach/street/bohemian/minimalist/classic. ' +
  'fit: one of slim/regular/relaxed/oversized/skinny. ' +
  'occasions: array from [casual, everyday, work, business, sport, gym, night-out, party, dinner, date, formal, gala, beach, vacation]. ' +
  'seasons: array from [spring, summer, fall, winter].';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly provider: string;
  private geminiClient?: GoogleGenerativeAI;
  private replicateClient?: Replicate;
  private anthropicClient?: Anthropic;

  // Legacy HTTP proxy fields (used when AI_PROVIDER=custom)
  private readonly baseUrl: string;
  private readonly internalKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @Optional() private readonly aiUsageService?: AiUsageService,
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

    const replicateToken = configService.get<string>('REPLICATE_API_TOKEN');
    if (replicateToken) {
      this.replicateClient = new Replicate({ auth: replicateToken });
      this.logger.log('AIService: Replicate client initialized');
    }

    const anthropicKey = configService.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      this.anthropicClient = new Anthropic({ apiKey: anthropicKey });
      this.logger.log('AIService: Anthropic client initialized');
    }
  }

  async classify(imageUrl: string, userId?: string): Promise<ClassifyResult> {
    if (this.provider === 'gemini' && this.geminiClient) {
      return this.classifyWithGemini(imageUrl, userId);
    }
    return { ...FALLBACK_CLASSIFY };
  }

  async removeBg(imageUrl: string): Promise<RemoveBgResult> {
    // removeBg stays as passthrough until remove.bg integration
    return { processedUrl: imageUrl };
  }

  async tryon(
    userPhotoUrl: string,
    garmentUrls: string[],
    garmentDescription = 'garment',
    category = 'upper_body',
    userId?: string,
  ): Promise<TryonResult> {
    if (!this.replicateClient) {
      if (this.provider === 'custom' && this.baseUrl) {
        return this.callWithRetry<TryonResult>('/tryon', { userPhotoUrl, garmentUrls, category });
      }
      throw new Error('Replicate not configured — tryon unavailable');
    }

    const t0 = Date.now();
    const result = await this.runVtonWithRetry(userPhotoUrl, garmentUrls[0], garmentDescription, category);
    if (userId) {
      this.logUsage(userId, 'replicate', 'idm-vton', 'tryon', 0, 0, 0.05, Date.now() - t0);
    }
    return result;
  }

  private async runVtonWithRetry(
    humanImageUrl: string,
    garmentImageUrl: string,
    garmentDes: string,
    category: string,
  ): Promise<TryonResult> {
    try {
      return await this.runSingleVton(humanImageUrl, garmentImageUrl, garmentDes, category);
    } catch (err) {
      this.logger.warn(`[tryon] First attempt failed, retrying in 2s: ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, 2000));
      return await this.runSingleVton(humanImageUrl, garmentImageUrl, garmentDes, category);
    }
  }

  private async runSingleVton(
    humanImageUrl: string,
    garmentImageUrl: string,
    garmentDes: string,
    category: string,
  ): Promise<TryonResult> {
    const input = {
      human_img: humanImageUrl,
      garm_img: garmentImageUrl,
      garment_des: garmentDes,
      category,
      is_checked: true,
      is_checked_crop: true,
      auto_mask: true,
      auto_crop: false,
      denoise_steps: 30,
      seed: 42,
    };

    this.logger.log(`[tryon] Creating prediction. input=${JSON.stringify({ ...input, human_img: '(url)', garm_img: '(url)' })}`);

    const prediction = await this.replicateClient!.predictions.create({
      version: '0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985',
      input,
    });

    this.logger.log(`[tryon] Prediction created id=${prediction.id} status=${prediction.status}`);

    const resultUrl = await this.pollPrediction(prediction.id);
    return { resultUrl };
  }

  private async pollPrediction(predictionId: string): Promise<string> {
    const maxAttempts = 60;
    const delayMs = 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const prediction = await this.replicateClient!.predictions.get(predictionId);
      this.logger.log(`[tryon] poll attempt=${attempt} status=${prediction.status}`);

      if (prediction.status === 'succeeded') {
        const output = prediction.output;
        const imageUrl = Array.isArray(output) ? String(output[0]) : String(output);
        if (!imageUrl || imageUrl === 'null' || imageUrl === 'undefined') {
          throw new Error('Replicate returned empty output');
        }
        return imageUrl;
      }

      if (prediction.status === 'failed' || prediction.status === 'canceled') {
        throw new Error(`Replicate prediction ${prediction.status}: ${String(prediction.error ?? 'unknown error')}`);
      }

      await new Promise((r) => setTimeout(r, delayMs));
    }

    throw new Error('Replicate prediction timed out after 2 minutes');
  }

  private async classifyWithGemini(imageUrl: string, userId?: string): Promise<ClassifyResult> {
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

      const model = this.geminiClient!.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const t0 = Date.now();
      const result = await model.generateContent([
        { inlineData: { data: base64Image, mimeType } },
        CLASSIFY_PROMPT,
      ]);

      if (userId) {
        const meta = result.response.usageMetadata;
        const inputTokens = meta?.promptTokenCount ?? 800;
        const outputTokens = meta?.candidatesTokenCount ?? 150;
        const costUSD = inputTokens * 0.00000015 + outputTokens * 0.0000006;
        this.logUsage(userId, 'gemini', 'gemini-2.5-flash', 'classify', inputTokens, outputTokens, costUSD, Date.now() - t0);
      }

      const text = result.response.text().trim();
      const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(jsonText) as ClassifyResult;

      return {
        name: String(parsed.name ?? ''),
        type: String(parsed.type ?? 'unknown'),
        category: String(parsed.category ?? 'unknown'),
        color: String(parsed.color ?? 'unknown'),
        material: String(parsed.material ?? 'unknown'),
        confidence: Number(parsed.confidence ?? 0.8),
        ...(Array.isArray(parsed.materials) && parsed.materials.length && { materials: parsed.materials as string[] }),
        ...(parsed.style && { style: String(parsed.style) }),
        ...(parsed.fit && { fit: String(parsed.fit) }),
        ...(Array.isArray(parsed.occasions) && parsed.occasions.length && { occasions: parsed.occasions as string[] }),
        ...(Array.isArray(parsed.seasons) && parsed.seasons.length && { seasons: parsed.seasons as string[] }),
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

  private readonly DETECT_PROMPT = `Analyze this image. Detect all visible clothing items and accessories on the person. For each item indicate:
- tipo (shirt, pants, dress, shoes, accessory, etc. — in English)
- color (primary color in English: black, white, blue, red, green, yellow, brown, grey, beige, pink, purple, orange, navy, etc.)
- descripcion (brief description, max 10 words, in English)
- categoria (top | bottom | outerwear | footwear | accessory)
- material (estimated if visible: cotton, denim, leather, wool, synthetic, linen, silk, polyester, blend — null if not determinable)
- fit (slim | regular | oversize | relaxed | cropped — null if not applicable or not determinable)

Additionally, analyze each garment and determine:

- materials: list of materials that appear from the texture and visual appearance.
  Possible values: ["cotton", "polyester", "wool", "silk", "linen", "denim",
  "leather", "synthetic", "cashmere", "velvet", "spandex", "fleece", "nylon"]

- style: general style of the garment.
  Possible values: "casual", "formal", "sport", "elegant", "smart-casual",
  "beach", "street", "bohemian", "minimalist", "classic"

- occasions: for which occasions this garment is appropriate. Pick all that apply.
  Possible values: ["casual", "everyday", "work", "business", "sport", "gym",
  "night-out", "party", "dinner", "date", "formal", "gala", "beach", "vacation"]

- seasons: in which seasons this garment is appropriate. Pick all that apply.
  Possible values: ["spring", "summer", "fall", "winter"]

Examples:
- A basic black t-shirt: style="casual", occasions=["casual","everyday","night-out"], seasons=["spring","summer","fall"]
- A black blazer: style="smart-casual", occasions=["work","dinner","party","formal"], seasons=["spring","fall","winter"]
- Sport leggings: style="sport", occasions=["gym","sport"], seasons=["spring","summer","fall","winter"]
- A white linen dress: style="casual", occasions=["casual","beach","dinner"], seasons=["spring","summer"]

Return ONLY a valid JSON array with no additional text. Maximum 8 items. If there is no person or no visible clothing, return [].

Each object must have: tipo, color, descripcion, categoria, material, fit, materials, style, occasions, seasons.`;

  async enrichGarmentAttributes(input: {
    imageUrl: string;
    category: string;
    name: string;
    color: string;
    userId?: string;
  }): Promise<{ materials: string[]; style: string; fit: string; occasions: string[]; seasons: string[] } | null> {
    if (!this.anthropicClient) {
      this.logger.warn('enrichGarmentAttributes: Anthropic client not available');
      return null;
    }

    const prompt = `Tarea: clasificar atributos de moda de una prenda.

Categoría: ${input.category}
Nombre: ${input.name}
Color: ${input.color}

Devolvé SOLO JSON válido con:
{
  "materials": ["cotton"],
  "style": "casual",
  "fit": "regular",
  "occasions": ["casual", "everyday"],
  "seasons": ["spring", "summer", "fall"]
}

Valores válidos:
- materials: cotton, polyester, wool, silk, linen, denim, leather, synthetic, cashmere, velvet, spandex, fleece, nylon
- style: casual, formal, sport, elegant, smart-casual, beach, street, bohemian, minimalist, classic
- fit: slim, regular, relaxed, oversized, skinny
- occasions: casual, everyday, work, business, sport, gym, night-out, party, dinner, date, formal, gala, beach, vacation
- seasons: spring, summer, fall, winter`;

    try {
      const t0 = Date.now();
      const response = await this.anthropicClient.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url: input.imageUrl } },
            { type: 'text', text: prompt },
          ],
        }],
      });

      if (input.userId) {
        const inputTokens = response.usage.input_tokens;
        const outputTokens = response.usage.output_tokens;
        const costUSD = inputTokens * 0.0000008 + outputTokens * 0.000004;
        this.logUsage(input.userId, 'anthropic', 'claude-haiku-4-5-20251001', 'enrich', inputTokens, outputTokens, costUSD, Date.now() - t0);
      }

      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
      const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(jsonText);
      return {
        materials: Array.isArray(parsed.materials) ? parsed.materials : [],
        style: String(parsed.style ?? 'casual'),
        fit: String(parsed.fit ?? 'regular'),
        occasions: Array.isArray(parsed.occasions) ? parsed.occasions : [],
        seasons: Array.isArray(parsed.seasons) ? parsed.seasons : [],
      };
    } catch (err) {
      this.logger.error(`enrichGarmentAttributes failed: ${(err as Error).message}`);
      return null;
    }
  }

  async generateTextContent(prompt: string, userId?: string): Promise<string> {
    if (!this.geminiClient) {
      throw new Error('Gemini client not configured — cannot generate text content');
    }
    const model = this.geminiClient.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const t0 = Date.now();
    const result = await model.generateContent(prompt);

    if (userId) {
      const meta = result.response.usageMetadata;
      const inputTokens = meta?.promptTokenCount ?? 500;
      const outputTokens = meta?.candidatesTokenCount ?? 300;
      const costUSD = inputTokens * 0.00000015 + outputTokens * 0.0000006;
      this.logUsage(userId, 'gemini', 'gemini-2.5-flash', 'outfit-generation', inputTokens, outputTokens, costUSD, Date.now() - t0);
    }

    return result.response.text().trim();
  }

  async detectGarments(imageBuffer: Buffer, mimeType: string, userId?: string): Promise<DetectedGarment[]> {
    if (!this.anthropicClient) {
      this.logger.warn('detectGarments: Anthropic client not available, returning empty');
      return [];
    }

    const mediaType = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType)
      ? mimeType
      : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

    const base64 = imageBuffer.toString('base64');
    const t0 = Date.now();
    const response = await this.anthropicClient.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: this.DETECT_PROMPT },
        ],
      }],
    });

    if (userId) {
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const costUSD = inputTokens * 0.000003 + outputTokens * 0.000015;
      this.logUsage(userId, 'anthropic', 'claude-sonnet-4-6', 'detect-garments', inputTokens, outputTokens, costUSD, Date.now() - t0);
    }

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
    try {
      const raw = JSON.parse(text.trim());
      return Array.isArray(raw) ? (raw as DetectedGarment[]).slice(0, 8) : [];
    } catch {
      return [];
    }
  }

  private logUsage(
    userId: string,
    provider: string,
    model: string,
    endpoint: string,
    inputTokens: number,
    outputTokens: number,
    costUSD: number,
    durationMs?: number,
  ): void {
    if (!this.aiUsageService) return;
    this.aiUsageService.log({ userId, provider, model, endpoint, inputTokens, outputTokens, estimatedCostUSD: costUSD, durationMs }).catch(() => {});
  }

  async ping(): Promise<void> {
    if (this.geminiClient) {
      const model = this.geminiClient.getGenerativeModel({ model: 'gemini-2.0-flash' });
      await model.generateContent({ contents: [{ role: 'user', parts: [{ text: 'ping' }] }], generationConfig: { maxOutputTokens: 1 } });
      return;
    }
    if (this.provider === 'custom' && this.baseUrl) {
      const res = await this.httpService.axiosRef.get(`${this.baseUrl}/health`, { timeout: 3000 });
      if (res.status !== 200) throw new Error(`AI service returned ${res.status}`);
      return;
    }
    throw new Error('No AI provider configured');
  }
}
