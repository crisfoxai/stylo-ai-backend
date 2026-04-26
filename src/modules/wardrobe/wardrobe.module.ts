import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WardrobeController } from './wardrobe.controller';
import { WardrobeService } from './wardrobe.service';
import { WardrobeItem, WardrobeItemSchema } from './schemas/wardrobe-item.schema';
import { WardrobeJob, WardrobeJobSchema } from './schemas/wardrobe-job.schema';
import { AIModule } from '../ai/ai.module';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WardrobeItem.name, schema: WardrobeItemSchema },
      { name: WardrobeJob.name, schema: WardrobeJobSchema },
    ]),
    AIModule,
    StorageModule,
    AuthModule,
  ],
  controllers: [WardrobeController],
  providers: [WardrobeService],
  exports: [WardrobeService],
})
export class WardrobeModule {}
