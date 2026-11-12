import { SCHEDULE_CRON_OPTIONS } from '@nestjs/schedule/dist/schedule.constants';

import { PerformanceSummaryScheduler } from './performance-summary.scheduler';

describe('PerformanceSummaryScheduler', () => {
  it('runs at 22:00 Asia/Kolkata and delegates previous-day generation', async () => {
    const summaryService = {
      generatePreviousDay: jest.fn().mockResolvedValue({ businessDate: '2026-11-11' }),
    };
    const scheduler = new PerformanceSummaryScheduler(summaryService as never);
    const options = Reflect.getMetadata(
      SCHEDULE_CRON_OPTIONS,
      PerformanceSummaryScheduler.prototype.generatePreviousDaySummary,
    );

    expect(options).toMatchObject({
      cronTime: '0 22 * * *',
      timeZone: 'Asia/Kolkata',
    });
    await scheduler.generatePreviousDaySummary();
    expect(summaryService.generatePreviousDay).toHaveBeenCalledTimes(1);
  });
});
