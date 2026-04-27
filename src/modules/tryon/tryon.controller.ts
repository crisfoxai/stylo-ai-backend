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
import { TryonDto, TryonOutfitDto } from './dto/tryon.dto';

@ApiTags('tryon')
@Controller('tryon')
@UseGuards(FirebaseAuthGuard)
@ApiBearerAuth()
export class TryonController {
  constructor(private readonly tryonService: TryonService) {}

  @Post()
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Virtual try-on with IDM-VTON (Pro/Pro Unlimited only)' })
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
    return this.tryonService.tryon(String(user._id), file, dto.garmentId, dto.outfitId);
  }

  @Post('outfit')
  @ApiOperation({ summary: 'Try-on full outfit sequentially (lower_body → upper_body → outerwear)' })
  async tryonOutfit(@CurrentUser() user: UserDocument, @Body() dto: TryonOutfitDto) {
    return this.tryonService.tryonOutfit(String(user._id), dto);
  }
}
