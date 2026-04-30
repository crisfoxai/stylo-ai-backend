import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiUsageLog, AiUsageLogDocument } from './schemas/ai-usage-log.schema';

const DAILY_WARN_THRESHOLD = 50;

export interface LogAiUsageInput {
  userId: string;
  provider: string;
  model: string;
  endpoint: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUSD?: number;
  durationMs?: number;
}

@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(
    @InjectModel(AiUsageLog.name) private readonly logModel: Model<AiUsageLogDocument>,
  ) {}

  async log(input: LogAiUsageInput): Promise<void> {
    await this.logModel.create({
      userId: new Types.ObjectId(input.userId),
      provider: input.provider,
      model: input.model,
      endpoint: input.endpoint,
      inputTokens: input.inputTokens ?? 0,
      outputTokens: input.outputTokens ?? 0,
      estimatedCostUSD: input.estimatedCostUSD ?? 0,
      durationMs: input.durationMs,
    });

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const dailyCount = await this.logModel.countDocuments({
      userId: new Types.ObjectId(input.userId),
      createdAt: { $gte: todayStart },
    });

    if (dailyCount >= DAILY_WARN_THRESHOLD) {
      this.logger.warn(
        JSON.stringify({
          msg: 'User exceeded daily AI usage threshold',
          userId: input.userId,
          dailyCount,
          threshold: DAILY_WARN_THRESHOLD,
        }),
      );
    }
  }

  async getAggregatedCosts(from: Date, to: Date): Promise<{
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostUSD: number;
    byProvider: Record<string, { requests: number; costUSD: number }>;
    byModel: Record<string, { requests: number; costUSD: number }>;
    topUsers: Array<{ userId: string; requests: number; costUSD: number }>;
  }> {
    const [summary, byProvider, byModel, topUsers] = await Promise.all([
      this.logModel.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            totalInputTokens: { $sum: '$inputTokens' },
            totalOutputTokens: { $sum: '$outputTokens' },
            totalCostUSD: { $sum: '$estimatedCostUSD' },
          },
        },
      ]),
      this.logModel.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: '$provider',
            requests: { $sum: 1 },
            costUSD: { $sum: '$estimatedCostUSD' },
          },
        },
      ]),
      this.logModel.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: '$model',
            requests: { $sum: 1 },
            costUSD: { $sum: '$estimatedCostUSD' },
          },
        },
      ]),
      this.logModel.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: '$userId',
            requests: { $sum: 1 },
            costUSD: { $sum: '$estimatedCostUSD' },
          },
        },
        { $sort: { requests: -1 } },
        { $limit: 10 },
      ]),
    ]);

    const s = summary[0] ?? { totalRequests: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCostUSD: 0 };

    return {
      totalRequests: s.totalRequests,
      totalInputTokens: s.totalInputTokens,
      totalOutputTokens: s.totalOutputTokens,
      totalCostUSD: Number(s.totalCostUSD.toFixed(6)),
      byProvider: Object.fromEntries(byProvider.map((r: { _id: string; requests: number; costUSD: number }) => [r._id, { requests: r.requests, costUSD: Number(r.costUSD.toFixed(6)) }])),
      byModel: Object.fromEntries(byModel.map((r: { _id: string; requests: number; costUSD: number }) => [r._id, { requests: r.requests, costUSD: Number(r.costUSD.toFixed(6)) }])),
      topUsers: topUsers.map((r: { _id: Types.ObjectId; requests: number; costUSD: number }) => ({ userId: String(r._id), requests: r.requests, costUSD: Number(r.costUSD.toFixed(6)) })),
    };
  }
}
