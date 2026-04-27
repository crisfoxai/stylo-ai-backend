import { Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReferralsService } from './referrals.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { ApplyReferralCodeDto } from './dto/referral.dto';

@ApiTags('referrals')
@Controller('referrals')
@UseGuards(FirebaseAuthGuard)
@ApiBearerAuth()
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Post('apply-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply a referral code (once per user)' })
  async applyCode(@CurrentUser() user: UserDocument, @Body() dto: ApplyReferralCodeDto) {
    return this.referralsService.applyCode(String(user._id), dto);
  }

  @Get('my-stats')
  @ApiOperation({ summary: 'Get referral stats and bonus status' })
  async getStats(@CurrentUser() user: UserDocument) {
    return this.referralsService.getStats(String(user._id));
  }
}
