import {
  Controller,
  Post,
  Delete,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { OutfitsService } from './outfits.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { GenerateOutfitDto, OutfitHistoryDto, ListOutfitsDto } from './dto/outfit.dto';
import { SwapGarmentDto } from './dto/swap-garment.dto';

@ApiTags('outfits')
@Controller('outfits')
@UseGuards(FirebaseAuthGuard)
@ApiBearerAuth()
export class OutfitsController {
  constructor(private readonly outfitsService: OutfitsService) {}

  @Get()
  @ApiOperation({ summary: 'List outfits for current user (paginated + filtered)' })
  async list(@CurrentUser() user: UserDocument, @Query() dto: ListOutfitsDto) {
    return this.outfitsService.listByUser(String(user._id), dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get wear history (optionally filtered by month YYYY-MM)' })
  async getHistory(@CurrentUser() user: UserDocument, @Query() dto: OutfitHistoryDto) {
    return this.outfitsService.getHistory(String(user._id), dto);
  }

  @Get('favorites')
  @ApiOperation({ summary: 'List favorite outfits' })
  async getFavorites(@CurrentUser() user: UserDocument) {
    return this.outfitsService.getFavorites(String(user._id));
  }

  @Get('preview')
  @ApiOperation({ summary: 'Get active outfit preview from Redis (recovery)' })
  async getPreview(@CurrentUser() user: UserDocument) {
    const result = await this.outfitsService.getPreview(String(user._id));
    if (!result) throw new NotFoundException({ error: 'NOT_FOUND', message: 'No active preview' });
    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single outfit by id' })
  async findOne(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.outfitsService.findOne(String(user._id), id);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate outfit preview (stored in Redis, not persisted)' })
  async generate(@CurrentUser() user: UserDocument, @Body() dto: GenerateOutfitDto) {
    return this.outfitsService.generate(String(user._id), dto);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Persist outfit from active Redis preview to MongoDB' })
  async persist(@CurrentUser() user: UserDocument) {
    return this.outfitsService.persistPreview(String(user._id));
  }

  @Post(':id/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Add outfit to favorites' })
  async addFavorite(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    await this.outfitsService.addFavorite(String(user._id), id);
  }

  @Delete(':id/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove outfit from favorites' })
  async removeFavorite(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    await this.outfitsService.removeFavorite(String(user._id), id);
  }

  @Post(':id/worn')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Mark outfit as worn today' })
  async markWorn(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.outfitsService.markWorn(String(user._id), id);
  }

  @Post(':outfitId/look-photo')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload look photo for outfit' })
  async uploadLookPhoto(
    @CurrentUser() user: UserDocument,
    @Param('outfitId') outfitId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.outfitsService.uploadLookPhoto(String(user._id), outfitId, file);
  }

  @Delete(':outfitId/look-photo')
  @ApiOperation({ summary: 'Remove look photo from outfit' })
  async deleteLookPhoto(@CurrentUser() user: UserDocument, @Param('outfitId') outfitId: string) {
    return this.outfitsService.deleteLookPhoto(String(user._id), outfitId);
  }

  @Post(':id/swap-garment')
  @ApiOperation({ summary: 'Suggest alternative garment for a slot (no persistence)' })
  async swapGarment(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: SwapGarmentDto,
  ) {
    return this.outfitsService.swapGarment(String(user._id), id, dto);
  }
}
