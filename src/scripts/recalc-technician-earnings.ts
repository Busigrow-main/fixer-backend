/**
 * Recalculate technician earnings for paid jobs using the current split:
 * 100% service charges, 10% inventory-parts commission, ₹100/line outside-parts fee.
 *
 * Usage: npx ts-node -r tsconfig-paths/register src/scripts/recalc-technician-earnings.ts
 */
import * as dotenv from 'dotenv';
import mongoose, { Types } from 'mongoose';
import {
  buildTechnicianPayoutLines,
  collectPartsFromVisits,
  computeTechnicianSettlement,
  type SettlementPart,
} from '../technician-platform/settlement';

dotenv.config();

const PAYOUT_TYPES = ['LABOUR', 'PARTS', 'SELF_PART_FEE'];

function resolveTechnicianId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Types.ObjectId) return value.toString();
  if (typeof value === 'object' && value && '_id' in (value as any)) {
    return String((value as any)._id);
  }
  return String(value);
}

function partsFromInvoice(invoice: any): SettlementPart[] {
  return (invoice?.spareParts || []).map((p: any) => ({
    isThirdParty: !!p.isThirdParty,
    sourcedBy: p.isThirdParty ? 'SELF' : 'INVENTORY',
    cost: Number(p.cost) || 0,
    quantity: p.quantity || 1,
  }));
}

async function recalc() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/fixxer';
  await mongoose.connect(uri);
  const db = mongoose.connection.db!;
  const earnings = db.collection('earnings');
  const bookings = db.collection('bookings');
  const visits = db.collection('visits');
  const usages = db.collection('sparepartusages');

  const existing = await earnings
    .find({ type: { $in: PAYOUT_TYPES }, bookingId: { $exists: true, $ne: null } })
    .toArray();

  const paidBookings = await bookings
    .find({
      technicianId: { $ne: null },
      $or: [
        { status: 'PAYMENT_COLLECTED' },
        { paymentStatus: { $in: ['PAID_CASH', 'PAID_ONLINE'] } },
        { jobClosed: true },
      ],
    })
    .project({
      _id: 1,
      technicianId: 1,
      invoiceData: 1,
      jobPaymentMethod: 1,
      paymentStatus: 1,
    })
    .toArray();

  const byBooking = new Map<string, typeof existing>();
  for (const row of existing) {
    const id = String(row.bookingId);
    if (!byBooking.has(id)) byBooking.set(id, []);
    byBooking.get(id)!.push(row);
  }

  const bookingIds = [
    ...new Set([
      ...[...byBooking.keys()],
      ...paidBookings.map((b) => String(b._id)),
    ]),
  ].map((id) => new Types.ObjectId(id));

  const bookingDocs = await bookings.find({ _id: { $in: bookingIds } }).toArray();
  const visitDocs = await visits.find({ bookingId: { $in: bookingIds } }).toArray();
  const usageIds = visitDocs.flatMap((v) => v.partsUsed || []);
  const usageDocs = usageIds.length
    ? await usages.find({ _id: { $in: usageIds } }).toArray()
    : [];
  const usageById = new Map(usageDocs.map((u) => [String(u._id), u]));

  let updated = 0;
  let skipped = 0;
  const reports: Array<Record<string, unknown>> = [];

  for (const booking of bookingDocs) {
    const bookingId = String(booking._id);
    const technicianId = resolveTechnicianId(booking.technicianId);
    if (!technicianId) {
      skipped += 1;
      continue;
    }

    const previous = byBooking.get(bookingId) || [];
    const bookingVisits = visitDocs.filter(
      (v) => String(v.bookingId) === bookingId,
    );
    const visitParts = bookingVisits.flatMap((v) =>
      (v.partsUsed || [])
        .map((id: any) => usageById.get(String(id)))
        .filter(Boolean),
    ) as SettlementPart[];
    const parts =
      visitParts.length > 0
        ? visitParts
        : partsFromInvoice(booking.invoiceData);

    const settlement = computeTechnicianSettlement({
      serviceTotal: booking.invoiceData?.serviceTotal || 0,
      additionalCharges: booking.invoiceData?.additionalCharges || [],
      parts,
    });
    const lines = buildTechnicianPayoutLines(settlement, bookingId, {
      includeFees: true,
    });

    const prevNet = previous.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const earnedAt =
      previous[0]?.earnedAt instanceof Date
        ? previous[0].earnedAt
        : previous[0]?.earnedAt
          ? new Date(previous[0].earnedAt)
          : new Date();
    const paymentMethod =
      (booking.jobPaymentMethod as string) ||
      previous[0]?.paymentMethod ||
      (booking.paymentStatus === 'PAID_ONLINE' ? 'UPI' : 'CASH');

    await earnings.deleteMany({
      bookingId: booking._id,
      type: { $in: PAYOUT_TYPES },
    });
    if (lines.length) {
      await earnings.insertMany(
        lines.map((line) => ({
          technicianId: new Types.ObjectId(technicianId),
          bookingId: booking._id,
          amount: line.amount,
          type: line.type,
          paymentMethod,
          description: line.description,
          earnedAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );
    }

    updated += 1;
    reports.push({
      bookingId,
      previousNet: prevNet,
      technicianNet: settlement.technicianNet,
      fixxerNet: settlement.fixxerNet,
      lines: lines.map((l) => `${l.type}:${l.amount}`),
    });
  }

  console.log(`Updated ${updated} jobs, skipped ${skipped}.`);
  for (const row of reports) {
    console.log(JSON.stringify(row));
  }

  await mongoose.disconnect();
}

recalc().catch((err) => {
  console.error(err);
  process.exit(1);
});
