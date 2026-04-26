import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post('apple')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apple App Store Server Notifications v2' })
  async appleWebhook(@Body() payload: { signedPayload?: string }) {
    await this.subscriptionsService.handleAppleWebhook(payload.signedPayload ?? '');
    return { ok: true };
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Google Play Pub/Sub push notifications' })
  async googleWebhook(@Body() payload: Record<string, unknown>) {
    await this.subscriptionsService.handleGoogleWebhook(payload);
    return { ok: true };
  }
}
