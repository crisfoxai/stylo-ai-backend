import {
  Controller,
  Get,
  Patch,
  Put,
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
import { UpdateStyleProfileDto } from './dto/style-profile.dto';

function serializeUser(user: UserDocument, hasStyleProfile: boolean) {
  const parts = (user.displayName ?? '').trim().split(/\s+/);
  return {
    id: String(user._id),
    email: user.email,
    firstName: parts[0] ?? '',
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
    avatarUrl: user.photoUrl ?? null,
    hasStyleProfile,
    createdAt: user.createdAt,
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
    const styleProfile = await this.usersService.getStyleProfile(String(user._id));
    return serializeUser(user, styleProfile !== null);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update display name or photo URL' })
  async updateMe(@CurrentUser() user: UserDocument, @Body() dto: UpdateUserDto) {
    return this.usersService.update(String(user._id), dto);
  }

  @Put('me/style-profile')
  @ApiOperation({ summary: 'Set style quiz results' })
  async updateStyleProfile(@CurrentUser() user: UserDocument, @Body() dto: UpdateStyleProfileDto) {
    return this.usersService.upsertStyleProfile(String(user._id), dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'GDPR account deletion (soft delete)' })
  async deleteMe(@CurrentUser() user: UserDocument) {
    await this.usersService.softDelete(String(user._id));
  }
}
