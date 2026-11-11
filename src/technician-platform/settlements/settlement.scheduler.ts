import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { SettlementsService } from './settlements.service';

@Injectable()
export class SettlementScheduler {
  private readonly logger = new Logger(SettlementScheduler.name);

  constructor(private readonly settlementsService: SettlementsService) {}

  @Cron('0 21 * * *', { timeZone: 'Asia/Kolkata' })
  async prepareNightlySettlements() {
    try {
      const settlements = await this.settlementsService.prepareAll();
      this.logger.log(`Prepared ${settlements.length} technician settlement(s)`);
    } catch (error) {
      this.logger.error('Nightly settlement preparation failed', error);
    }
  }
}
