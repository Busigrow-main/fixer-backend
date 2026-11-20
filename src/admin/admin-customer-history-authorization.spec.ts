import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminController } from './admin.controller';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

describe('admin customer history authorization', () => {
  it('inherits JWT and ADMIN guards from the admin controller', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      AdminController,
    ) as Function[];
    expect(guards).toHaveLength(2);
    expect(guards).toContain(RolesGuard);
    expect(Reflect.getMetadata(ROLES_KEY, AdminController)).toEqual(['ADMIN']);
  });

  it('allows admins and rejects customers at the role guard', () => {
    const guard = new RolesGuard(new Reflector());
    const contextFor = (role: string) =>
      ({
        getHandler: () => AdminController.prototype.getCustomerServiceHistory,
        getClass: () => AdminController,
        switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
      }) as unknown as ExecutionContext;

    expect(guard.canActivate(contextFor('ADMIN'))).toBe(true);
    expect(() => guard.canActivate(contextFor('CUSTOMER'))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(contextFor('TECHNICIAN'))).toThrow(
      ForbiddenException,
    );
  });
});
