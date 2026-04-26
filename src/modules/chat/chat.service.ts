import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatMessage, ChatMessageDocument } from './schemas/chat-message.schema';
import { SendMessageDto } from './dto/chat.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { WardrobeService } from '../wardrobe/wardrobe.service';
import { StyleProfileService } from '../style-profile/style-profile.service';

const CHAT_MODEL = 'gemini-2.5-flash';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly gemini: GoogleGenerativeAI;

  constructor(
    @InjectModel(ChatMessage.name) private readonly chatModel: Model<ChatMessageDocument>,
    private readonly configService: ConfigService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly wardrobeService: WardrobeService,
    private readonly styleProfileService: StyleProfileService,
  ) {
    const apiKey = this.configService.getOrThrow<string>('GEMINI_API_KEY');
    this.gemini = new GoogleGenerativeAI(apiKey);
  }

  async sendMessage(
    userId: string,
    dto: SendMessageDto,
  ): Promise<{ reply: string; sessionId: string; model: string; messagesUsedThisMonth?: number; messagesLimitThisMonth?: number }> {
    const subscription = await this.subscriptionsService.getByUserId(userId);
    const plan = subscription.plan;

    if (plan === 'free') {
      throw new ForbiddenException({ error: 'SUBSCRIPTION_REQUIRED', feature: 'chat' });
    }

    if (plan === 'stylist') {
      await this.subscriptionsService.checkAndIncrementUsage(userId, 'chat');
    }

    const sessionId = dto.sessionId ?? uuidv4();

    const historyDocs = await this.chatModel
      .find({ userId: new Types.ObjectId(userId), sessionId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    const history = historyDocs.reverse();

    const wardrobeResult = await this.wardrobeService.list(userId, { page: 1, limit: 50 });
    const styleProfile = await this.styleProfileService.findByUser(userId).catch(() => null);

    const systemInstruction = this.buildSystemPrompt(
      wardrobeResult.items as Record<string, unknown>[],
      styleProfile as Record<string, unknown> | null,
    );

    const geminiModel = this.gemini.getGenerativeModel({
      model: CHAT_MODEL,
      systemInstruction,
    });

    // Gemini uses 'model' role instead of 'assistant'
    const geminiHistory = history.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const chat = geminiModel.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(dto.message);
    const reply = result.response.text();

    await this.chatModel.insertMany([
      { userId: new Types.ObjectId(userId), role: 'user', content: dto.message, sessionId },
      { userId: new Types.ObjectId(userId), role: 'assistant', content: reply, model: CHAT_MODEL, sessionId },
    ]);

    const response: { reply: string; sessionId: string; model: string; messagesUsedThisMonth?: number; messagesLimitThisMonth?: number } = {
      reply,
      sessionId,
      model: CHAT_MODEL,
    };

    if (plan === 'stylist') {
      const updated = await this.subscriptionsService.getByUserId(userId);
      response.messagesUsedThisMonth = updated.chatMessagesUsedThisMonth;
      response.messagesLimitThisMonth = 30;
    }

    return response;
  }

  async getHistory(userId: string, sessionId: string): Promise<ChatMessageDocument[]> {
    return this.chatModel
      .find({ userId: new Types.ObjectId(userId), sessionId })
      .sort({ createdAt: 1 })
      .limit(10)
      .lean() as unknown as ChatMessageDocument[];
  }

  private buildSystemPrompt(
    wardrobe: Record<string, unknown>[],
    styleProfile: Record<string, unknown> | null,
  ): string {
    const wardrobeItems = wardrobe.map((i) => ({
      name: i['name'],
      type: i['type'],
      color: i['color'],
      category: i['category'],
    }));

    return `Sos un estilista personal AI para la app Stylo AI. Conocés el guardarropa completo del usuario y sus preferencias de estilo.

GUARDARROPA DEL USUARIO:
${JSON.stringify(wardrobeItems)}

PERFIL DE ESTILO:
${styleProfile ? JSON.stringify(styleProfile) : 'Sin configurar'}

Respondé en el mismo idioma que el usuario. Sé empático, concreto y con personalidad. Dá recomendaciones específicas usando las prendas reales del armario cuando sea posible. Máximo 200 palabras por respuesta.`;
  }
}
