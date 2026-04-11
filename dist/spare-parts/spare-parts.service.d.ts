import { Model } from 'mongoose';
import { SparePart, SparePartDocument } from './schemas/spare-part.schema';
export declare class SparePartsService {
    private sparePartModel;
    constructor(sparePartModel: Model<SparePartDocument>);
    findAll(): Promise<SparePart[]>;
    findBySlug(slug: string): Promise<SparePart>;
    create(createSparePartDto: any): Promise<SparePart>;
    update(id: string, updateSparePartDto: any): Promise<SparePart>;
    delete(id: string): Promise<SparePart>;
}
