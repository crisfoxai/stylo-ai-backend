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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { ToggleFavoriteDto } from './dto/toggle-favorite.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { UserDocument } from '../users/schemas/user.schema';

@ApiTags('favorites')
@ApiBearerAuth('access-token')
@Controller('favorites')
@UseGuards(FirebaseAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  @ApiOperation({ summary: 'Add an outfit to favorites' })
  @ApiResponse({ status: 201, description: 'Outfit added to favorites' })
  @ApiResponse({ status: 409, description: 'Outfit already in favorites' })
  async add(@CurrentUser() user: UserDocument, @Body() dto: ToggleFavoriteDto) {
    return this.favoritesService.add(user._id.toString(), dto.outfitId);
  }

  @Delete(':outfitId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove an outfit from favorites' })
  @ApiResponse({ status: 200, description: 'Removed from favorites' })
  @ApiResponse({ status: 404, description: 'Outfit not found in favorites' })
  async remove(
    @Param('outfitId', ParseObjectIdPipe) outfitId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.favoritesService.remove(user._id.toString(), outfitId);
  }

  @Post('toggle')
  @ApiOperation({ summary: 'Toggle favorite on an outfit' })
  async toggle(@CurrentUser() user: UserDocument, @Body() dto: ToggleFavoriteDto) {
    return this.favoritesService.toggle(user._id.toString(), dto.outfitId);
  }

  @Get()
  @ApiOperation({ summary: 'List favorite outfits' })
  async findAll(@CurrentUser() user: UserDocument, @Query() pagination: PaginationDto) {
    return this.favoritesService.findAll(user._id.toString(), pagination);
  }
}
