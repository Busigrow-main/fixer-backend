#!/usr/bin/env npx ts-node
/**
 * P2-10 Settlement Preparation Test Data Seed
 *
 * Creates synthetic technicians and Earning documents for testing settlement
 * preparation (P2-10). Does NOT create Settlement or SettlementItem records —
 * those are created by the preparation service.
 *
 * ONLY runs against isolated/test databases. Refuses to run against production.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/seed-settlement-test-data.ts --date 2026-11-20
 *
 * Cleanup:
 *   npx ts-node -r tsconfig-paths/register src/scripts/seed-settlement-test-data.ts --date 2026-11-20 --cleanup
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { MongoClient, ObjectId } from 'mongodb';

const TIME_ZONE = 'Asia/Kolkata';
const SYNTHETIC_MARKER = 'P2-10-TEST';
const TECH_PHONE_PREFIX = '9001000';

function windowForBusinessDate(settlementDate: string): { startAt: Date; cutoffAt: Date } {
  const utcDate = new Date(`${settlementDate}T00:00:00.000Z`);
  const startAt = new Date(utcDate.getTime() - (5 * 60 + 30) * 60 * 1000);
  const cutoffAt = new Date(startAt.getTime() + 24 * 60 * 60 * 1000);
  return { startAt, cutoffAt };
}

function parseBusinessDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    console.error('❌ Invalid date. Use YYYY-MM-DD format.');
    process.exit(1);
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== value) {
    console.error('❌ Invalid calendar date.');
    process.exit(1);
  }
  return date;
}

interface TechDoc {
  _id: ObjectId;
  name: string;
  phone: string;
  email?: string;
  skills: string[];
  serviceCategories: string[];
  isActive: boolean;
  availabilityStatus: string;
  averageRating: number;
  totalCompletedJobs: number;
  onboardingStep: number;
  joiningFeePaid: boolean;
  profileCompleted: boolean;
  idVerified: boolean;
  onboardingStatus: string;
  verificationStatus: string;
  experienceYears: number;
  serviceAreas: string[];
  pincode?: string;
  address?: string;
  city?: string;
  bankDetails: any;
  upiId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface EarningDoc {
  _id: ObjectId;
  technicianId: ObjectId;
  bookingId?: ObjectId;
  amount: number;
  type: 'LABOUR' | 'PARTS' | 'BONUS' | 'JOINING_FEE_REFUND' | 'SELF_PART_FEE';
  paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'ONLINE';
  description?: string;
  earnedAt: Date;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randEl<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

async function main() {
  const args = process.argv.slice(2);
  const isCleanup = args.includes('--cleanup');

  const dateIndex = args.findIndex((a) => a === '--date' || a.startsWith('--date='));
  let settlementDate: string | undefined;
  if (dateIndex !== -1) {
    const dateArg = args[dateIndex];
    if (dateArg.startsWith('--date=')) {
      settlementDate = dateArg.slice('--date='.length);
    } else {
      settlementDate = args[dateIndex + 1];
    }
  }

  if (!settlementDate) {
    console.error('❌ Missing --date YYYY-MM-DD argument.');
    console.error('   Example: --date 2026-11-20');
    process.exit(1);
  }

  const utcDate = parseBusinessDate(settlementDate);
  const window = windowForBusinessDate(settlementDate);

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ CONFIG ERROR: MONGO_URI environment variable is required.');
    console.error('   Set MONGO_URI to the same MongoDB connection string used by the backend.');
    process.exit(1);
  }

  let dbName = new URL(mongoUri).pathname.slice(1);
  if (!dbName || dbName === '/') {
    dbName = 'test';
  }

  if (dbName !== 'test') {
    console.error('❌ SAFETY ABORT: Database name is not exactly "test".');
    console.error('   This dedicated P2-10 seeder only runs against the Atlas "test" database.');
    console.error(`   Current database: ${dbName}`);
    process.exit(1);
  }

  console.log(`🔒 Safety check passed: Using database "${dbName}"`);
  console.log(`📅 Target settlement date: ${settlementDate}`);
  console.log(`🪟 IST earning window: ${window.startAt.toISOString()} to ${window.cutoffAt.toISOString()}`);

  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(dbName);

  const technicians = db.collection<TechDoc>('technicians');
  const earnings = db.collection<EarningDoc>('earnings');
  const settlements = db.collection('settlements');
  const settlementItems = db.collection('settlementitems');

  if (isCleanup) {
    await runCleanup(db, technicians, earnings, settlements, settlementItems, settlementDate, window);
    await client.close();
    return;
  }

  await runSeed(db, technicians, earnings, settlementDate, window);
  await client.close();
}

async function runSeed(
  db: any,
  technicians: any,
  earnings: any,
  settlementDate: string,
  window: { startAt: Date; cutoffAt: Date },
) {
  const techList: TechDoc[] = [];

  // Scenario C: Multiple synthetic technicians
  const techNames = [
    'SettleTech Alpha', 'SettleTech Bravo', 'SettleTech Charlie', 'SettleTech Delta',
  ];

  for (let i = 0; i < techNames.length; i++) {
    const phone = `${TECH_PHONE_PREFIX}${String(i + 1).padStart(4, '0')}`;
    const existing = await technicians.findOne({ phone });
    if (existing) {
      console.log(`⚠️  Technician ${phone} already exists, skipping creation.`);
      techList.push(existing as unknown as TechDoc);
      continue;
    }
    const tech: TechDoc = {
      _id: new ObjectId(),
      name: techNames[i],
      phone,
      email: `${techNames[i].toLowerCase().replace(/\s+/g, '.')}@fixxer-test.example.com`,
      skills: ['REPAIR', 'MAINTENANCE'],
      serviceCategories: ['APPLIANCE_REPAIR'],
      isActive: true,
      availabilityStatus: 'AVAILABLE',
      averageRating: 4.5,
      totalCompletedJobs: 0,
      onboardingStep: 5,
      joiningFeePaid: true,
      profileCompleted: true,
      idVerified: true,
      onboardingStatus: 'APPROVED',
      verificationStatus: 'VERIFIED',
      experienceYears: 3,
      serviceAreas: ['400001', '400002'],
      pincode: '400001',
      address: 'Test Address, Mumbai',
      city: 'Mumbai',
      bankDetails: {},
      upiId: `${phone}@upi`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await technicians.insertOne(tech);
    techList.push(tech);
    console.log(`✅ Created technician: ${tech.name} (${tech.phone})`);
  }

  const { startAt, cutoffAt } = window;

  // Scenario A: Eligible earnings inside the window
  // Scenario B: Outside-window earnings
  const earningTypes: EarningDoc['type'][] = ['LABOUR', 'PARTS', 'BONUS'];
  const paymentMethods: EarningDoc['paymentMethod'][] = ['UPI', 'CASH', 'CARD'];

  let eligibleEarnings = 0;
  let outsideEarnings = 0;

  for (const tech of techList) {
    // 3 eligible earnings inside window
    for (let i = 0; i < 3; i++) {
      const earnedAt = new Date(startAt.getTime() + randInt(0, 23 * 60 * 60 * 1000 - 1));
      const earning: EarningDoc = {
        _id: new ObjectId(),
        technicianId: tech._id,
        bookingId: new ObjectId(),
        amount: randInt(50000, 150000),
        type: randEl(earningTypes),
        paymentMethod: randEl(paymentMethods),
        description: `${SYNTHETIC_MARKER} eligible earning ${i + 1}`,
        earnedAt,
      };
      await earnings.insertOne(earning);
      eligibleEarnings++;
    }

    // 1 outside-window earning (before window start)
    const beforeEarning: EarningDoc = {
      _id: new ObjectId(),
      technicianId: tech._id,
      bookingId: new ObjectId(),
      amount: randInt(50000, 150000),
      type: 'LABOUR',
      paymentMethod: 'UPI',
      description: `${SYNTHETIC_MARKER} outside-window earning (before)`,
      earnedAt: new Date(startAt.getTime() - 2 * 60 * 60 * 1000),
    };
    await earnings.insertOne(beforeEarning);
    outsideEarnings++;

    // 1 outside-window earning (after window cutoff)
    const afterEarning: EarningDoc = {
      _id: new ObjectId(),
      technicianId: tech._id,
      bookingId: new ObjectId(),
      amount: randInt(50000, 150000),
      type: 'BONUS',
      paymentMethod: 'CASH',
      description: `${SYNTHETIC_MARKER} outside-window earning (after)`,
      earnedAt: new Date(cutoffAt.getTime() + 2 * 60 * 60 * 1000),
    };
    await earnings.insertOne(afterEarning);
    outsideEarnings++;
  }

  console.log(`\n📊 Seed summary for ${settlementDate}:`);
  console.log(`   Technicians: ${techList.length}`);
  console.log(`   Eligible earnings (inside window): ${eligibleEarnings}`);
  console.log(`   Outside-window earnings: ${outsideEarnings}`);
  console.log(`\n💡 Next step: Call POST /v1/admin/settlements/prepare with settlementDate "${settlementDate}"`);
  console.log('   This will create Settlement and SettlementItem records via prepareTechnician().');
}

async function runCleanup(
  db: any,
  technicians: any,
  earnings: any,
  settlements: any,
  settlementItems: any,
  settlementDate: string,
  window: { startAt: Date; cutoffAt: Date },
) {
  console.log('🧹 Running P2-10 cleanup...');

  // Find P2-10 technicians by phone prefix
  const p210Techs = await technicians.find({ phone: { $regex: `^${TECH_PHONE_PREFIX}` } }).toArray();
  const p210TechIds = p210Techs.map((t: any) => t._id);

  if (p210TechIds.length === 0) {
    console.log('   No P2-10 synthetic technicians found. Nothing to clean.');
    return;
  }

  console.log(`   Found ${p210Techs.length} P2-10 synthetic technician(s)`);

  // Find settlements for P2-10 technicians on the target date
  const p210Settlements = await settlements.find({
    technicianId: { $in: p210TechIds },
    settlementDate,
  }).toArray();

  console.log(`   Found ${p210Settlements.length} settlement(s) for date ${settlementDate}`);

  // Safety: check that no settlement is in a non-cleanable terminal state
  const CLEANABLE_STATUSES = ['PREPARING', 'PREPARED', 'PREPARATION_FAILED'];
  const nonCleanable = p210Settlements.filter(
    (s: any) => !CLEANABLE_STATUSES.includes(s.status),
  );

  if (nonCleanable.length > 0) {
    console.error('❌ SAFETY ABORT: Some settlements are in non-cleanable states:');
    for (const s of nonCleanable) {
      console.error(`      Settlement ${s._id}: status=${s.status}, paymentStatus=${s.paymentStatus}, reconciliationStatus=${s.reconciliationStatus}`);
    }
    console.error('   Refusing to delete approved/payable/paid/reconciled/cancelled settlements.');
    process.exit(1);
  }

  const settlementIds = p210Settlements.map((s: any) => s._id);

  // Delete settlement items for P2-10 settlements
  let itemsDeleted = 0;
  if (settlementIds.length > 0) {
    const itemsResult = await settlementItems.deleteMany({ settlementId: { $in: settlementIds } });
    itemsDeleted = itemsResult.deletedCount;
  }

  // Delete P2-10 settlements (only cleanable ones)
  let settlementsDeleted = 0;
  if (settlementIds.length > 0) {
    const settlementsResult = await settlements.deleteMany({
      _id: { $in: settlementIds },
      status: { $in: CLEANABLE_STATUSES },
    });
    settlementsDeleted = settlementsResult.deletedCount;
  }

  // Delete P2-10 earnings within the target date's extended window.
// Covers eligible earnings (inside [startAt, cutoffAt)) and outside-window earnings
// created by this seed run (startAt - 2h, cutoffAt + 2h). Scoped by date to avoid
// deleting earnings created by a separate seed run for a different date.
  const earningsWindowStart = new Date(window.startAt.getTime() - 3 * 60 * 60 * 1000);
  const earningsWindowEnd = new Date(window.cutoffAt.getTime() + 3 * 60 * 60 * 1000);
  const earningsResult = await earnings.deleteMany({
    technicianId: { $in: p210TechIds },
    description: { $regex: `^${SYNTHETIC_MARKER}` },
    earnedAt: { $gte: earningsWindowStart, $lt: earningsWindowEnd },
  });

  // Delete P2-10 technicians only if they have no remaining settlements
  // (across all dates). Prevents orphaning settlements created for other dates.
  const techsToDelete: string[] = [];
  const techsKept: string[] = [];
  for (const tech of p210Techs) {
    const remainingSettlements = await settlements.countDocuments({
      technicianId: tech._id,
    });
    if (remainingSettlements === 0) {
      techsToDelete.push(tech.phone);
    } else {
      techsKept.push(`${tech.phone} (${remainingSettlements} remaining settlement(s))`);
    }
  }

  let techsDeleted = 0;
  if (techsToDelete.length > 0) {
    const techsResult = await technicians.deleteMany({
      phone: { $in: techsToDelete },
    });
    techsDeleted = techsResult.deletedCount;
  }

  console.log('\n✅ Cleanup complete:');
  console.log(`   SettlementItems deleted: ${itemsDeleted}`);
  console.log(`   Settlements deleted: ${settlementsDeleted}`);
  console.log(`   Earnings deleted: ${earningsResult.deletedCount}`);
  console.log(`   Technicians deleted: ${techsDeleted}`);
  if (techsKept.length > 0) {
    console.log('   Technicians kept (have remaining settlements):');
    for (const kept of techsKept) {
      console.log(`     - ${kept}`);
    }
  }
}

main().catch((error) => {
  console.error('❌ Seed script failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
