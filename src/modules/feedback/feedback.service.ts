import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Feedback } from './schemas/feedback.schema';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectModel(Feedback.name) private readonly model: Model<Feedback>,
  ) {}

  async submit(userId: string, dto: SubmitFeedbackDto) {
    return this.model.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        outfitId: new Types.ObjectId(dto.outfitId),
      },
      { type: dto.type },
      { upsert: true, new: true },
    );
  }
}
