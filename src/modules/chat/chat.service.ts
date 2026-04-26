import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import { ChatMessage, ChatMessageDocument } from './schemas/chat-message.schema';
import { SendMessageDto } from './dto/chat.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { WardrobeService } from '../wardrobe/wardrobe.service';
import { StyleProfileService } from '../style-profile/style-profile.service';

const MODEL_BY_PLAN: Record<string, string> = {
  stylist: 'claude-haiku-4-5-20251001',
  pro: 'claude-sonnet-4-6',
  pro_unlimited: 'claude-sonnet-4-6',
};

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly anthropic: Anthropic;

  constructor(
    @InjectModel(ChatMessage.name) private readonly chatModel: Model<ChatMessageDocument>,
    private readonly configService: ConfigService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly wardrobeService: WardrobeService,
    private readonly styleProfileService: StyleProfileService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    this.anthropic = new Anthropic({ apiKey: apiKey ?? '' });
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

    const model = MODEL_BY_PLAN[plan] ?? 'claude-haiku-4-5-20251001';
    const sessionId = dto.sessionId ?? uuidv4();

    const historyDocs = await this.chatModel
      .find({ userId: new Types.ObjectId(userId), sessionId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    const history = historyDocs.reverse();

    // Build wardrobe context
    const wardrobeResult = await this.wardrobeService.list(userId, { page: 1, limit: 50 });
    const styleProfile = await this.styleProfileService.findByUser(userId).catch(() => null);

    const systemPrompt = this.buildSystemPrompt(
      wardrobeResult.items as Record<string, unknown>[],
      styleProfile as Record<string, unknown> | null,
    );

    const messages: Anthropic.MessageParam[] = [
      ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: dto.message },
    ];

    const response = await this.anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const reply = response.content[0].type === 'text' ? response.content[0].text : '';

    await this.chatModel.insertMany([
      { userId: new Types.ObjectId(userId), role: 'user', content: dto.message, sessionId },
      { userId: new Types.ObjectId(userId), role: 'assistant', content: reply, model, sessionId },
    ]);

    const result: ReturnType<ChatService['sendMessage']> extends Promise<infer T> ? T : never = {
      reply,
      sessionId,
      model,
    };

    if (plan === 'stylist') {
      const updated = await this.subscriptionsService.getByUserId(userId);
      result.messagesUsedThisMonth = updated.chatMessagesUsedThisMonth;
      result.messagesLimitThisMonth = 30;
    }

    return result;
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
