import { Controller, Get, Post, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StyleProfileService } from './style-profile.service';
import { UpdateStyleProfileDto } from './dto/update-style-profile.dto';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';

@ApiTags('style-profile')
@ApiBearerAuth('access-token')
@Controller('style-profile')
@UseGuards(FirebaseAuthGuard)
export class StyleProfileController {
  constructor(private readonly styleProfileService: StyleProfileService) {}

  @Post()
  @ApiOperation({ summary: 'Create style profile from quiz' })
  async create(@CurrentUser() user: UserDocument, @Body() dto: UpdateStyleProfileDto) {
    return this.styleProfileService.create(user._id.toString(), dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get style profile' })
  async findOne(@CurrentUser() user: UserDocument) {
    return this.styleProfileService.findByUser(user._id.toString());
  }

  @Patch()
  @ApiOperation({ summary: 'Update style profile' })
  async update(@CurrentUser() user: UserDocument, @Body() dto: UpdateStyleProfileDto) {
    return this.styleProfileService.update(user._id.toString(), dto);
  }
}
