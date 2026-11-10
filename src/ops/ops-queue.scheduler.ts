import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OpsQueueService } from './ops-queue.service';

@Injectable()
export class OpsQueueScheduler {
  private readonly logger = new Logger(OpsQueueScheduler.name);

  constructor(private readonly opsQueue: OpsQueueService) {}

  /** Refresh overdue ops tags and emit cooldown-deduped alerts. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleOverdueSync() {
    try {
      const result = await this.opsQueue.syncAndNotify();
      if (result.synced > 0 || result.notified > 0) {
        this.logger.log(
          `Ops overdue sync: synced=${result.synced} notified=${result.notified}`,
        );
      }
    } catch (err) {
      this.logger.error('Ops overdue sync failed', err as Error);
    }
  }
}
