"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartOrdersModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const part_orders_controller_1 = require("./part-orders.controller");
const part_orders_service_1 = require("./part-orders.service");
const part_order_schema_1 = require("./schemas/part-order.schema");
let PartOrdersModule = class PartOrdersModule {
};
exports.PartOrdersModule = PartOrdersModule;
exports.PartOrdersModule = PartOrdersModule = __decorate([
    (0, common_1.Module)({
        imports: [mongoose_1.MongooseModule.forFeature([{ name: part_order_schema_1.PartOrder.name, schema: part_order_schema_1.PartOrderSchema }])],
        controllers: [part_orders_controller_1.PartOrdersController],
        providers: [part_orders_service_1.PartOrdersService],
    })
], PartOrdersModule);
//# sourceMappingURL=part-orders.module.js.map