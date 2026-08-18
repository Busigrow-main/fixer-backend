/**
 * Adapt existing Mongo documents to the current settlement / warranty model:
 * - normalize visit + usage ObjectIds
 * - backfill sourcedBy, paidAt, invoice nets, spare-part serials
 * - zero covered warranty replacements on claim jobs
 * - rewrite technician earnings to the 100% labour / 10% inventory / ₹100 fee split
 *
 * Usage: npm run earnings:recalc
 *    or: npm run db:adapt
 */
import * as dotenv from 'dotenv';
import mongoose, { Types } from 'mongoose';
import { SELF_PART_PLATFORM_FEE } from '../technician-platform/constants';
import {
  buildTechnicianPayoutLines,
  computeTechnicianSettlement,
  type SettlementPart,
} from '../technician-platform/settlement';

dotenv.config();

const PAYOUT_TYPES = ['LABOUR', 'PARTS', 'SELF_PART_FEE'];

function isOidHex(value: unknown): boolean {
  if (value instanceof Types.ObjectId) return true;
  const s = String(value || '');
  return /^[a-fA-F0-9]{24}$/.test(s);
}

function toObjectId(value: unknown): Types.ObjectId | null {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  const s = String(value);
  if (!isOidHex(s)) return null;
  return new Types.ObjectId(s);
}

function idStr(value: unknown): string {
  return value ? String(value) : '';
}

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
    warrantyCovered: !!p.warrantyCovered,
  }));
}

function isPaidBooking(booking: any): boolean {
  return (
    booking.status === 'PAYMENT_COLLECTED' ||
    booking.paymentStatus === 'PAID_CASH' ||
    booking.paymentStatus === 'PAID_ONLINE' ||
    booking.jobClosed === true ||
    !!booking.paidAt
  );
}

function isWarrantyClaim(booking: any): boolean {
  return booking.serviceType === 'WARRANTY_CHECK' || !!booking.parentId;
}

function originalCoveredAt(
  original: any,
  warranty: any | undefined,
  at: Date,
): { covered: boolean; warranty?: any } {
  if (
    warranty &&
    warranty.type === 'PART' &&
    warranty.status === 'ACTIVE' &&
    warranty.endDate &&
    new Date(warranty.endDate) >= at
  ) {
    return { covered: true, warranty };
  }
  if (!warranty && original.warrantyMonths && original.installedAt) {
    const end = new Date(original.installedAt);
    end.setMonth(end.getMonth() + Number(original.warrantyMonths));
    return { covered: end >= at };
  }
  return { covered: false, warranty };
}

async function adapt() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/fixxer';
  await mongoose.connect(uri);
  const db = mongoose.connection.db!;
  const earnings = db.collection('earnings');
  const bookings = db.collection('bookings');
  const visits = db.collection('visits');
  const usages = db.collection('sparepartusages');
  const warranties = db.collection('warranties');
  const spareParts = db.collection('spareparts');

  const catalog = new Map<string, any>();
  for (const part of await spareParts.find({}).project({ name: 1 }).toArray()) {
    catalog.set(String(part._id), part);
  }

  let visitsNormalized = 0;
  for (const visit of await visits.find({}).toArray()) {
    const set: Record<string, unknown> = {};
    const bookingOid = toObjectId(visit.bookingId);
    if (bookingOid && !(visit.bookingId instanceof Types.ObjectId)) {
      set.bookingId = bookingOid;
    }
    const techOid = toObjectId(visit.technicianId);
    if (techOid && !(visit.technicianId instanceof Types.ObjectId)) {
      set.technicianId = techOid;
    }
    if (Object.keys(set).length) {
      await visits.updateOne({ _id: visit._id }, { $set: set });
      visitsNormalized += 1;
    }
  }

  const visitDocs = await visits.find({}).toArray();
  const usageOwner = new Map<string, Types.ObjectId>();
  for (const visit of visitDocs) {
    for (const usageId of visit.partsUsed || []) {
      const oid = toObjectId(usageId);
      if (oid) usageOwner.set(String(oid), visit._id);
    }
  }

  let usagesNormalized = 0;
  let warrantyLinked = 0;
  for (const usage of await usages.find({}).toArray()) {
    const set: Record<string, unknown> = {};
    const visitOid = toObjectId(usage.visitId) || usageOwner.get(String(usage._id));
    if (visitOid && !(usage.visitId instanceof Types.ObjectId)) {
      set.visitId = visitOid;
    }
    const spareOid = toObjectId(usage.sparePartId);
    if (spareOid && !(usage.sparePartId instanceof Types.ObjectId)) {
      set.sparePartId = spareOid;
    }
    if (!usage.sourcedBy) {
      set.sourcedBy = usage.isThirdParty ? 'SELF' : 'INVENTORY';
    }
    if (usage.warrantyCovered == null) set.warrantyCovered = false;
    if (!usage.partName) {
      const catalogPart = catalog.get(idStr(usage.sparePartId));
      if (catalogPart?.name) set.partName = catalogPart.name;
    }
    const sourcedBy = set.sourcedBy || usage.sourcedBy;
    const isSelf = usage.isThirdParty === true || sourcedBy === 'SELF';
    if (isSelf && usage.platformFeeAmount == null && !usage.warrantyCovered) {
      set.platformFeeAmount = SELF_PART_PLATFORM_FEE;
    }
    if (Object.keys(set).length) {
      await usages.updateOne({ _id: usage._id }, { $set: set });
      usagesNormalized += 1;
    }
  }

  const usageDocs = await usages.find({}).toArray();
  const usageById = new Map(usageDocs.map((u) => [String(u._id), u]));
  const visitsByBooking = new Map<string, any[]>();
  for (const visit of visitDocs) {
    const bid = idStr(visit.bookingId);
    if (!visitsByBooking.has(bid)) visitsByBooking.set(bid, []);
    visitsByBooking.get(bid)!.push(visit);
  }

  function usagesForBooking(bookingId: string): any[] {
    return (visitsByBooking.get(bookingId) || []).flatMap((v) =>
      (v.partsUsed || [])
        .map((id: any) => usageById.get(idStr(id)))
        .filter(Boolean),
    );
  }

  const warrantyDocs = await warranties.find({ type: 'PART' }).toArray();
  const warrantyByUsage = new Map<string, any>();
  for (const w of warrantyDocs) {
    if (w.sparePartUsageId) warrantyByUsage.set(idStr(w.sparePartUsageId), w);
  }

  const bookingDocs = await bookings.find({}).toArray();
  const bookingById = new Map(bookingDocs.map((b) => [String(b._id), b]));

  function rootParentId(booking: any): string | null {
    let current = booking;
    const seen = new Set<string>();
    while (current?.parentId) {
      const pid = idStr(current.parentId);
      if (!pid || seen.has(pid)) break;
      seen.add(pid);
      current = bookingById.get(pid);
    }
    return current && String(current._id) !== String(booking._id)
      ? String(current._id)
      : booking.parentId
        ? idStr(booking.parentId)
        : null;
  }

  for (const booking of bookingDocs) {
    if (!isWarrantyClaim(booking)) continue;
    const parentId = rootParentId(booking);
    if (!parentId) continue;
    const originals = usagesForBooking(parentId);
    const usedOriginals = new Set<string>();
    const at = booking.createdAt ? new Date(booking.createdAt) : new Date();

    for (const claimPart of usagesForBooking(String(booking._id))) {
      if (claimPart.warrantyCovered || claimPart.replacedUsageId) continue;
      const claimSku = idStr(claimPart.sparePartId);
      const claimName = String(claimPart.partName || '').trim().toLowerCase();
      const original = originals.find((o) => {
        const oid = idStr(o._id);
        if (usedOriginals.has(oid)) return false;
        const origSku = idStr(o.sparePartId);
        if (claimSku && origSku && claimSku === origSku) return true;
        const origName = String(o.partName || '').trim().toLowerCase();
        return !!claimName && !!origName && claimName === origName;
      });
      if (!original) continue;
      const coverage = originalCoveredAt(
        original,
        warrantyByUsage.get(idStr(original._id)),
        at,
      );
      if (!coverage.covered) continue;

      usedOriginals.add(idStr(original._id));
      await usages.updateOne(
        { _id: claimPart._id },
        {
          $set: {
            cost: 0,
            warrantyCovered: true,
            platformFeeAmount: 0,
            replacedUsageId: original._id,
            ...(coverage.warranty?._id
              ? { replacedWarrantyId: coverage.warranty._id }
              : {}),
          },
        },
      );
      claimPart.cost = 0;
      claimPart.warrantyCovered = true;
      claimPart.platformFeeAmount = 0;
      claimPart.replacedUsageId = original._id;
      if (coverage.warranty?._id) {
        await warranties.updateOne(
          { _id: coverage.warranty._id },
          { $set: { status: 'CLAIMED', updatedAt: new Date() } },
        );
        coverage.warranty.status = 'CLAIMED';
      }
      warrantyLinked += 1;
    }
  }

  let invoicesUpdated = 0;
  let paidAtSet = 0;
  for (const booking of bookingDocs) {
    const bookingId = String(booking._id);
    const visitParts = usagesForBooking(bookingId);
    const parts: SettlementPart[] =
      visitParts.length > 0 ? visitParts : partsFromInvoice(booking.invoiceData);
    const invoice = booking.invoiceData || {};
    const serviceTotal =
      booking.serviceType === 'WARRANTY_CHECK'
        ? invoice.manualOverride
          ? Number(invoice.serviceTotal) || 0
          : 0
        : Number(invoice.serviceTotal) || 0;
    const additionalCharges = invoice.additionalCharges || [];

    const sparePartsSummary = (visitParts.length > 0 ? visitParts : invoice.spareParts || []).map(
      (usage: any) => {
        const catalogPart = catalog.get(idStr(usage.sparePartId));
        const covered = !!usage.warrantyCovered;
        const cost = covered ? 0 : Number(usage.cost) || 0;
        return {
          partName:
            usage.partName || catalogPart?.name || 'Spare Part',
          quantity: usage.quantity || 1,
          cost,
          isThirdParty: !!usage.isThirdParty,
          warrantyCovered: covered,
          serialNumber: usage.serialNumber || undefined,
        };
      },
    );
    const partsTotal = sparePartsSummary.reduce(
      (sum: number, p: any) => sum + (Number(p.cost) || 0) * (p.quantity || 1),
      0,
    );
    const additionalTotal = additionalCharges.reduce(
      (sum: number, c: any) => sum + (Number(c.amount) || 0),
      0,
    );
    const settlement = computeTechnicianSettlement({
      serviceTotal,
      additionalCharges,
      parts,
    });
    const totalAmount = Math.round((serviceTotal + partsTotal + additionalTotal) * 100) / 100;

    const invoiceSet: Record<string, unknown> = {
      'invoiceData.serviceTotal': serviceTotal,
      'invoiceData.partsTotal': Math.round(partsTotal * 100) / 100,
      'invoiceData.additionalCharges': additionalCharges,
      'invoiceData.spareParts': sparePartsSummary,
      'invoiceData.totalAmount': totalAmount,
      'invoiceData.technicianNet': settlement.technicianNet,
      'invoiceData.fixxerNet': settlement.fixxerNet,
    };
    if (!invoice.url) {
      invoiceSet['invoiceData.url'] = `/api/v1/user/bookings/${bookingId}/invoice`;
    }
    await bookings.updateOne({ _id: booking._id }, { $set: invoiceSet });
    invoicesUpdated += 1;
    booking.invoiceData = {
      ...invoice,
      serviceTotal,
      partsTotal: Math.round(partsTotal * 100) / 100,
      spareParts: sparePartsSummary,
      totalAmount,
      technicianNet: settlement.technicianNet,
      fixxerNet: settlement.fixxerNet,
    };

    if (isPaidBooking(booking) && !booking.paidAt) {
      const paidAt = new Date(
        booking.jobClosedAt ||
          invoice.generatedAt ||
          booking.updatedAt ||
          booking.createdAt ||
          Date.now(),
      );
      await bookings.updateOne({ _id: booking._id }, { $set: { paidAt } });
      booking.paidAt = paidAt;
      paidAtSet += 1;
    }
  }

  const existing = await earnings
    .find({ type: { $in: PAYOUT_TYPES }, bookingId: { $exists: true, $ne: null } })
    .toArray();
  const byBooking = new Map<string, typeof existing>();
  for (const row of existing) {
    const id = String(row.bookingId);
    if (!byBooking.has(id)) byBooking.set(id, []);
    byBooking.get(id)!.push(row);
  }

  const paidBookings = bookingDocs.filter(
    (b) => isPaidBooking(b) && b.technicianId,
  );
  let updated = 0;
  let skipped = 0;
  const reports: Array<Record<string, unknown>> = [];

  for (const booking of paidBookings) {
    const bookingId = String(booking._id);
    const technicianId = resolveTechnicianId(booking.technicianId);
    if (!technicianId) {
      skipped += 1;
      continue;
    }

    const previous = byBooking.get(bookingId) || [];
    const visitParts = usagesForBooking(bookingId);
    const parts =
      visitParts.length > 0 ? visitParts : partsFromInvoice(booking.invoiceData);
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
          : booking.paidAt
            ? new Date(booking.paidAt)
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
      customerTotal: settlement.customerTotal,
      lines: lines.map((l) => `${l.type}:${l.amount}`),
    });
  }

  console.log(
    JSON.stringify({
      visitsNormalized,
      usagesNormalized,
      warrantyLinked,
      invoicesUpdated,
      paidAtSet,
      earningsUpdated: updated,
      earningsSkipped: skipped,
    }),
  );
  for (const row of reports) {
    console.log(JSON.stringify(row));
  }

  await mongoose.disconnect();
}

adapt().catch((err) => {
  console.error(err);
  process.exit(1);
});
