import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';

import { WardrobeService } from './wardrobe.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { ListWardrobeDto, UpdateWardrobeItemDto, ConfirmDetectionDto } from './dto/wardrobe.dto';

@ApiTags('garments')
@Controller('garments')
@UseGuards(FirebaseAuthGuard)
@ApiBearerAuth()
export class WardrobeController {
  constructor(private readonly wardrobeService: WardrobeService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload wardrobe item image (async AI pipeline)' })
  async create(
    @CurrentUser() user: UserDocument,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.wardrobeService.create(String(user._id), file);
  }

  @Get('count')
  @ApiOperation({ summary: 'Get wardrobe item count + empty state' })
  async getCount(@CurrentUser() user: UserDocument) {
    const count = await this.wardrobeService.countForUser(String(user._id));
    const threshold = 5;
    const state = count === 0 ? 'empty' : count < threshold ? 'warning' : 'ready';
    return { count, threshold, state };
  }

  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Poll wardrobe upload job status' })
  async getJob(@CurrentUser() user: UserDocument, @Param('jobId') jobId: string) {
    return this.wardrobeService.getJob(String(user._id), jobId);
  }

  @Get()
  @ApiOperation({ summary: 'List garments (paginated + filtered)' })
  async list(@CurrentUser() user: UserDocument, @Query() dto: ListWardrobeDto) {
    return this.wardrobeService.list(String(user._id), dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single garment' })
  async findOne(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.wardrobeService.findOne(String(user._id), id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update garment tags/brand/category' })
  async update(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: UpdateWardrobeItemDto,
  ) {
    return this.wardrobeService.update(String(user._id), id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete garment' })
  async remove(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    await this.wardrobeService.softDelete(String(user._id), id);
  }

  @Post('detect-from-photo')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Detect garments from body photo using Claude Vision' })
  async detectFromPhoto(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.wardrobeService.detectFromPhoto(file);
  }

  @Post('detect-from-photo/confirm')
  @ApiOperation({ summary: 'Confirm detected garments and create wardrobe items' })
  async confirmDetection(@CurrentUser() user: UserDocument, @Body() dto: ConfirmDetectionDto) {
    return this.wardrobeService.confirmDetection(String(user._id), dto);
  }
}
