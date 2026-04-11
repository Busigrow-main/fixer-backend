"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartOrdersService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const part_order_schema_1 = require("./schemas/part-order.schema");
let PartOrdersService = class PartOrdersService {
    partOrderModel;
    constructor(partOrderModel) {
        this.partOrderModel = partOrderModel;
    }
    async findAllByUser(userId) {
        return this.partOrderModel.find({ userId }).populate('items.partId').exec();
    }
    async findAllForAdmin() {
        return this.partOrderModel.find().populate('userId items.partId').exec();
    }
    async findOne(id) {
        const order = await this.partOrderModel.findById(id).populate('items.partId').exec();
        if (!order)
            throw new common_1.NotFoundException('Order not found');
        return order;
    }
    async create(createOrderDto, userId) {
        const createdOrder = new this.partOrderModel({ ...createOrderDto, userId });
        return createdOrder.save();
    }
    async updateStatus(id, status) {
        const updatedOrder = await this.partOrderModel.findByIdAndUpdate(id, { status }, { new: true }).exec();
        if (!updatedOrder)
            throw new common_1.NotFoundException('Order not found');
        return updatedOrder;
    }
    async attachTracking(id, trackingData) {
        const updatedOrder = await this.partOrderModel.findByIdAndUpdate(id, { courierTracking: trackingData, status: 'DISPATCHED' }, { new: true }).exec();
        if (!updatedOrder)
            throw new common_1.NotFoundException('Order not found');
        return updatedOrder;
    }
};
exports.PartOrdersService = PartOrdersService;
exports.PartOrdersService = PartOrdersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(part_order_schema_1.PartOrder.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], PartOrdersService);
//# sourceMappingURL=part-orders.service.js.map