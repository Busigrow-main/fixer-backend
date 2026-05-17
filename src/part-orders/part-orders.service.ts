import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PartOrder, PartOrderDocument } from './schemas/part-order.schema';
import { CreatePartOrderDto } from './dtos/create-part-order.dto';
import { UpdateOrderBillDto } from './dtos/update-order-bill.dto';

function computeInvoiceTotals(lineItems: { quantity: number; unitPrice: number }[], taxPercent = 0) {
  const normalized = lineItems.map((row) => ({
    ...row,
    amount: Math.round(row.quantity * row.unitPrice * 100) / 100,
  }));
  const subtotal = normalized.reduce((sum, row) => sum + row.amount, 0);
  const taxAmount = Math.round(subtotal * (taxPercent / 100) * 100) / 100;
  const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
  return { lineItems: normalized, subtotal, taxAmount, totalAmount };
}

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

  async findAllForAdmin(
    page = 1,
    limit = 20,
    status?: string,
    orderType?: 'part' | 'appliance',
  ): Promise<{ data: PartOrder[]; total: number }> {
    const filter: Record<string, unknown> = {};
    if (status && status !== 'ALL') filter.status = status;
    if (orderType) filter.orderType = orderType;

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

  buildDefaultBillLines(order: PartOrder): { description: string; quantity: number; unitPrice: number }[] {
    if (order.orderType === 'appliance' && order.applianceItem) {
      const item = order.applianceItem;
      return [
        {
          description: item.modelNumber
            ? `${item.name} (${item.modelNumber})`
            : item.name,
          quantity: item.quantity ?? 1,
          unitPrice: item.price ?? 0,
        },
      ];
    }

    return (order.items ?? []).map((row: any) => {
      const part = row.partId;
      const pricePaise = typeof part?.price === 'number' ? part.price : 0;
      return {
        description: part?.name || 'Spare Part',
        quantity: row.quantity ?? 1,
        unitPrice: Math.round((pricePaise / 100) * 100) / 100,
      };
    });
  }

  async upsertBill(id: string, dto: UpdateOrderBillDto): Promise<PartOrder> {
    const order = await this.partOrderModel.findById(id).populate('items.partId').exec();
    if (!order) throw new NotFoundException('Order not found');

    if (!dto.lineItems?.length) {
      throw new BadRequestException('At least one line item is required');
    }

    const taxPercent = dto.taxPercent ?? order.invoiceData?.taxPercent ?? 0;
    const { lineItems, subtotal, taxAmount, totalAmount } = computeInvoiceTotals(
      dto.lineItems,
      taxPercent,
    );

    const updated = await this.partOrderModel
      .findByIdAndUpdate(
        id,
        {
          invoiceData: {
            lineItems,
            subtotal,
            taxPercent,
            taxAmount,
            totalAmount,
            notes: dto.notes ?? order.invoiceData?.notes,
            generatedAt: order.invoiceData?.generatedAt ?? new Date(),
            finalizedAt: order.invoiceData?.finalizedAt,
          },
        },
        { returnDocument: 'after' },
      )
      .populate('userId items.partId')
      .exec();

    if (!updated) throw new NotFoundException('Order not found');
    return updated;
  }

  async markPaymentComplete(id: string): Promise<PartOrder> {
    const order = await this.partOrderModel.findById(id).populate('items.partId').exec();
    if (!order) throw new NotFoundException('Order not found');

    let invoiceData = order.invoiceData;
    if (!invoiceData?.lineItems?.length) {
      const defaults = this.buildDefaultBillLines(order);
      if (!defaults.length) {
        throw new BadRequestException('Cannot generate bill: no line items on this order');
      }
      const computed = computeInvoiceTotals(defaults, 0);
      invoiceData = {
        lineItems: computed.lineItems as any,
        subtotal: computed.subtotal,
        taxPercent: 0,
        taxAmount: computed.taxAmount,
        totalAmount: computed.totalAmount,
        generatedAt: new Date(),
      } as any;
    }

    const updated = await this.partOrderModel
      .findByIdAndUpdate(
        id,
        {
          paymentStatus: 'PAID',
          isBilled: true,
          status: order.status === 'PENDING' ? 'PROCESSING' : order.status,
          invoiceData: {
            ...invoiceData,
            finalizedAt: new Date(),
          },
        },
        { returnDocument: 'after' },
      )
      .populate('userId items.partId')
      .exec();

    if (!updated) throw new NotFoundException('Order not found');
    return updated;
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

  async countByOrderType(orderType: 'part' | 'appliance'): Promise<number> {
    return this.partOrderModel.countDocuments({ orderType }).exec();
  }
}
