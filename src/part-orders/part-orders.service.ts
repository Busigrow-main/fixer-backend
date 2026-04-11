import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PartOrder, PartOrderDocument } from './schemas/part-order.schema';

@Injectable()
export class PartOrdersService {
  constructor(@InjectModel(PartOrder.name) private partOrderModel: Model<PartOrderDocument>) {}

  async findAllByUser(userId: string): Promise<PartOrder[]> {
    return this.partOrderModel.find({ userId }).populate('items.partId').exec();
  }

  async findAllForAdmin(): Promise<PartOrder[]> {
    return this.partOrderModel.find().populate('userId items.partId').exec();
  }

  async findOne(id: string): Promise<PartOrder> {
    const order = await this.partOrderModel.findById(id).populate('items.partId').exec();
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async create(createOrderDto: any, userId: string): Promise<PartOrder> {
    const createdOrder = new this.partOrderModel({ ...createOrderDto, userId });
    return createdOrder.save();
  }

  async updateStatus(id: string, status: string): Promise<PartOrder> {
    const updatedOrder = await this.partOrderModel.findByIdAndUpdate(id, { status }, { new: true }).exec();
    if (!updatedOrder) throw new NotFoundException('Order not found');
    return updatedOrder;
  }

  async attachTracking(id: string, trackingData: any): Promise<PartOrder> {
    const updatedOrder = await this.partOrderModel.findByIdAndUpdate(
      id,
      { courierTracking: trackingData, status: 'DISPATCHED' },
      { new: true }
    ).exec();
    if (!updatedOrder) throw new NotFoundException('Order not found');
    return updatedOrder;
  }
}
