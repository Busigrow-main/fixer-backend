import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  Lead,
  LeadDocument,
} from './schemas/lead.schema';

import { CreateLeadDto } from './dto/create-lead.dto';

@Injectable()
export class LeadsService {
  constructor(
    @InjectModel(Lead.name)
    private readonly leadModel: Model<LeadDocument>,
  ) {}

  async create(
    createLeadDto: CreateLeadDto,
    userId: string,
  ): Promise<Lead> {
    return this.leadModel.create({
      ...createLeadDto,
      userId,
    });
  }

  async findAll(): Promise<Lead[]> {
    return this.leadModel
      .find()
      .sort({ createdAt: -1 })
      .exec();
  }
}