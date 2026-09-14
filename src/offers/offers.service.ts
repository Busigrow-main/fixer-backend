import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  OFFER_AUDIENCES,
  OFFER_THEMES,
  Offer,
  OfferDocument,
} from './schemas/offer.schema';

type OfferInput = Partial<Offer> & Pick<Offer, 'title' | 'discountText'>;

@Injectable()
export class OffersService {
  constructor(
    @InjectModel(Offer.name)
    private readonly offerModel: Model<OfferDocument>,
  ) {}

  private cleanText(value: unknown, maxLength: number): string {
    return String(value ?? '').trim().slice(0, maxLength);
  }

  private cleanHref(value: unknown): string {
    const href = this.cleanText(value || '/services', 500);
    if (href.startsWith('/') || /^https:\/\/[^ ]+$/i.test(href)) return href;
    throw new BadRequestException(
      'CTA link must be a local path or an HTTPS URL',
    );
  }

  private cleanImageUrl(value: unknown): string {
    const url = this.cleanText(value, 1000);
    if (!url || /^https:\/\/[^ ]+$/i.test(url)) return url;
    throw new BadRequestException('Background image must use an HTTPS URL');
  }

  private cleanDate(value: unknown): Date | null {
    if (!value) return null;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid offer date');
    }
    return date;
  }

  private normalize(input: OfferInput) {
    const title = this.cleanText(input.title, 90);
    const discountText = this.cleanText(input.discountText, 40);
    if (!title) throw new BadRequestException('Offer title is required');
    if (!discountText) {
      throw new BadRequestException('Discount text is required');
    }

    const startsAt = this.cleanDate(input.startsAt);
    const endsAt = this.cleanDate(input.endsAt);
    if (startsAt && endsAt && endsAt <= startsAt) {
      throw new BadRequestException('End date must be after start date');
    }

    const theme = String(input.theme || 'RED').toUpperCase();
    const audience = String(input.audience || 'ALL').toUpperCase();
    if (!(OFFER_THEMES as readonly string[]).includes(theme)) {
      throw new BadRequestException('Invalid offer theme');
    }
    if (!(OFFER_AUDIENCES as readonly string[]).includes(audience)) {
      throw new BadRequestException('Invalid offer audience');
    }

    return {
      title,
      discountText,
      description: this.cleanText(input.description, 180),
      badge: this.cleanText(input.badge || 'Limited time', 32),
      couponCode: this.cleanText(input.couponCode, 24).toUpperCase(),
      imageUrl: this.cleanImageUrl(input.imageUrl),
      ctaLabel: this.cleanText(input.ctaLabel || 'Explore offer', 32),
      ctaHref: this.cleanHref(input.ctaHref),
      theme,
      audience,
      terms: this.cleanText(input.terms, 240),
      isActive: input.isActive !== false,
      startsAt,
      endsAt,
      priority: Math.max(0, Number(input.priority) || 0),
    };
  }

  async findLive() {
    const now = new Date();
    return this.offerModel
      .find({
        isActive: true,
        $and: [
          { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
          { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
        ],
      })
      .sort({ priority: -1, createdAt: -1 })
      .limit(12)
      .lean()
      .exec();
  }

  async findAll(page = 1, limit = 50) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;
    const [data, total] = await Promise.all([
      this.offerModel
        .find()
        .sort({ priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean()
        .exec(),
      this.offerModel.countDocuments().exec(),
    ]);
    return { data, total, page: safePage, limit: safeLimit };
  }

  async create(input: OfferInput) {
    return this.offerModel.create(this.normalize(input));
  }

  async update(id: string, input: OfferInput) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid offer id');
    }
    const offer = await this.offerModel
      .findByIdAndUpdate(id, { $set: this.normalize(input) }, { new: true })
      .exec();
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }

  async setActive(id: string, isActive: boolean) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid offer id');
    }
    const offer = await this.offerModel
      .findByIdAndUpdate(id, { $set: { isActive } }, { new: true })
      .exec();
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid offer id');
    }
    const offer = await this.offerModel.findByIdAndDelete(id).exec();
    if (!offer) throw new NotFoundException('Offer not found');
    return { deleted: true };
  }
}
