const TAGS = /<[^>]*>/g;

export function plainText(value: unknown, max = 200): string {
  return String(value ?? '')
    .replace(TAGS, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, max);
}

export function sanitizeContact(contact: {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  preferredDate?: string;
  preferredTime?: string;
  notes?: string;
}) {
  return {
    name: plainText(contact.name, 80),
    phone: String(contact.phone || '').replace(/\D/g, '').slice(-10),
    email: contact.email ? plainText(contact.email, 120) : undefined,
    address: plainText(contact.address, 240),
    preferredDate: contact.preferredDate
      ? plainText(contact.preferredDate, 40)
      : undefined,
    preferredTime: contact.preferredTime
      ? plainText(contact.preferredTime, 40)
      : undefined,
    notes: contact.notes ? plainText(contact.notes, 400) : undefined,
  };
}
