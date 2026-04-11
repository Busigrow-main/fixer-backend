import { SparePartsService } from './spare-parts.service';
export declare class SparePartsController {
    private readonly sparePartsService;
    constructor(sparePartsService: SparePartsService);
    findAll(): Promise<import("./schemas/spare-part.schema").SparePart[]>;
    findOne(slug: string): Promise<import("./schemas/spare-part.schema").SparePart>;
    create(createSparePartDto: any): Promise<import("./schemas/spare-part.schema").SparePart>;
    update(id: string, updateSparePartDto: any): Promise<import("./schemas/spare-part.schema").SparePart>;
    delete(id: string): Promise<import("./schemas/spare-part.schema").SparePart>;
}
