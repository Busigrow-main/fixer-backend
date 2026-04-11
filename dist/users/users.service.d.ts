import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
export declare class UsersService {
    private userModel;
    constructor(userModel: Model<UserDocument>);
    findOneByPhone(phone: string): Promise<UserDocument | null>;
    create(userData: Partial<User>): Promise<UserDocument>;
}
