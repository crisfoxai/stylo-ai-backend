import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { TryonService } from './tryon.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { TryonDto } from './dto/tryon.dto';

@ApiTags('tryon')
@Controller('tryon')
@UseGuards(FirebaseAuthGuard)
@ApiBearerAuth()
export class TryonController {
  constructor(private readonly tryonService: TryonService) {}

  @Post()
  @UseInterceptors(FileInterceptor('userPhoto'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Virtual try-on (premium gated)' })
  async tryon(
    @CurrentUser() user: UserDocument,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(jpg|jpeg|png)/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: TryonDto,
  ) {
    const isPremium = false; // TODO: read from subscription when SubscriptionsService is wired
    return this.tryonService.tryon(
      String(user._id),
      file,
      dto.outfitId,
      dto.itemIds ?? [],
      isPremium,
    );
  }
}
