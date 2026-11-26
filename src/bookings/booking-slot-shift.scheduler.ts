import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TechnicianScheduleService } from '../technician-engine/technician-schedule.service';
import { BookingsService } from './bookings.service';

/**
 * Every 5 minutes: for each Fixxer technician with slots today, apply the overrun rule
 * (previous job not closed past its end → later not-started jobs move +1h, cascading).
 *
 * Lives in BookingsModule (writes + history go through BookingsService); reads the
 * technician list from TechnicianScheduleService. Both edges point Bookings → Engine.
 */
@Injectable()
export class BookingSlotShiftScheduler {
  private readonly logger = new Logger(BookingSlotShiftScheduler.name);
  private running = false;

  constructor(
    private readonly bookings: BookingsService,
    @Optional() private readonly schedule?: TechnicianScheduleService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleOverrunShift() {
    if (!this.schedule || this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const technicianIds = await this.schedule.staffWithOpenSlotsOn(now);
      let shifted = 0;
      for (const id of technicianIds) {
        try {
          shifted += (await this.bookings.applyOverrunShift(id, now)).shifted;
        } catch (err) {
          this.logger.error(`Overrun shift failed for technician ${id}`, err as Error);
        }
      }
      if (shifted > 0) this.logger.log(`Overrun shift: moved ${shifted} booking(s)`);
    } catch (err) {
      this.logger.error('Overrun shift cron failed', err as Error);
    } finally {
      this.running = false;
    }
  }
}
