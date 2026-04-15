import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SparePart, SparePartDocument } from './schemas/spare-part.schema';

@Injectable()
export class SparePartsService {
  constructor(@InjectModel(SparePart.name) private sparePartModel: Model<SparePartDocument>) {}

  async findAll(queryObj: any): Promise<any> {
    const { q, category, page = 1, limit = 24 } = queryObj;
    const filter: any = {};

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
        { partNumber: { $regex: q, $options: 'i' } },
      ];
    }
    
    if (category && category !== 'All') {
      filter.category = category;
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.sparePartModel.find(filter).skip(skip).limit(parseInt(limit)).exec(),
      this.sparePartModel.countDocuments(filter).exec()
    ]);

    return {
      data,
      metadata: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getCategories(): Promise<string[]> {
    return this.sparePartModel.distinct('category').exec();
  }

  async findBySlug(slug: string): Promise<SparePart> {
    const sparePart = await this.sparePartModel.findOne({ slug }).exec();
    if (!sparePart) throw new NotFoundException('Spare Part not found');
    return sparePart;
  }

  async findById(id: string): Promise<SparePartDocument> {
    const sparePart = await this.sparePartModel.findById(id).exec();
    if (!sparePart) throw new NotFoundException('Spare Part not found');
    return sparePart;
  }

  async create(createSparePartDto: any): Promise<SparePart> {
    const createdSparePart = new this.sparePartModel(createSparePartDto);
    return createdSparePart.save();
  }

  async update(id: string, updateSparePartDto: any): Promise<SparePart> {
    const updatedSparePart = await this.sparePartModel.findByIdAndUpdate(id, updateSparePartDto, { returnDocument: 'after' }).exec();
    if (!updatedSparePart) throw new NotFoundException('Spare Part not found');
    return updatedSparePart;
  }

  async delete(id: string): Promise<SparePart> {
    const deletedSparePart = await this.sparePartModel.findByIdAndDelete(id).exec();
    if (!deletedSparePart) throw new NotFoundException('Spare Part not found');
    return deletedSparePart;
  }

  async countAll(): Promise<number> {
    return this.sparePartModel.countDocuments().exec();
  }

  async bulkUpsert(documents: any[]): Promise<any> {
    const BATCH_SIZE = 500;
    let totalInserted = 0;
    let totalUpdated = 0;
    const errors: { row: number; reason: string }[] = [];

    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      
      const operations = batch.map((doc, idx) => ({
        updateOne: {
          filter: { partNumber: doc.partNumber },
          update: { $set: doc },
          upsert: true
        }
      }));

      try {
        const result = await this.sparePartModel.bulkWrite(operations, { ordered: false });
        totalInserted += result.upsertedCount;
        totalUpdated += result.modifiedCount;
      } catch (err: any) {
        // Handle partial failures from ordered: false
        if (err.result) {
          totalInserted += err.result.nUpserted || 0;
          totalUpdated += err.result.nModified || 0;
        }
        // Capture individual write errors
        if (err.writeErrors) {
          err.writeErrors.forEach((we: any) => {
            errors.push({ row: i + we.index + 1, reason: we.errmsg || 'Write error' });
          });
        }
      }
    }

    return {
      totalProcessed: documents.length,
      inserted: totalInserted,
      updated: totalUpdated,
      failed: errors.length,
      errors: errors.slice(0, 100), // Cap error reporting
    };
  }

  async exportAll(): Promise<SparePartDocument[]> {
    return this.sparePartModel.find().lean().exec();
  }
}
