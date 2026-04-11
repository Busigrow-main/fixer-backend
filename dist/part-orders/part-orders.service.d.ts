import { Model } from 'mongoose';
import { PartOrder, PartOrderDocument } from './schemas/part-order.schema';
export declare class PartOrdersService {
    private partOrderModel;
    constructor(partOrderModel: Model<PartOrderDocument>);
    findAllByUser(userId: string): Promise<PartOrder[]>;
    findAllForAdmin(): Promise<PartOrder[]>;
    findOne(id: string): Promise<PartOrder>;
    create(createOrderDto: any, userId: string): Promise<PartOrder>;
    updateStatus(id: string, status: string): Promise<PartOrder>;
    attachTracking(id: string, trackingData: any): Promise<PartOrder>;
}
