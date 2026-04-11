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
exports.SparePartsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const spare_part_schema_1 = require("./schemas/spare-part.schema");
let SparePartsService = class SparePartsService {
    sparePartModel;
    constructor(sparePartModel) {
        this.sparePartModel = sparePartModel;
    }
    async findAll() {
        return this.sparePartModel.find().exec();
    }
    async findBySlug(slug) {
        const sparePart = await this.sparePartModel.findOne({ slug }).exec();
        if (!sparePart)
            throw new common_1.NotFoundException('Spare Part not found');
        return sparePart;
    }
    async create(createSparePartDto) {
        const createdSparePart = new this.sparePartModel(createSparePartDto);
        return createdSparePart.save();
    }
    async update(id, updateSparePartDto) {
        const updatedSparePart = await this.sparePartModel.findByIdAndUpdate(id, updateSparePartDto, { new: true }).exec();
        if (!updatedSparePart)
            throw new common_1.NotFoundException('Spare Part not found');
        return updatedSparePart;
    }
    async delete(id) {
        const deletedSparePart = await this.sparePartModel.findByIdAndDelete(id).exec();
        if (!deletedSparePart)
            throw new common_1.NotFoundException('Spare Part not found');
        return deletedSparePart;
    }
};
exports.SparePartsService = SparePartsService;
exports.SparePartsService = SparePartsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(spare_part_schema_1.SparePart.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], SparePartsService);
//# sourceMappingURL=spare-parts.service.js.map