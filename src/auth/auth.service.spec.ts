import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Pick<UsersService, 'findOneByPhone' | 'create'>>;

  beforeEach(async () => {
    usersService = {
      findOneByPhone: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('jwt-token') },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('normalizes phone to last 10 digits', () => {
    expect(service.normalizePhone('+91 98765 43210')).toBe('9876543210');
  });

  it('quickLogin creates a new customer when phone is unknown', async () => {
    usersService.findOneByPhone.mockResolvedValue(null);
    usersService.create.mockResolvedValue({
      _id: 'user1',
      phone: '9876543210',
      role: 'CUSTOMER',
      toObject: () => ({ _id: 'user1', phone: '9876543210', role: 'CUSTOMER' }),
    } as any);

    const result = await service.quickLogin('9876543210', 'Alex');

    expect(usersService.create).toHaveBeenCalled();
    expect(result.access_token).toBe('jwt-token');
  });

  it('quickLogin returns token for existing user', async () => {
    usersService.findOneByPhone.mockResolvedValue({
      _id: 'user1',
      phone: '9876543210',
      role: 'CUSTOMER',
      fullName: 'Alex',
      save: jest.fn(),
      toObject: () => ({ _id: 'user1', phone: '9876543210', role: 'CUSTOMER', fullName: 'Alex' }),
    } as any);

    const result = await service.quickLogin('9876543210');

    expect(usersService.create).not.toHaveBeenCalled();
    expect(result.access_token).toBe('jwt-token');
  });

  it('validateUser accepts the default customer password', async () => {
    const hash = await bcrypt.hash('fixxer123', 10);
    usersService.findOneByPhone.mockResolvedValue({
      passwordHash: hash,
      phone: '9876543210',
      role: 'CUSTOMER',
      toObject: () => ({ phone: '9876543210', role: 'CUSTOMER' }),
    } as any);

    const user = await service.validateUser('9876543210', 'fixxer123');
    expect(user?.phone).toBe('9876543210');
  });

  it('quickLogin rejects invalid phone', async () => {
    await expect(service.quickLogin('123')).rejects.toBeInstanceOf(BadRequestException);
  });
});
