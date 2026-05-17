import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PartOrder, PartOrderDocument } from './schemas/part-order.schema';
import { CreatePartOrderDto } from './dtos/create-part-order.dto';

@Injectable()
export class PartOrdersService {
  constructor(@InjectModel(PartOrder.name) private partOrderModel: Model<PartOrderDocument>) {}

  async findAllByUser(userId: string): Promise<PartOrder[]> {
    return this.partOrderModel
      .find({ userId })
      .populate('items.partId')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findAllForAdmin(page = 1, limit = 20, status?: string): Promise<{ data: PartOrder[]; total: number }> {
    const filter: Record<string, unknown> = {};
    if (status && status !== 'ALL') filter.status = status;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.partOrderModel
        .find(filter)
        .populate('userId items.partId')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      this.partOrderModel.countDocuments(filter).exec(),
    ]);
    return { data, total };
  }

  async findOne(id: string): Promise<PartOrder> {
    const order = await this.partOrderModel.findById(id).populate('userId items.partId').exec();
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async create(createOrderDto: CreatePartOrderDto, userId: string): Promise<PartOrder> {
    const orderType = createOrderDto.orderType ?? 'part';

    if (orderType === 'appliance') {
      if (!createOrderDto.applianceItem) {
        throw new BadRequestException('applianceItem is required for appliance enquiries');
      }
      const createdOrder = new this.partOrderModel({
        orderType: 'appliance',
        contactData: createOrderDto.contactData,
        applianceItem: createOrderDto.applianceItem,
        items: [],
        userId,
      });
      return createdOrder.save();
    }

    const items = createOrderDto.items ?? [];
    if (items.length === 0) {
      throw new BadRequestException('At least one spare part is required');
    }

    const createdOrder = new this.partOrderModel({
      orderType: 'part',
      contactData: createOrderDto.contactData,
      items,
      userId,
    });
    return createdOrder.save();
  }

  async updateStatus(id: string, status: string): Promise<PartOrder> {
    const updatedOrder = await this.partOrderModel
      .findByIdAndUpdate(id, { status }, { returnDocument: 'after' })
      .exec();
    if (!updatedOrder) throw new NotFoundException('Order not found');
    return updatedOrder;
  }

  async attachTracking(id: string, trackingData: { courierName: string; trackingNumber: string }): Promise<PartOrder> {
    const updatedOrder = await this.partOrderModel
      .findByIdAndUpdate(
        id,
        { courierTracking: trackingData, status: 'DISPATCHED' },
        { returnDocument: 'after' },
      )
      .exec();
    if (!updatedOrder) throw new NotFoundException('Order not found');
    return updatedOrder;
  }

  async countByStatus(): Promise<Record<string, number>> {
    const results = await this.partOrderModel
      .aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
      .exec();

    const counts: Record<string, number> = {};
    results.forEach((r: { _id: string; count: number }) => {
      counts[r._id] = r.count;
    });
    return counts;
  }

  async countAll(): Promise<number> {
    return this.partOrderModel.countDocuments().exec();
  }
}
