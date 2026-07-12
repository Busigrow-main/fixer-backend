import { SetMetadata } from '@nestjs/common';
import { REQUIRE_ACTIVE_KEY } from './technician.guard';

export const RequireActiveTechnician = () => SetMetadata(REQUIRE_ACTIVE_KEY, true);
