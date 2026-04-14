import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService
  ) {}

  async validateUser(phone: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByPhone(phone);
    if (user && await bcrypt.compare(pass, user.passwordHash)) {
      const { passwordHash, ...result } = user.toObject();
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { phone: user.phone, sub: user._id, role: user.role || 'CUSTOMER' };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(registerDto: any) {
      const salt = await bcrypt.genSalt();
      const passwordHash = await bcrypt.hash(registerDto.password, salt);
      return this.usersService.create({
          phone: registerDto.phone,
          passwordHash,
          fullName: registerDto.fullName,
          email: registerDto.email
      });
  }
}
