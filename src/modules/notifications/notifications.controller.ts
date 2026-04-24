import { Controller, Post, Delete, Patch, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { RegisterTokenDto, UpdatePreferencesDto } from './dto/notification.dto';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(FirebaseAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('register-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register FCM push token' })
  async registerToken(@CurrentUser() user: UserDocument, @Body() dto: RegisterTokenDto) {
    return this.notificationsService.registerToken(String(user._id), dto);
  }

  @Post('unregister-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unregister FCM push token' })
  async unregisterToken(@CurrentUser() user: UserDocument, @Body() dto: { token: string }) {
    await this.notificationsService.unregisterToken(String(user._id), dto.token);
  }

  @Patch('preferences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update notification preferences' })
  async updatePreferences(
    @CurrentUser() _user: UserDocument,
    @Body() _dto: UpdatePreferencesDto,
  ) {
    return { ok: true };
  }
}
