import {
  buildChangeEvent,
  omitTechnicianForbiddenBookingFields,
} from './booking-change-history';

describe('booking-change-history', () => {
  it('builds append-only events with actor, field, previous/next and reason', () => {
    const first = buildChangeEvent({
      field: 'status',
      previous: 'ASSIGNED',
      next: 'IN_PROGRESS',
      actorRole: 'TECHNICIAN',
      actorId: '507f1f77bcf86cd799439011',
      reason: 'Started work',
    });
    const correction = buildChangeEvent({
      field: 'status',
      previous: 'IN_PROGRESS',
      next: 'ASSIGNED',
      actorRole: 'ADMIN',
      actorId: '507f1f77bcf86cd799439012',
      reason: 'Mistake — revert',
    });

    expect(first.previous).toBe('ASSIGNED');
    expect(first.next).toBe('IN_PROGRESS');
    expect(first.actorRole).toBe('TECHNICIAN');
    expect(String(first.actorId)).toBe('507f1f77bcf86cd799439011');
    expect(correction.reason).toContain('Mistake');
    // Corrections are separate events — callers push both; neither overwrites.
    expect(first).not.toEqual(correction);
  });

  it('strips history and admin-only fields from technician payloads', () => {
    const redacted = omitTechnicianForbiddenBookingFields({
      _id: 'b1',
      status: 'ASSIGNED',
      changeHistory: [{ field: 'status' }],
      adminNotes: ['secret'],
      reviewHistory: [{ status: 'APPROVED' }],
      reviewRemarks: 'internal',
      reviewStatus: 'APPROVED',
    });

    expect(redacted.status).toBe('ASSIGNED');
    expect(redacted.reviewStatus).toBe('APPROVED');
    expect(redacted.changeHistory).toBeUndefined();
    expect(redacted.adminNotes).toBeUndefined();
    expect(redacted.reviewHistory).toBeUndefined();
    expect(redacted.reviewRemarks).toBeUndefined();
  });
});
