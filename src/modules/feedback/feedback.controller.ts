import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';

@ApiTags('feedback')
@ApiBearerAuth('access-token')
@Controller('feedback')
@UseGuards(FirebaseAuthGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @ApiOperation({ summary: 'Submit feedback on an outfit' })
  async submit(@CurrentUser() user: UserDocument, @Body() dto: SubmitFeedbackDto) {
    return this.feedbackService.submit(user._id.toString(), dto);
  }
}
