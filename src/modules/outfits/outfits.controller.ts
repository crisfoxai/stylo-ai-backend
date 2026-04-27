import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OutfitsService } from './outfits.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { GenerateOutfitDto, OutfitHistoryDto } from './dto/outfit.dto';

@ApiTags('outfits')
@Controller('outfits')
@UseGuards(FirebaseAuthGuard)
@ApiBearerAuth()
export class OutfitsController {
  constructor(private readonly outfitsService: OutfitsService) {}

  @Get()
  @ApiOperation({ summary: 'List outfits for current user (paginated)' })
  async list(
    @CurrentUser() user: UserDocument,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.outfitsService.listByUser(String(user._id), page, limit);
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

  @Get(':id')
  @ApiOperation({ summary: 'Get single outfit by id' })
  async findOne(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.outfitsService.findOne(String(user._id), id);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate an outfit suggestion' })
  async generate(@CurrentUser() user: UserDocument, @Body() dto: GenerateOutfitDto) {
    return this.outfitsService.generate(String(user._id), dto);
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
}
