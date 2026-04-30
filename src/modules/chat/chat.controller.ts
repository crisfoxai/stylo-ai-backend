import { Controller, Post, Get, Body, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/chat.dto';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';

@ApiTags('chat')
@Controller('chat')
@UseGuards(FirebaseAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('message')
  @Throttle({ ai: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Send message to AI stylist (Stylist/Pro/Pro Unlimited)' })
  async sendMessage(@CurrentUser() user: UserDocument, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(String(user._id), dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get chat history for a session' })
  async getHistory(
    @CurrentUser() user: UserDocument,
    @Query('sessionId') sessionId: string,
  ) {
    if (!sessionId) throw new ForbiddenException({ error: 'MISSING_SESSION_ID' });
    return this.chatService.getHistory(String(user._id), sessionId);
  }
}
