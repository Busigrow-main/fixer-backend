import { Module } from '@nestjs/common';
import { GstController } from './gst.controller';
import { GstService } from './gst.service';

@Module({
  controllers: [GstController],
  providers: [GstService],
  exports: [GstService],
})
export class GstModule {}
