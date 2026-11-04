import { Module } from '@nestjs/common';
import { TechniciansModule } from '../technicians/technicians.module';
import { TechnicianEngineService } from './technician-engine.service';

@Module({
  imports: [TechniciansModule],
  providers: [TechnicianEngineService],
  exports: [TechnicianEngineService],
})
export class TechnicianEngineModule {}
