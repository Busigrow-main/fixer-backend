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
exports.PartOrdersController = void 0;
const common_1 = require("@nestjs/common");
const part_orders_service_1 = require("./part-orders.service");
const passport_1 = require("@nestjs/passport");
let PartOrdersController = class PartOrdersController {
    partOrdersService;
    constructor(partOrdersService) {
        this.partOrdersService = partOrdersService;
    }
    async getUserOrders(req) {
        return this.partOrdersService.findAllByUser(req.user.userId);
    }
    async createOrder(req, createOrderDto) {
        return this.partOrdersService.create(createOrderDto, req.user.userId);
    }
    async getAdminOrders() {
        return this.partOrdersService.findAllForAdmin();
    }
    async getAdminOrderDetails(id) {
        return this.partOrdersService.findOne(id);
    }
    async updateStatus(id, status) {
        return this.partOrdersService.updateStatus(id, status);
    }
    async attachTracking(id, trackingData) {
        return this.partOrdersService.attachTracking(id, trackingData);
    }
};
exports.PartOrdersController = PartOrdersController;
__decorate([
    (0, common_1.Get)('user/part-orders'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PartOrdersController.prototype, "getUserOrders", null);
__decorate([
    (0, common_1.Post)('part-orders'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PartOrdersController.prototype, "createOrder", null);
__decorate([
    (0, common_1.Get)('admin/part-orders'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PartOrdersController.prototype, "getAdminOrders", null);
__decorate([
    (0, common_1.Get)('admin/part-orders/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PartOrdersController.prototype, "getAdminOrderDetails", null);
__decorate([
    (0, common_1.Put)('admin/part-orders/:id/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PartOrdersController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Put)('admin/part-orders/:id/tracking'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PartOrdersController.prototype, "attachTracking", null);
exports.PartOrdersController = PartOrdersController = __decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Controller)('api/v1'),
    __metadata("design:paramtypes", [part_orders_service_1.PartOrdersService])
], PartOrdersController);
//# sourceMappingURL=part-orders.controller.js.map