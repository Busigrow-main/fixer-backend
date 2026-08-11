import { Types } from 'mongoose';

/** Match technicianId stored as ObjectId or legacy string in MongoDB. */
export function technicianIdQuery(technicianId: string) {
  if (!Types.ObjectId.isValid(technicianId)) {
    return technicianId;
  }
  return { $in: [new Types.ObjectId(technicianId), technicianId] };
}

export function toTechnicianObjectId(technicianId: string): Types.ObjectId {
  return new Types.ObjectId(technicianId);
}

/** Normalize technicianId from a raw ObjectId, string, or populated document. */
export function resolveTechnicianId(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && '_id' in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
}
