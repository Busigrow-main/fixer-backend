import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

function isDuplicateKey(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { code?: number }).code === 11000);
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findOneByPhone(phone: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phone }).select('+passwordHash').exec();
  }

  async findOneByEmail(email: string): Promise<UserDocument | null> {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return null;
    return this.userModel.findOne({ email: normalized }).exec();
  }

  async findOneByGoogleId(googleId: string): Promise<UserDocument | null> {
    if (!googleId) return null;
    return this.userModel.findOne({ googleId }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async create(userData: Partial<User>): Promise<UserDocument> {
    try {
      return await new this.userModel(userData).save();
    } catch (err) {
      if (isDuplicateKey(err)) {
        throw new ConflictException(
          userData.phone
            ? 'An account with this phone number already exists'
            : 'An account with these details already exists',
        );
      }
      throw err;
    }
  }

  /** Find-or-create for phone races: return the winner instead of 409/500. */
  async createOrFindByPhone(
    userData: Partial<User> & { phone: string },
  ): Promise<UserDocument> {
    try {
      return await this.create(userData);
    } catch (err) {
      if (err instanceof ConflictException) {
        const existing = await this.findOneByPhone(userData.phone);
        if (existing) return existing;
      }
      throw err;
    }
  }

  async findAll(page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(100, limit));
    const skip = (safePage - 1) * safeLimit;
    
    const [data, total] = await Promise.all([
      this.userModel
        .find({}, { passwordHash: 0 })
        .skip(skip)
        .limit(safeLimit)
        .sort({ createdAt: -1 })
        .exec(),
      this.userModel.countDocuments().exec(),
    ]);
  
    return { data, total };
  }  

  async countAll(): Promise<number> {
    return this.userModel.countDocuments().exec();
  }

  async updateRole(id: string, role: string): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(id, { role }, { returnDocument: 'after', select: '-passwordHash' }).exec();
    if (!user) throw new Error('User not found');
    return user;
  }
}
