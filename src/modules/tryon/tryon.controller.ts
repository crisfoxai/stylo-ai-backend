import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  BadRequestException,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { TryonService } from './tryon.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { TryonDto, TryonOutfitGarmentDto, TryonOutfitFormDto } from './dto/tryon.dto';

const FILE_PIPE = new ParseFilePipe({
  validators: [
    new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
    new FileTypeValidator({ fileType: /(jpg|jpeg|png)/ }),
  ],
});

const BASE_PHOTO_PIPE = new ParseFilePipe({
  validators: [
    new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
    new FileTypeValidator({ fileType: /(jpg|jpeg|png)/ }),
  ],
});

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
    @UploadedFile(FILE_PIPE) file: Express.Multer.File,
    @Body() dto: TryonDto,
  ) {
    return this.tryonService.tryon(String(user._id), file, dto.garmentId, dto.outfitId);
  }

  @Post('outfit')
  @UseInterceptors(FileInterceptor('userPhoto'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: TryonOutfitFormDto })
  @ApiOperation({ summary: 'Try-on full outfit sequentially (lower_body → upper_body → outerwear)' })
  async tryonOutfit(
    @CurrentUser() user: UserDocument,
    @UploadedFile(FILE_PIPE) userPhoto: Express.Multer.File,
    @Body('garments') garmentsRaw: string,
    @Body('outfitId') outfitId?: string,
  ) {
    let garments: TryonOutfitGarmentDto[];
    try {
      garments = JSON.parse(garmentsRaw);
    } catch {
      throw new BadRequestException('garments must be a valid JSON array string');
    }
    if (!Array.isArray(garments) || garments.length === 0) {
      throw new BadRequestException('garments must be a non-empty array');
    }
    return this.tryonService.tryonOutfit(String(user._id), userPhoto, garments, outfitId);
  }

  // --- Base photos ---

  @Get('base-photos')
  @ApiOperation({ summary: 'List base photos for try-on (max 20, signed URLs)' })
  async listBasePhotos(@CurrentUser() user: UserDocument) {
    return this.tryonService.listBasePhotos(String(user._id));
  }

  @Post('base-photos')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Upload base photo for try-on (FIFO limit 20)' })
  async uploadBasePhoto(
    @CurrentUser() user: UserDocument,
    @UploadedFile(BASE_PHOTO_PIPE) file: Express.Multer.File,
  ) {
    return this.tryonService.uploadBasePhoto(String(user._id), file);
  }

  @Delete('base-photos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete base photo by id' })
  async deleteBasePhoto(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    await this.tryonService.deleteBasePhoto(String(user._id), id);
  }
}
