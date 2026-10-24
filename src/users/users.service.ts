import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

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
    const createdUser = new this.userModel(userData);
    return createdUser.save();
  }

  async findAll(page = 1, limit = 20): Promise<{ data: UserDocument[]; total: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.userModel.find({}, { passwordHash: 0 }).skip(skip).limit(limit).sort({ createdAt: -1 }).exec(),
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
