import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiUsageLog, AiUsageLogSchema } from './schemas/ai-usage-log.schema';
import { AiUsageService } from './ai-usage.service';
import { AiUsageController } from './ai-usage.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AiUsageLog.name, schema: AiUsageLogSchema },
    ]),
  ],
  controllers: [AiUsageController],
  providers: [AiUsageService],
  exports: [AiUsageService],
})
export class AiUsageModule {}
