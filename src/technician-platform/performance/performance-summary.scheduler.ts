import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PerformanceSummaryService } from './performance-summary.service';

@Injectable()
export class PerformanceSummaryScheduler {
  private readonly logger = new Logger(PerformanceSummaryScheduler.name);

  constructor(private readonly summaryService: PerformanceSummaryService) {}

  @Cron('0 22 * * *', { timeZone: 'Asia/Kolkata' })
  async generatePreviousDaySummary() {
    try {
      const summary = await this.summaryService.generatePreviousDay();
      this.logger.log(`Generated performance summary for ${summary.businessDate}`);
    } catch (error) {
      this.logger.error('Daily performance summary generation failed', error);
    }
  }
}
