import { Document, Types } from 'mongoose';
export type PartOrderDocument = PartOrder & Document;
export declare class OrderItem {
    partId: Types.ObjectId;
    quantity: number;
    priceAtPurchase: string;
}
export declare const OrderItemSchema: import("mongoose").Schema<OrderItem, import("mongoose").Model<OrderItem, any, any, any, any, any, OrderItem>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, OrderItem, Document<unknown, {}, OrderItem, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<OrderItem & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    partId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, OrderItem, Document<unknown, {}, OrderItem, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<OrderItem & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    quantity?: import("mongoose").SchemaDefinitionProperty<number, OrderItem, Document<unknown, {}, OrderItem, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<OrderItem & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    priceAtPurchase?: import("mongoose").SchemaDefinitionProperty<string, OrderItem, Document<unknown, {}, OrderItem, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<OrderItem & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, OrderItem>;
export declare class PartOrder {
    userId: Types.ObjectId;
    contactData: {
        name: string;
        phone: string;
        email?: string;
        address: string;
    };
    items: Types.DocumentArray<OrderItem>;
    status: string;
    courierTracking?: {
        courierName: string;
        trackingNumber: string;
    };
}
export declare const PartOrderSchema: import("mongoose").Schema<PartOrder, import("mongoose").Model<PartOrder, any, any, any, any, any, PartOrder>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, PartOrder, Document<unknown, {}, PartOrder, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<PartOrder & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    userId?: import("mongoose").SchemaDefinitionProperty<Types.ObjectId, PartOrder, Document<unknown, {}, PartOrder, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PartOrder & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    contactData?: import("mongoose").SchemaDefinitionProperty<{
        name: string;
        phone: string;
        email?: string;
        address: string;
    }, PartOrder, Document<unknown, {}, PartOrder, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PartOrder & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    items?: import("mongoose").SchemaDefinitionProperty<Types.DocumentArray<OrderItem, Types.Subdocument<import("bson").ObjectId, unknown, OrderItem, {}, {}> & OrderItem>, PartOrder, Document<unknown, {}, PartOrder, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PartOrder & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<string, PartOrder, Document<unknown, {}, PartOrder, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PartOrder & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    courierTracking?: import("mongoose").SchemaDefinitionProperty<{
        courierName: string;
        trackingNumber: string;
    } | undefined, PartOrder, Document<unknown, {}, PartOrder, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<PartOrder & {
        _id: Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, PartOrder>;
