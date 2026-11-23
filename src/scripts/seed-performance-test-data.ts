#!/usr/bin/env npx ts-node
/**
 * P2-11 Performance Summary Test Data Seed
 *
 * Creates synthetic test data for 7 IST business days (2026-11-16 through 2026-11-22).
 * ONLY runs against isolated/test databases. Refuses to run against production.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/seed-performance-test-data.ts
 *
 * Cleanup:
 *   npx ts-node -r tsconfig-paths/register src/scripts/seed-performance-test-data.ts --cleanup
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { MongoClient, ObjectId } from 'mongodb';

const TIME_ZONE = 'Asia/Kolkata';
const TEST_PHONE_PREFIX = '9000000';
const SYNTHETIC_MARKER = 'P2-11-TEST';
const TARGET_DATES = [
  '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19',
  '2026-11-20', '2026-11-21', '2026-11-22'
];

const TECHNICIAN_NAMES = [
  'TestTech Alpha', 'TestTech Bravo', 'TestTech Charlie', 'TestTech Delta',
  'TestTech Echo', 'TestTech Foxtrot'
];
const SERVICE_TYPES = ['REPAIR', 'INSTALLATION', 'MAINTENANCE', 'WARRANTY_CHECK'];

interface ExpectedMetrics {
  date: string;
  technicians: Array<{
    name: string;
    phone: string;
    backlogAgeAvgHours: number | null;
    assignmentDelayAvgHours: number | null;
    completionTimeAvgHours: number | null;
    partsWaitAvgHours: number | null;
    repeatRepairRatePct: number | null;
    firstVisitCompletionRatePct: number | null;
    feedbackAvgRating: number | null;
    totalJobs: number;
    completedJobs: number;
    pendingJobs: number;
    cancelledJobs: number;
    earnings: number;
  }>;
}

const EXPECTED_REPORT: ExpectedMetrics[] = [];

function windowForBusinessDate(businessDate: string): { start: Date; end: Date } {
  const day = new Date(`${businessDate}T00:00:00.000Z`);
  const start = new Date(day.getTime() - (5 * 60 + 30) * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randEl<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

interface TechDoc {
  _id: ObjectId;
  name: string;
  phone: string;
  email: string;
  skills: string[];
  serviceCategories: string[];
  isActive: boolean;
  idVerified: boolean;
  availabilityStatus: string;
  averageRating: number;
  totalCompletedJobs: number;
  onboardingStep: number;
  joiningFeePaid: boolean;
  profileCompleted: boolean;
  onboardingStatus: string;
  verificationStatus: string;
  experienceYears: number;
  serviceAreas: string[];
  city: string;
  pincode: string;
  address: string;
  bankDetails: any;
  upiId: string;
  onboardingCompletedAt: Date;
  approvedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface BookingDoc {
  _id: ObjectId;
  userId: ObjectId;
  technicianId: ObjectId;
  serviceId: ObjectId;
  subCategoryId: ObjectId;
  contactPhone: string;
  addressData: { zip: string; text: string };
  description: string;
  status: string;
  serviceType: string;
  productDetails: { brand: string; modelNumber: string; serialNumber: string };
  createdAt: Date;
  updatedAt: Date;
  jobClosed: boolean;
  jobClosedAt?: Date;
  jobClosedByTechnicianId?: ObjectId;
  cancelledAt?: Date;
  acceptedAt?: Date;
  firstAssignedAt?: Date;
  firstAssignedTechnicianId?: ObjectId;
  visits: ObjectId[];
  partsWaitEvents: Array<{ event: string; at: Date }>;
  parentId?: ObjectId;
  correctiveBookingIds: ObjectId[];
}

interface VisitDoc {
  _id: ObjectId;
  bookingId: ObjectId;
  technicianId: ObjectId;
  visitOrder: number;
  status: string;
  scheduledDate?: Date;
  timeIn?: Date;
  timeOut?: Date;
  jobDescription: string;
}

interface FeedbackDoc {
  _id: ObjectId;
  bookingId: ObjectId;
  userId: ObjectId;
  rating: number;
  resolved: boolean;
  comment: string;
  createdAt: Date;
}

interface EarningDoc {
  _id: ObjectId;
  technicianId: ObjectId;
  bookingId: ObjectId;
  amount: number;
  type: string;
  paymentMethod: string;
  earnedAt: Date;
  description: string;
}

interface SettlementDoc {
  _id: ObjectId;
  technicianId: ObjectId;
  settlementDate: string;
  cutoffAt: Date;
  totalEarnings: number;
  adjustments: number;
  adjustmentEntries: any[];
  netPayable: number;
  currency: string;
  status: string;
  paymentStatus: string;
  reconciliationStatus: string;
  paidAt?: Date;
  paymentReference: string;
  paymentMethod: string;
  auditTrail: any[];
}

interface SettlementItemDoc {
  _id: ObjectId;
  settlementId: ObjectId;
  earningId: ObjectId;
  technicianId: ObjectId;
  bookingId: ObjectId;
  amount: number;
  earningType: string;
  description: string;
  earnedAt: Date;
  customerPaymentMethod: string;
  claimStatus: string;
}

function generateDayData(
  businessDate: string,
  technicians: TechDoc[],
  serviceId: ObjectId,
  subCategoryId: ObjectId,
  userId: ObjectId
) {
  const { start, end } = windowForBusinessDate(businessDate);
  const dayRecords: any = {
    bookings: [] as BookingDoc[],
    visits: [] as VisitDoc[],
    feedback: [] as FeedbackDoc[],
    earnings: [] as EarningDoc[],
    settlements: [] as SettlementDoc[],
    settlementItems: [] as SettlementItemDoc[],
  };

  const activeTechs = technicians.slice(0, randInt(3, 4));
  const numBookings = randInt(8, 12);

  for (let i = 0; i < numBookings; i++) {
    const tech = randEl(activeTechs);
    const serviceType = randEl(SERVICE_TYPES);
    const serialNumber = `${SYNTHETIC_MARKER}-${businessDate}-${i.toString().padStart(3, '0')}`;
    const createdAt = new Date(start.getTime() + randInt(0, 23 * 60 * 60 * 1000));
    const bookingId = new ObjectId();

    const outcome = Math.random();
    let status: string;
    let jobClosed = false;
    let jobClosedAt: Date | undefined;
    let jobClosedByTechnicianId: ObjectId | undefined;
    let cancelledAt: Date | undefined;
    let acceptedAt: Date | undefined;
    let firstAssignedAt: Date | undefined;
    let firstAssignedTechnicianId: ObjectId | undefined;

    if (outcome < 0.7) {
      status = randEl(['COMPLETED', 'PAYMENT_COLLECTED']);
      jobClosed = true;
      const delay = randInt(2 * 60 * 60 * 1000, 12 * 60 * 60 * 1000);
      jobClosedAt = new Date(Math.min(createdAt.getTime() + delay, end.getTime() - 1));
      jobClosedByTechnicianId = tech._id;
      acceptedAt = new Date(createdAt.getTime() + randInt(30 * 60 * 1000, 4 * 60 * 60 * 1000));
      firstAssignedAt = new Date(createdAt.getTime() + randInt(15 * 60 * 1000, 3 * 60 * 60 * 1000));
      firstAssignedTechnicianId = tech._id;
    } else if (outcome < 0.9) {
      status = randEl(['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS']);
      firstAssignedAt = new Date(createdAt.getTime() + randInt(15 * 60 * 1000, 3 * 60 * 60 * 1000));
      firstAssignedTechnicianId = tech._id;
      acceptedAt = new Date(createdAt.getTime() + randInt(30 * 60 * 1000, 4 * 60 * 60 * 1000));
    } else {
      status = 'CANCELLED';
      cancelledAt = new Date(createdAt.getTime() + randInt(1 * 60 * 60 * 1000, 6 * 60 * 60 * 1000));
    }

    const booking: BookingDoc = {
      _id: bookingId,
      userId,
      technicianId: tech._id,
      serviceId,
      subCategoryId,
      contactPhone: tech.phone,
      addressData: { zip: '110001', text: 'Test Address, Delhi' },
      description: `${SYNTHETIC_MARKER} booking`,
      status,
      serviceType,
      productDetails: { brand: 'TestBrand', modelNumber: 'TestModel', serialNumber },
      createdAt,
      updatedAt: new Date(),
      jobClosed,
      jobClosedAt,
      jobClosedByTechnicianId,
      cancelledAt,
      acceptedAt,
      firstAssignedAt,
      firstAssignedTechnicianId,
      visits: [],
      partsWaitEvents: [],
      correctiveBookingIds: [],
    };

    if (jobClosed && Math.random() < 0.3) {
      const numIntervals = randInt(1, 2);
      for (let k = 0; k < numIntervals; k++) {
        const waitStart = new Date(createdAt.getTime() + randInt(1 * 60 * 60 * 1000, 8 * 60 * 60 * 1000));
        const waitEnd = new Date(waitStart.getTime() + randInt(1 * 60 * 60 * 1000, 6 * 60 * 60 * 1000));
        if (waitEnd < end) {
          booking.partsWaitEvents.push(
            { event: 'WAIT_STARTED', at: waitStart },
            { event: 'PARTS_AVAILABLE', at: waitEnd }
          );
        }
      }
    }

    dayRecords.bookings.push(booking);

    if (jobClosed) {
      const numVisits = randInt(1, 2);
      const visitIds: ObjectId[] = [];
      for (let v = 0; v < numVisits; v++) {
        const visitId = new ObjectId();
        visitIds.push(visitId);
        dayRecords.visits.push({
          _id: visitId,
          bookingId,
          technicianId: tech._id,
          visitOrder: v + 1,
          status: 'COMPLETED',
          scheduledDate: new Date(jobClosedAt!.getTime() - randInt(0, 24 * 60 * 60 * 1000)),
          timeIn: new Date(jobClosedAt!.getTime() - randInt(2 * 60 * 60 * 1000, 8 * 60 * 60 * 1000)),
          timeOut: jobClosedAt,
          jobDescription: `${SYNTHETIC_MARKER} visit ${v + 1}`,
        });
      }
      booking.visits = visitIds;
    }

    if (jobClosed && Math.random() < 0.6) {
      dayRecords.feedback.push({
        _id: new ObjectId(),
        bookingId,
        userId,
        rating: randInt(1, 5),
        resolved: true,
        comment: `${SYNTHETIC_MARKER} feedback`,
        createdAt: new Date(jobClosedAt!.getTime() + randInt(0, 48 * 60 * 60 * 1000)),
      });
    }

    if (jobClosed) {
      const labourAmount = randInt(50000, 150000);
      dayRecords.earnings.push({
        _id: new ObjectId(),
        technicianId: tech._id,
        bookingId,
        amount: labourAmount,
        type: 'LABOUR',
        paymentMethod: 'UPI',
        earnedAt: new Date(jobClosedAt!.getTime() + randInt(0, 2 * 60 * 60 * 1000)),
        description: `${SYNTHETIC_MARKER} labour`,
      });

      if (Math.random() < 0.3) {
        dayRecords.earnings.push({
          _id: new ObjectId(),
          technicianId: tech._id,
          bookingId,
          amount: randInt(10000, 50000),
          type: 'BONUS',
          paymentMethod: 'UPI',
          earnedAt: new Date(jobClosedAt!.getTime() + randInt(0, 4 * 60 * 60 * 1000)),
          description: `${SYNTHETIC_MARKER} bonus`,
        });
      }
    }

    if (jobClosed && serviceType === 'REPAIR' && Math.random() < 0.2 && dayRecords.bookings.length > 1) {
      const parentBooking = dayRecords.bookings[randInt(0, dayRecords.bookings.length - 2)];
      if (parentBooking.jobClosed && parentBooking.productDetails.serialNumber) {
        booking.productDetails.serialNumber = parentBooking.productDetails.serialNumber;
        booking.parentId = parentBooking._id;
        parentBooking.correctiveBookingIds = parentBooking.correctiveBookingIds || [];
        parentBooking.correctiveBookingIds.push(bookingId);
      }
    }
  }

  for (const tech of activeTechs) {
    const settlementId = new ObjectId();
    const techBookings = dayRecords.bookings.filter((b: BookingDoc) => b.technicianId?.equals(tech._id) && b.jobClosed);
    const earningIds = dayRecords.earnings
      .filter((e: EarningDoc) => e.technicianId.equals(tech._id) && e.bookingId && techBookings.some((b: BookingDoc) => b._id.equals(e.bookingId)))
      .map((e: EarningDoc) => e._id);

    const totalEarnings = dayRecords.earnings
      .filter((e: EarningDoc) => e.technicianId.equals(tech._id))
      .reduce((sum: number, e: EarningDoc) => sum + e.amount, 0);

    dayRecords.settlements.push({
      _id: settlementId,
      technicianId: tech._id,
      settlementDate: businessDate,
      cutoffAt: end,
      totalEarnings,
      adjustments: 0,
      adjustmentEntries: [],
      netPayable: totalEarnings,
      currency: 'INR',
      status: 'PAID',
      paymentStatus: 'SUCCESS',
      reconciliationStatus: 'PENDING',
      paidAt: new Date(end.getTime() + 3600000),
      paymentReference: `${SYNTHETIC_MARKER}-${businessDate}-${tech.name.replace(/\s+/g, '')}`,
      paymentMethod: 'UPI',
      auditTrail: [
        { action: 'PREPARED', performedAt: end },
        { action: 'APPROVED', performedAt: new Date(end.getTime() + 1800000) },
        { action: 'PAID', performedAt: new Date(end.getTime() + 3600000) },
      ],
    });

    for (const earningId of earningIds) {
      const earning = dayRecords.earnings.find((e: EarningDoc) => e._id.equals(earningId));
      if (!earning) continue;
      dayRecords.settlementItems.push({
        _id: new ObjectId(),
        settlementId,
        earningId,
        technicianId: tech._id,
        bookingId: earning.bookingId,
        amount: earning.amount,
        earningType: earning.type,
        description: earning.description,
        earnedAt: earning.earnedAt,
        customerPaymentMethod: 'UPI',
        claimStatus: 'FINALIZED',
      });
    }
  }

  const techMetrics = activeTechs.map(tech => {
    const techBookings = dayRecords.bookings.filter((b: BookingDoc) => b.technicianId?.equals(tech._id));
    const completedBookings = techBookings.filter((b: BookingDoc) => b.jobClosed);
    const openBookings = techBookings.filter((b: BookingDoc) => !b.jobClosed && b.status !== 'CANCELLED');
    const cancelledBookings = techBookings.filter((b: BookingDoc) => b.status === 'CANCELLED');

    const assignmentDelayBookings = techBookings.filter((b: BookingDoc) => b.firstAssignedAt && b.firstAssignedAt >= b.createdAt);
    const completionTimeBookings = completedBookings.filter((b: BookingDoc) => b.acceptedAt && b.jobClosedAt && b.acceptedAt <= b.jobClosedAt);
    const partsWaitBookings = techBookings.filter((b: BookingDoc) => b.partsWaitEvents && b.partsWaitEvents.length >= 2);
    const repeatRepairBookings = completedBookings.filter((b: BookingDoc) => b.serviceType === 'REPAIR' && b.parentId);
    const firstVisitBookings = completedBookings.filter((b: BookingDoc) => b.visits.length === 1);
    const feedbackRecords = dayRecords.feedback.filter((f: any) => techBookings.some((b: BookingDoc) => b._id.equals(f.bookingId)));
    const earnings = dayRecords.earnings.filter((e: EarningDoc) => e.technicianId.equals(tech._id));

    const backlogAgeAvgHours = openBookings.length > 0
      ? openBookings.reduce((sum: number, b: BookingDoc) => sum + (end.getTime() - b.createdAt.getTime()), 0) / openBookings.length / (1000 * 60 * 60)
      : null;

    const assignmentDelayAvgHours = assignmentDelayBookings.length > 0
      ? assignmentDelayBookings.reduce((sum: number, b: BookingDoc) => sum + (b.firstAssignedAt!.getTime() - b.createdAt.getTime()), 0) / assignmentDelayBookings.length / (1000 * 60 * 60)
      : null;

    const completionTimeAvgHours = completionTimeBookings.length > 0
      ? completionTimeBookings.reduce((sum: number, b: BookingDoc) => sum + (b.jobClosedAt!.getTime() - b.acceptedAt!.getTime()), 0) / completionTimeBookings.length / (1000 * 60 * 60)
      : null;

    const partsWaitAvgHours = partsWaitBookings.length > 0
      ? partsWaitBookings.reduce((sum: number, b: BookingDoc) => {
          let total = 0;
          for (let k = 0; k < b.partsWaitEvents.length; k += 2) {
            const start = new Date(b.partsWaitEvents[k].at).getTime();
            const avail = new Date(b.partsWaitEvents[k + 1].at).getTime();
            total += avail - start;
          }
          return sum + total;
        }, 0) / partsWaitBookings.length / (1000 * 60 * 60)
      : null;

    const repeatRepairRatePct = repeatRepairBookings.length > 0
      ? Math.round((repeatRepairBookings.length / completedBookings.filter((b: BookingDoc) => b.serviceType === 'REPAIR').length) * 10000) / 100
      : null;

    const firstVisitCompletionRatePct = completedBookings.length > 0
      ? Math.round((completedBookings.filter((b: BookingDoc) => b.visits.length === 1).length / completedBookings.length) * 10000) / 100
      : null;

    const feedbackAvgRating = dayRecords.feedback.length > 0
      ? dayRecords.feedback.filter((f: any) => techBookings.some((b: BookingDoc) => b._id.equals(f.bookingId)))
          .reduce((sum: number, f: any) => sum + f.rating, 0) / dayRecords.feedback.filter((f: any) => techBookings.some((b: BookingDoc) => b._id.equals(f.bookingId))).length
      : null;

    const earningsTotal = dayRecords.earnings
      .filter((e: EarningDoc) => e.technicianId.equals(tech._id))
      .reduce((sum: number, e: EarningDoc) => sum + e.amount, 0);

    return {
      name: tech.name,
      phone: tech.phone,
      backlogAgeAvgHours,
      assignmentDelayAvgHours,
      completionTimeAvgHours,
      partsWaitAvgHours,
      repeatRepairRatePct,
      firstVisitCompletionRatePct,
      feedbackAvgRating,
      totalJobs: techBookings.length,
      completedJobs: completedBookings.filter((b: BookingDoc) => b.jobClosed).length,
      pendingJobs: techBookings.filter((b: BookingDoc) => !b.jobClosed && b.status !== 'CANCELLED').length,
      cancelledJobs: techBookings.filter((b: BookingDoc) => b.status === 'CANCELLED').length,
      earnings: earningsTotal,
    };
  });

  EXPECTED_REPORT.push({ date: businessDate, technicians: techMetrics });

  return dayRecords;
}

async function main() {
  const args = process.argv.slice(2);
  const isCleanup = args.includes('--cleanup');

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ CONFIG ERROR: MONGO_URI environment variable is required.');
    console.error('   Set MONGO_URI to the same MongoDB connection string used by the backend.');
    console.error('   Example: export MONGO_URI="mongodb+srv://user:pass@cluster.mongodb.net/test"');
    process.exit(1);
  }

  let dbName = new URL(mongoUri).pathname.slice(1);
  if (!dbName || dbName === '/') {
    dbName = 'test';
  }

  if (!dbName.includes('test') && !dbName.includes('dev') && !dbName.includes('local')) {
    console.error('❌ SAFETY ABORT: Database name does not contain "test", "dev", or "local".');
    console.error('   This script only runs against isolated/test databases.');
    console.error(`   Current database: ${dbName}`);
    process.exit(1);
  }

  console.log(`🔒 Safety check passed: Using database "${dbName}"`);

  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(dbName);

  const users = db.collection('users');
  const technicians = db.collection('technicians');
  const bookings = db.collection('bookings');
  const visits = db.collection('visits');
  const feedback = db.collection('feedback');
  const earnings = db.collection('earnings');
  const settlements = db.collection('settlements');
  const settlementItems = db.collection('settlementitems');
  const services = db.collection('services');
  const servicePerformanceSummaries = db.collection('serviceperformancesummaries');

  if (isCleanup) {
    console.log('🧹 Running cleanup...');
    const prefix = TEST_PHONE_PREFIX;

    const result = await Promise.all([
      technicians.deleteMany({ phone: { $regex: `^${prefix}` } }),
      bookings.deleteMany({ 'productDetails.serialNumber': { $regex: `^${SYNTHETIC_MARKER}` } }),
      visits.deleteMany({ jobDescription: { $regex: `^${SYNTHETIC_MARKER}` } }),
      feedback.deleteMany({ comment: { $regex: `^${SYNTHETIC_MARKER}` } }),
      earnings.deleteMany({ description: { $regex: `^${SYNTHETIC_MARKER}` } }),
      settlements.deleteMany({ paymentReference: { $regex: `^${SYNTHETIC_MARKER}` } }),
      settlementItems.deleteMany({ description: { $regex: `^${SYNTHETIC_MARKER}` } }),
      servicePerformanceSummaries.deleteMany({ businessDate: { $in: TARGET_DATES } }),
    ]);

    console.log('✅ Cleanup complete:');
    console.log(`   Technicians: ${result[0].deletedCount}`);
    console.log(`   Bookings: ${result[1].deletedCount}`);
    console.log(`   Visits: ${result[2].deletedCount}`);
    console.log(`   Feedback: ${result[3].deletedCount}`);
    console.log(`   Earnings: ${result[4].deletedCount}`);
    console.log(`   Settlements: ${result[5].deletedCount}`);
    console.log(`   SettlementItems: ${result[6].deletedCount}`);
    console.log(`   PerformanceSummaries: ${result[7].deletedCount}`);

    await client.close();
    return;
  }

  const existingTech = await technicians.countDocuments({ phone: { $regex: `^${TEST_PHONE_PREFIX}` } });
  if (existingTech > 0) {
    console.log(`⚠️ Synthetic data already exists (${existingTech} technicians). Run with --cleanup first.`);
    await client.close();
    return;
  }

  console.log('🌱 Seeding synthetic test data...');

  let service = await services.findOne({ slug: 'repair' });
  if (!service) {
    const result = await services.insertOne({
      slug: 'repair',
      name: 'Repair',
      title: 'Repair',
      startingPrice: '100',
      description: 'Repair service',
      icon: 'wrench',
      image: 'repair.png',
      subCategories: [{ _id: new ObjectId(), name: 'General Repair', price: '500' }],
      features: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    service = await services.findOne({ _id: result.insertedId });
    if (!service) throw new Error('Failed to create service');
  }
  const serviceId = service._id;
  const subCategoryId = service.subCategories[0]._id;

  const userResult = await users.insertOne({
    phone: `${TEST_PHONE_PREFIX}00`,
    email: 'p2-11-test-customer@example.com',
    fullName: 'P2-11 Test Customer',
    role: 'CUSTOMER',
    passwordHash: 'test-hash',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const userId = userResult.insertedId;

  const techDocs = TECHNICIAN_NAMES.map((name, i) => ({
    name,
    phone: `${TEST_PHONE_PREFIX}${i + 1}`,
    email: `p2-11-tech${i + 1}@example.com`,
    skills: ['AC Repair', 'Washing Machine', 'Refrigerator'],
    serviceCategories: ['AC', 'WASHING_MACHINE', 'REFRIGERATOR'],
    isActive: true,
    idVerified: true,
    availabilityStatus: 'AVAILABLE',
    averageRating: 4.5,
    totalCompletedJobs: 0,
    onboardingStep: 4,
    joiningFeePaid: true,
    profileCompleted: true,
    onboardingStatus: 'COMPLETED',
    verificationStatus: 'VERIFIED',
    experienceYears: 5,
    serviceAreas: ['110001', '110002'],
    city: 'Delhi',
    pincode: '110001',
    address: 'Test Address, Delhi',
    bankDetails: { accountName: name, accountNumber: '1234567890', ifsc: 'TEST0001', bankName: 'Test Bank' },
    upiId: `p2-11-tech${i + 1}@upi`,
    onboardingCompletedAt: new Date('2026-01-01'),
    approvedAt: new Date('2026-01-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  const techResult = await technicians.insertMany(techDocs);
  const techList = Object.values(techResult.insertedIds).map((id, i) => ({
    _id: id,
    ...techDocs[i],
  }));

  console.log(`✅ Created ${techList.length} synthetic technicians`);

  let allBookings: any[] = [];
  let allVisits: any[] = [];
  let allFeedback: any[] = [];
  let allEarnings: any[] = [];
  let allSettlements: any[] = [];
  let allSettlementItems: any[] = [];

  for (const date of TARGET_DATES) {
    console.log(`  📅 Generating data for ${date}...`);
    const dayData = generateDayData(date, techList, serviceId, subCategoryId, userId);
    allBookings.push(...dayData.bookings);
    allVisits.push(...dayData.visits);
    allFeedback.push(...dayData.feedback);
    allEarnings.push(...dayData.earnings);
    allSettlements.push(...dayData.settlements);
    allSettlementItems.push(...dayData.settlementItems);
  }

  console.log('💾 Inserting all records...');
  await Promise.all([
    bookings.insertMany(allBookings),
    visits.insertMany(allVisits),
    feedback.insertMany(allFeedback),
    earnings.insertMany(allEarnings),
    settlements.insertMany(allSettlements),
    settlementItems.insertMany(allSettlementItems),
  ]);

  console.log(`✅ Inserted:`);
  console.log(`   Bookings: ${allBookings.length}`);
  console.log(`   Visits: ${allVisits.length}`);
  console.log(`   Feedback: ${allFeedback.length}`);
  console.log(`   Earnings: ${allEarnings.length}`);
  console.log(`   Settlements: ${allSettlements.length}`);
  console.log(`   SettlementItems: ${allSettlementItems.length}`);

  console.log('\n📊 EXPECTED METRICS REPORT:');
  console.log('='.repeat(120));
  for (const day of EXPECTED_REPORT) {
    console.log(`\n📅 ${day.date}:`);
    console.log('  Technician              | Backlog | Assign | Complete | Parts | Repeat% | 1stVisit% | Feedback | Jobs | Comp | Pend | Canc | Earnings(₹)');
    console.log('  '.padEnd(22) + '|'.padStart(8) + '|'.padStart(8) + '|'.padStart(8) + '|'.padStart(5) + '|'.padStart(7) + '|'.padStart(9) + '|'.padStart(8) + '|'.padStart(4) + '|'.padStart(4) + '|'.padStart(4) + '|'.padStart(12));
    for (const t of day.technicians) {
      const fmt = (v: number | null) => v === null ? '  N/A' : v.toFixed(1).padStart(6);
      const fmtPct = (v: number | null) => v === null ? '  N/A' : v.toFixed(1).padStart(6);
      console.log(`  ${t.name.padEnd(22)} | ${fmt(t.backlogAgeAvgHours)} | ${fmt(t.assignmentDelayAvgHours)} | ${fmt(t.completionTimeAvgHours)} | ${fmt(t.partsWaitAvgHours)} | ${fmtPct(t.repeatRepairRatePct)} | ${fmtPct(t.firstVisitCompletionRatePct)} | ${fmt(t.feedbackAvgRating)} | ${t.totalJobs.toString().padStart(4)} | ${t.completedJobs.toString().padStart(4)} | ${t.pendingJobs.toString().padStart(4)} | ${t.cancelledJobs.toString().padStart(4)} | ${(t.earnings / 100).toFixed(2).padStart(10)}`);
    }
  }

  console.log('\n⚡ Generating performance summaries...');
  console.log('   To generate snapshots, run the backend and call:');
  for (const date of TARGET_DATES) {
    console.log(`   POST /api/v1/admin/performance-summaries/${date}/generate`);
  }

  await client.close();
  console.log('\n✅ Seed complete. Use --cleanup to remove all test data.');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});