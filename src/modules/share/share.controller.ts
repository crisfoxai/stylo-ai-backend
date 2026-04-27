import { Controller, Post, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ShareService } from './share.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';

@ApiTags('outfits')
@Controller('outfits')
@UseGuards(FirebaseAuthGuard)
@ApiBearerAuth()
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Post(':outfitId/share-card')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a share card image for an outfit' })
  async generateShareCard(
    @CurrentUser() user: UserDocument,
    @Param('outfitId') outfitId: string,
  ) {
    return this.shareService.generateShareCard(String(user._id), outfitId);
  }
}
