import { Document } from 'mongoose';
export type SparePartDocument = SparePart & Document;
export declare class SparePart {
    slug: string;
    name: string;
    category: string;
    price: string;
    manufacturer: string;
    seller: string;
    deliveryEta: string;
    warranty: string;
    supportsServiceBooking: boolean;
    compatibleModels: string[];
    highlights: string[];
    image: string;
    description: string;
}
export declare const SparePartSchema: import("mongoose").Schema<SparePart, import("mongoose").Model<SparePart, any, any, any, any, any, SparePart>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, SparePart, Document<unknown, {}, SparePart, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<SparePart & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    slug?: import("mongoose").SchemaDefinitionProperty<string, SparePart, Document<unknown, {}, SparePart, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<SparePart & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    name?: import("mongoose").SchemaDefinitionProperty<string, SparePart, Document<unknown, {}, SparePart, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<SparePart & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    category?: import("mongoose").SchemaDefinitionProperty<string, SparePart, Document<unknown, {}, SparePart, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<SparePart & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    price?: import("mongoose").SchemaDefinitionProperty<string, SparePart, Document<unknown, {}, SparePart, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<SparePart & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    manufacturer?: import("mongoose").SchemaDefinitionProperty<string, SparePart, Document<unknown, {}, SparePart, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<SparePart & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    seller?: import("mongoose").SchemaDefinitionProperty<string, SparePart, Document<unknown, {}, SparePart, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<SparePart & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    deliveryEta?: import("mongoose").SchemaDefinitionProperty<string, SparePart, Document<unknown, {}, SparePart, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<SparePart & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    warranty?: import("mongoose").SchemaDefinitionProperty<string, SparePart, Document<unknown, {}, SparePart, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<SparePart & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    supportsServiceBooking?: import("mongoose").SchemaDefinitionProperty<boolean, SparePart, Document<unknown, {}, SparePart, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<SparePart & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    compatibleModels?: import("mongoose").SchemaDefinitionProperty<string[], SparePart, Document<unknown, {}, SparePart, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<SparePart & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    highlights?: import("mongoose").SchemaDefinitionProperty<string[], SparePart, Document<unknown, {}, SparePart, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<SparePart & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    image?: import("mongoose").SchemaDefinitionProperty<string, SparePart, Document<unknown, {}, SparePart, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<SparePart & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    description?: import("mongoose").SchemaDefinitionProperty<string, SparePart, Document<unknown, {}, SparePart, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<SparePart & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, SparePart>;
