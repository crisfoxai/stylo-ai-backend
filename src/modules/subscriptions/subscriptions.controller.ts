import { Controller, Get, Post, Body, UseGuards, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { VerifyReceiptDto, DevUpgradeDto } from './dto/subscription.dto';

@ApiTags('subscriptions')
@Controller('subscriptions')
@UseGuards(FirebaseAuthGuard)
@ApiBearerAuth()
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current subscription status' })
  async getMe(@CurrentUser() user: UserDocument) {
    return this.subscriptionsService.getByUserId(String(user._id));
  }

  @Post('verify-receipt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify Apple/Google IAP receipt' })
  async verifyReceipt(@CurrentUser() user: UserDocument, @Body() dto: VerifyReceiptDto) {
    return this.subscriptionsService.verifyReceipt(String(user._id), dto);
  }

  @Post('dev-upgrade')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dev-only: upgrade subscription tier (not available in production)' })
  async devUpgrade(@CurrentUser() user: UserDocument, @Body() dto: DevUpgradeDto) {
    if (process.env.NODE_ENV === 'production') throw new NotFoundException();
    return this.subscriptionsService.devUpgrade(String(user._id), dto);
  }
}
