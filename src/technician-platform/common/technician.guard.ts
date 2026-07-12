import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TechniciansService } from '../../technicians/technicians.service';

export const REQUIRE_ACTIVE_KEY = 'requireActiveTechnician';

@Injectable()
export class TechnicianGuard implements CanActivate {
  constructor(
    private techniciansService: TechniciansService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) throw new UnauthorizedException();
    if (user.role !== 'TECHNICIAN') {
      throw new ForbiddenException('Technician access only');
    }

    const technician = await this.techniciansService.findByUserId(user.userId);
    if (!technician) {
      throw new ForbiddenException('Technician profile not found');
    }

    const requireActive = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_ACTIVE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requireActive && (!technician.isActive || !technician.idVerified)) {
      throw new ForbiddenException('Technician account is not active');
    }

    request.technician = technician;
    return true;
  }
}
