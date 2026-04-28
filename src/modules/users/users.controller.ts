import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { MaxFileSizeValidator, FileTypeValidator, ParseFilePipe } from '@nestjs/common';
import { UsersService } from './users.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserDocument } from './schemas/user.schema';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateNotificationPreferencesDto } from './dto/notification-preferences.dto';

const AVATAR_PIPE = new ParseFilePipe({
  validators: [
    new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
    new FileTypeValidator({ fileType: /(jpg|jpeg|png)/ }),
  ],
});

function serializeUser(
  user: UserDocument,
  hasStyleProfile: boolean,
  tryonStats: { tryonsUsedThisMonth: number; tryonsLimitThisMonth: number | null; tryonsResetAt: string | null },
) {
  const parts = (user.displayName ?? '').trim().split(/\s+/);
  return {
    id: String(user._id),
    email: user.email,
    firstName: parts[0] ?? '',
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
    avatarUrl: user.photoUrl ?? null,
    hasStyleProfile,
    createdAt: user.createdAt,
    tryonsUsedThisMonth: tryonStats.tryonsUsedThisMonth,
    tryonsLimitThisMonth: tryonStats.tryonsLimitThisMonth,
    tryonsResetAt: tryonStats.tryonsResetAt,
    notificationPreferences: user.notificationPreferences ?? null,
  };
}

@ApiTags('users')
@Controller('users')
@UseGuards(FirebaseAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@CurrentUser() user: UserDocument) {
    const [styleProfile, tryonStats] = await Promise.all([
      this.usersService.getStyleProfile(String(user._id)),
      this.usersService.getTryonStats(String(user._id)),
    ]);
    return serializeUser(user, styleProfile !== null, tryonStats);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update display name or photo URL' })
  async updateMe(@CurrentUser() user: UserDocument, @Body() dto: UpdateUserDto) {
    return this.usersService.update(String(user._id), dto);
  }

  @Post('me/avatar')
  @ApiOperation({ summary: 'Upload / replace user avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @CurrentUser() user: UserDocument,
    @UploadedFile(AVATAR_PIPE) file: Express.Multer.File,
  ) {
    const avatarUrl = await this.usersService.uploadAvatar(String(user._id), file);
    return { avatarUrl };
  }

  @Patch('me/notification-preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  async updateNotificationPreferences(
    @CurrentUser() user: UserDocument,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    const preferences = await this.usersService.updateNotificationPreferences(String(user._id), dto);
    return { preferences };
  }

  @Get('me/purchase-history')
  @ApiOperation({ summary: 'Get purchase history' })
  async getPurchaseHistory(@CurrentUser() user: UserDocument) {
    return this.usersService.getPurchaseHistory(String(user._id));
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanent account deletion (Apple / GDPR compliance)' })
  async deleteMe(@CurrentUser() user: UserDocument) {
    await this.usersService.hardDelete(String(user._id), user.firebaseUid);
    return { ok: true };
  }
}
