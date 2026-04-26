import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, Matches } from 'class-validator';
import { FeedbackType } from '../schemas/feedback.schema';

export class SubmitFeedbackDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'outfitId must be a valid ObjectId' })
  outfitId!: string;

  @ApiProperty({ enum: FeedbackType })
  @IsEnum(FeedbackType)
  type!: FeedbackType;
}
