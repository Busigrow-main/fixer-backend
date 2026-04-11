import { ServicesService } from './services.service';
export declare class ServicesController {
    private readonly servicesService;
    constructor(servicesService: ServicesService);
    findAll(): Promise<import("./schemas/service.schema").Service[]>;
    findOne(slug: string): Promise<import("./schemas/service.schema").Service>;
    create(createServiceDto: any): Promise<import("./schemas/service.schema").Service>;
    update(id: string, updateServiceDto: any): Promise<import("./schemas/service.schema").Service>;
    delete(id: string): Promise<import("./schemas/service.schema").Service>;
}
