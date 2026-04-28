import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserDocument } from './schemas/user.schema';
import { UpdateUserDto } from './dto/update-user.dto';

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

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanent account deletion (Apple / GDPR compliance)' })
  async deleteMe(@CurrentUser() user: UserDocument) {
    await this.usersService.hardDelete(String(user._id), user.firebaseUid);
    return { ok: true };
  }
}
