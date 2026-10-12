import PDFDocument from 'pdfkit';

export type InvoicePdfInput = {
  invoiceNumber: string;
  issuedAt: Date;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: string;
  pincode: string;
  serviceName: string;
  brand: string;
  technicianName: string;
  serviceTotal: number;
  parts: {
    partName: string;
    quantity: number;
    cost: number;
    serialNumber?: string;
    warrantyMonths?: number;
    warrantyCovered?: boolean;
  }[];
  additionalCharges: { label: string; amount: number }[];
  partsTotal: number;
  totalAmount: number;
  warrantyPeriod: string;
  signature?: Buffer | null;
};

const RED = '#C8102E';
const INK = '#1A1A1C';
const MUTED = '#64646B';

export function partWarrantyNote(part: {
  warrantyMonths?: number;
  warrantyCovered?: boolean;
}): string {
  if (part.warrantyCovered) return 'Warranty replacement · no charge';
  const months = Number(part.warrantyMonths) || 0;
  if (months > 0) return `${months}-month part warranty`;
  return '';
}

function inr(amount: number): string {
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
  return `Rs. ${formatted}`;
}

export function buildInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.rect(0, 0, doc.page.width, 92).fill(RED);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(26).text('Fixxer', 48, 28);
    doc.font('Helvetica').fontSize(10).text('Service bill  ·  Cool Air Refrigeration, Patna', 48, 58);

    doc.fillColor(INK).font('Helvetica-Bold').fontSize(16).text('Service bill', 48, 112);
    doc.font('Helvetica').fontSize(10).fillColor(MUTED);
    doc.text(`Invoice no.  ${input.invoiceNumber}`, 48, 136);
    doc.text(
      `Date  ${input.issuedAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      48,
      152,
    );

    doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text('Bill to', 48, 184);
    doc.font('Helvetica').fontSize(10).fillColor(INK);
    doc.text(input.customerName || 'Customer', 48, 202);
    doc.fillColor(MUTED);
    doc.text(input.customerPhone || '—', 48, 216);
    doc.text(input.customerEmail || '—', 48, 230);
    doc.text(`${input.address || '—'}${input.pincode ? `, ${input.pincode}` : ''}`, 48, 244, {
      width: 320,
    });

    doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text('Job', 380, 184);
    doc.font('Helvetica').fontSize(10).fillColor(MUTED);
    doc.text(input.serviceName || 'Appliance repair', 380, 202, { width: 160 });
    doc.text(input.brand ? `Brand  ${input.brand}` : '', 380, 230, { width: 160 });
    doc.text(input.technicianName ? `Technician  ${input.technicianName}` : '', 380, 246, {
      width: 160,
    });

    let y = 290;
    doc.rect(48, y, 500, 22).fill('#FDE7E9');
    doc.fillColor(RED).font('Helvetica-Bold').fontSize(9);
    doc.text('Description', 56, y + 6);
    doc.text('Qty', 320, y + 6);
    doc.text('Rate', 370, y + 6);
    doc.text('Amount', 450, y + 6);
    y += 28;

    const rows: { label: string; note: string; qty: string; rate: number; amount: number }[] = [
      { label: input.serviceName || 'Service charge', note: '', qty: '1', rate: input.serviceTotal, amount: input.serviceTotal },
      ...input.parts.map((part) => {
        const qty = part.quantity || 1;
        const rate = part.warrantyCovered ? 0 : part.cost || 0;
        const serial = part.serialNumber ? `Serial ${part.serialNumber}` : '';
        const cover = partWarrantyNote(part);
        return {
          label: part.partName || 'Spare part',
          note: [serial, cover].filter(Boolean).join(' · '),
          qty: String(qty),
          rate,
          amount: rate * qty,
        };
      }),
      ...input.additionalCharges.map((charge) => ({
        label: charge.label || 'Additional charge',
        note: '',
        qty: '1',
        rate: charge.amount || 0,
        amount: charge.amount || 0,
      })),
    ];

    doc.font('Helvetica').fontSize(10).fillColor(INK);
    for (const row of rows) {
      doc.fillColor(INK).fontSize(10).text(row.label, 56, y, { width: 250 });
      doc.text(row.qty, 320, y);
      doc.text(inr(row.rate), 360, y, { width: 70 });
      doc.text(inr(row.amount), 430, y, { width: 110, align: 'right' });
      if (row.note) {
        doc.fontSize(8).fillColor(RED).text(row.note, 56, y + 13, { width: 250 });
        y += 32;
      } else {
        y += 20;
      }
    }

    y += 8;
    doc.moveTo(48, y).lineTo(548, y).strokeColor('#E8E8EA').stroke();
    y += 14;
    doc.font('Helvetica-Bold').fontSize(12).fillColor(INK);
    doc.text('Total', 360, y);
    doc.text(inr(input.totalAmount), 430, y, { width: 110, align: 'right' });
    y += 18;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED);
    doc.text('GST is not added on this service bill.', 360, y, { width: 180, align: 'right' });

    y += 40;
    const covered = input.parts
      .map((part) => {
        const note = partWarrantyNote(part);
        return note ? `${part.partName || 'Spare part'} — ${note}` : '';
      })
      .filter(Boolean);
    doc.font('Helvetica').fontSize(9).fillColor(MUTED);
    doc.text(
      [
        `Warranty: labour for the same fault is covered for ${input.warrantyPeriod || '60 days'} from completion.`,
        covered.length ? `Parts on this bill: ${covered.join('; ')}.` : '',
      ]
        .filter(Boolean)
        .join(' '),
      48,
      y,
      { width: 500 },
    );

    y += 56;
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text('Authorised copy', 48, y);
    y += 18;
    if (input.signature) {
      try {
        doc.image(input.signature, 48, y, { fit: [140, 56] });
      } catch {
        doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('Signature on file', 48, y);
      }
      doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('Customer signature', 48, y + 62);
    } else {
      doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(
        'Digitally issued by Fixxer. This copy does not require a wet-ink signature.',
        48,
        y,
        { width: 280 },
      );
    }

    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text('For Fixxer', 380, y);
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('Authorised signatory', 380, y + 36);
    doc.text('Cool Air Refrigeration', 380, y + 50);
    doc.text('MLA Colony, Raja Bazar, Patna 800014', 380, y + 64);
    doc.text('+91 70047 71388', 380, y + 78);

    doc.end();
  });
}
