import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { jwtSecret } from '../../common/jwt-secret';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret(),
    });
  }

  async validate(payload: { sub?: string; phone?: string; role?: string }) {
    const id = payload?.sub ? String(payload.sub) : '';
    if (!id) throw new UnauthorizedException();
    const user = await this.usersService.findById(id);
    if (!user) throw new UnauthorizedException();
    return {
      userId: String(user._id),
      phone: user.phone,
      role: user.role,
    };
  }
}
