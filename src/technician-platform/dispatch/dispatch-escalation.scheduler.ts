import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobDispatchService } from './job-dispatch.service';

@Injectable()
export class DispatchEscalationScheduler {
  private readonly logger = new Logger(DispatchEscalationScheduler.name);

  constructor(private readonly jobDispatch: JobDispatchService) {}

  /** Every minute: escalate OPEN jobs that stayed unclaimed for 10+ minutes. */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleEscalation() {
    try {
      const n = await this.jobDispatch.escalateUnclaimedJobs();
      if (n > 0) {
        this.logger.log(`Escalated ${n} job(s) to NEEDS_ADMIN`);
      }
    } catch (err) {
      this.logger.error('Dispatch escalation cron failed', err as Error);
    }
  }
}
