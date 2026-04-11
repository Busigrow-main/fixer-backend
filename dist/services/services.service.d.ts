import { Model } from 'mongoose';
import { Service, ServiceDocument } from './schemas/service.schema';
export declare class ServicesService {
    private serviceModel;
    constructor(serviceModel: Model<ServiceDocument>);
    findAll(): Promise<Service[]>;
    findBySlug(slug: string): Promise<Service>;
    create(createServiceDto: any): Promise<Service>;
    update(id: string, updateServiceDto: any): Promise<Service>;
    delete(id: string): Promise<Service>;
}
