import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SparePartsService } from '../spare-parts/spare-parts.service';
import { PartOrdersService } from '../part-orders/part-orders.service';
import { CreatePartOrderDto } from '../part-orders/dtos/create-part-order.dto';
import { CreateShopPartHelpDto } from './dtos/create-shop-part-help.dto';
import { QuoteShopPartHelpDto } from './dtos/quote-shop-part-help.dto';
import {
  ShopPartHelpRequest,
  ShopPartHelpRequestDocument,
} from './schemas/shop-part-help.schema';

@Injectable()
export class ShopPartHelpService {
  constructor(
    @InjectModel(ShopPartHelpRequest.name)
    private readonly helpRequestModel: Model<ShopPartHelpRequestDocument>,
    private readonly sparePartsService: SparePartsService,
    private readonly partOrdersService: PartOrdersService,
  ) {}

  async create(dto: CreateShopPartHelpDto, userId: string) {
    let requestedSparePartId: Types.ObjectId | undefined;
    if (dto.requestedSparePartId) {
      const part = await this.sparePartsService.findById(dto.requestedSparePartId);
      if (!part.isActive) {
        throw new BadRequestException('Selected spare part is no longer active');
      }
      requestedSparePartId = new Types.ObjectId(dto.requestedSparePartId);
    }

    const request = new this.helpRequestModel({
      ...dto,
      requestedSparePartId,
      quantity: dto.quantity ?? 1,
      userId: new Types.ObjectId(userId),
      status: 'PENDING',
    });
    return request.save();
  }

  async findAllForUser(userId: string) {
    return this.helpRequestModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('requestedSparePartId suggestedSparePartId convertedPartOrderId')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOneForUser(id: string, userId: string) {
    return this.findOwnedRequest(id, userId);
  }

  async findAllForAdmin(page = 1, limit = 20, status?: string) {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.helpRequestModel
        .find(filter)
        .populate('userId requestedSparePartId suggestedSparePartId convertedPartOrderId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.helpRequestModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page, limit };
  }

  async findOneForAdmin(id: string) {
    const request = await this.findRequest(id);
    return request.populate('userId suggestedSparePartId convertedPartOrderId');
  }

  async quote(id: string, dto: QuoteShopPartHelpDto) {
    const request = await this.findRequest(id);
    if (!['PENDING', 'QUOTED'].includes(request.status)) {
      throw new ConflictException('This request can no longer be quoted');
    }

    let suggestedSparePartId: Types.ObjectId | undefined;
    if (dto.suggestedSparePartId) {
      const part = await this.sparePartsService.findById(dto.suggestedSparePartId);
      if (!part.isActive) {
        throw new BadRequestException('Suggested spare part is not active');
      }
      suggestedSparePartId = new Types.ObjectId(dto.suggestedSparePartId);
    }
    if (dto.isAvailable && (!suggestedSparePartId || dto.quotedPrice == null)) {
      throw new BadRequestException(
        'An available quote requires a suggested part and quoted price',
      );
    }

    const updated = await this.helpRequestModel
      .findOneAndUpdate(
        { _id: request._id, status: { $in: ['PENDING', 'QUOTED'] } },
        {
          $set: {
            status: 'QUOTED',
            suggestedSparePartId: suggestedSparePartId ?? null,
            quotedPrice: dto.quotedPrice ?? null,
            isAvailable: dto.isAvailable,
            adminResponse: dto.adminResponse,
          },
        },
        { returnDocument: 'after', runValidators: true },
      )
      .populate('suggestedSparePartId')
      .exec();
    if (!updated) throw new ConflictException('Request status changed; reload and retry');
    return updated;
  }

  async accept(id: string, userId: string) {
    let request = await this.findOwnedRequest(id, userId, false);

    if (request.convertedPartOrderId) {
      const existing = await this.partOrdersService.findBySourceHelpRequestId(id);
      return existing ?? this.partOrdersService.findOne(String(request.convertedPartOrderId));
    }
    if (request.status === 'ACCEPTED') {
      const existing = await this.partOrdersService.findBySourceHelpRequestId(id);
      if (existing) {
        await this.markConverted(request._id, new Types.ObjectId(String((existing as any)._id)));
        return existing;
      }
    } else if (request.status !== 'QUOTED') {
      throw new ConflictException('Only a quoted request can be accepted');
    }

    if (request.isAvailable !== true || !request.suggestedSparePartId || request.quotedPrice == null) {
      throw new BadRequestException('This request does not have an available quote');
    }

    const part = await this.sparePartsService.findById(String(request.suggestedSparePartId));
    if (!part.isActive) throw new BadRequestException('Quoted spare part is no longer active');
    const acceptedPrice = request.quotedPrice;
    if (acceptedPrice == null) throw new BadRequestException('Quoted price is missing');

    if (request.status === 'QUOTED') {
      const claimed = await this.helpRequestModel
        .findOneAndUpdate(
          {
            _id: request._id,
            userId: new Types.ObjectId(userId),
            status: 'QUOTED',
            isAvailable: true,
          },
          { $set: { status: 'ACCEPTED', acceptedAt: new Date() } },
          { returnDocument: 'after' },
        )
        .exec();
      if (!claimed) {
        request = await this.findOwnedRequest(id, userId, false);
        if (request.convertedPartOrderId) {
          return this.partOrdersService.findOne(String(request.convertedPartOrderId));
        }
        if (request.status !== 'ACCEPTED') {
          throw new ConflictException('Request status changed; reload and retry');
        }
      } else {
        request = claimed;
      }
    }

    const orderDto: CreatePartOrderDto = {
      orderType: 'part',
      contactData: {
        name: request.contactData.name,
        phone: request.contactData.phone,
        email: request.contactData.email,
        address: request.contactData.address,
        notes: request.notes,
      },
      items: [
        {
          partId: String(request.suggestedSparePartId),
          quantity: request.quantity,
        },
      ],
    };
    const order = await this.partOrdersService.create(orderDto, userId, {
      sourceHelpRequestId: id,
      acceptedQuote: {
        description: part.name,
        quantity: request.quantity,
        unitPrice: acceptedPrice,
      },
    });

    await this.markConverted(request._id, new Types.ObjectId(String((order as any)._id)));
    return order;
  }

  async decline(id: string, userId: string) {
    const request = await this.helpRequestModel
      .findOneAndUpdate(
        { _id: this.asObjectId(id), userId: new Types.ObjectId(userId), status: 'QUOTED' },
        { $set: { status: 'DECLINED', declinedAt: new Date() } },
        { returnDocument: 'after' },
      )
      .exec();
    if (!request) {
      const existing = await this.findOwnedRequest(id, userId);
      throw new ConflictException(`Cannot decline a request in ${existing.status} state`);
    }
    return request;
  }

  async cancel(id: string, userId: string) {
    const request = await this.helpRequestModel
      .findOneAndUpdate(
        {
          _id: this.asObjectId(id),
          userId: new Types.ObjectId(userId),
          status: { $in: ['PENDING', 'QUOTED'] },
        },
        { $set: { status: 'CANCELLED', cancelledAt: new Date() } },
        { returnDocument: 'after' },
      )
      .exec();
    if (!request) {
      const existing = await this.findOwnedRequest(id, userId);
      throw new ConflictException(`Cannot cancel a request in ${existing.status} state`);
    }
    return request;
  }

  private async markConverted(requestId: Types.ObjectId, orderId: Types.ObjectId) {
    return this.helpRequestModel
      .findOneAndUpdate(
        { _id: requestId, status: 'ACCEPTED', convertedPartOrderId: { $exists: false } },
        { $set: { status: 'CONVERTED', convertedPartOrderId: orderId } },
        { returnDocument: 'after' },
      )
      .exec();
  }

  private async findOwnedRequest(id: string, userId: string, populate = true) {
    const query = this.helpRequestModel.findOne({
      _id: this.asObjectId(id),
      userId: new Types.ObjectId(userId),
    });
    const request = await (populate
      ? query.populate('suggestedSparePartId convertedPartOrderId')
      : query
    ).exec();
    if (!request) throw new NotFoundException('Shop part-help request not found');
    return request;
  }

  private async findRequest(id: string) {
    const request = await this.helpRequestModel.findById(this.asObjectId(id)).exec();
    if (!request) throw new NotFoundException('Shop part-help request not found');
    return request;
  }

  private asObjectId(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Shop part-help request not found');
    return new Types.ObjectId(id);
  }
}
