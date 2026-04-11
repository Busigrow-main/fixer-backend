import { PartOrdersService } from './part-orders.service';
export declare class PartOrdersController {
    private readonly partOrdersService;
    constructor(partOrdersService: PartOrdersService);
    getUserOrders(req: any): Promise<import("./schemas/part-order.schema").PartOrder[]>;
    createOrder(req: any, createOrderDto: any): Promise<import("./schemas/part-order.schema").PartOrder>;
    getAdminOrders(): Promise<import("./schemas/part-order.schema").PartOrder[]>;
    getAdminOrderDetails(id: string): Promise<import("./schemas/part-order.schema").PartOrder>;
    updateStatus(id: string, status: string): Promise<import("./schemas/part-order.schema").PartOrder>;
    attachTracking(id: string, trackingData: {
        courierName: string;
        trackingNumber: string;
    }): Promise<import("./schemas/part-order.schema").PartOrder>;
}
