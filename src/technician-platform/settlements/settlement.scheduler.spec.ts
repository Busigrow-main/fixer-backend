import { SCHEDULE_CRON_OPTIONS } from '@nestjs/schedule/dist/schedule.constants';

import { SettlementScheduler } from './settlement.scheduler';

describe('SettlementScheduler', () => {
  it('uses 21:00 Asia/Kolkata and delegates preparation', async () => {
    const settlementsService = {
      prepareAll: jest.fn().mockResolvedValue([]),
    };
    const scheduler = new SettlementScheduler(settlementsService as never);
    const cronOptions = Reflect.getMetadata(
      SCHEDULE_CRON_OPTIONS,
      SettlementScheduler.prototype.prepareNightlySettlements,
    );

    expect(cronOptions).toMatchObject({
      cronTime: '0 21 * * *',
      timeZone: 'Asia/Kolkata',
    });
    await scheduler.prepareNightlySettlements();
    expect(settlementsService.prepareAll).toHaveBeenCalledTimes(1);
  });
});
