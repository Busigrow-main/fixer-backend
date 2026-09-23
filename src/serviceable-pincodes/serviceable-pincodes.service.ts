import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  ServiceablePincode,
  ServiceablePincodeDocument,
} from './schemas/serviceable-pincode.schema';

import { CreateServiceablePincodeDto } from './dto/create-serviceable-pincode.dto';
import { UpdateServiceablePincodeDto } from './dto/update-serviceable-pincode.dto';

@Injectable()
export class ServiceablePincodesService {
  constructor(
    @InjectModel(ServiceablePincode.name)
    private readonly serviceablePincodeModel: Model<ServiceablePincodeDocument>,
  ) {}

  // Used by booking system
  async isServiceable(pincode: string): Promise<boolean> {
    const result = await this.serviceablePincodeModel.findOne({
      pincode,
      isActive: true,
    }).lean();

    return !!result;
  }

  // Admin: add pincode
  async create(
    createDto: CreateServiceablePincodeDto,
  ): Promise<ServiceablePincode> {
    const pincode = createDto.pincode.trim();

    const existing = await this.serviceablePincodeModel.findOne({
      pincode,
    });

    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        existing.city = createDto.city;
        existing.state = createDto.state;

        return existing.save();
      }

      throw new BadRequestException(
        'This pincode is already serviceable.',
      );
    }

    return this.serviceablePincodeModel.create({
      ...createDto,
      pincode,
      isActive: true,
    });
  }

  // Admin: get all pincodes
  async findAll(): Promise<ServiceablePincode[]> {
    return this.serviceablePincodeModel
      .find()
      .sort({ createdAt: -1 })
      .exec();
  }

  // Admin: update pincode
  async update(
    id: string,
    updateDto: UpdateServiceablePincodeDto,
  ): Promise<ServiceablePincode> {
    const pincode = await this.serviceablePincodeModel.findById(id);

    if (!pincode) {
      throw new NotFoundException('Pincode not found.');
    }

    Object.assign(pincode, updateDto);

    return pincode.save();
  }

  // Admin: deactivate pincode
  async remove(id: string): Promise<ServiceablePincode> {
    const pincode = await this.serviceablePincodeModel.findById(id);

    if (!pincode) {
      throw new NotFoundException('Pincode not found.');
    }

    pincode.isActive = false;

    return pincode.save();
  }
}