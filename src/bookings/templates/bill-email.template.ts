import {
  EmailLine,
  escapeHtml,
  formatInr,
  renderEmail,
  renderLedger,
} from '../../mail/email-layout';

export type BookingMailInput = {
  customerName: string;
  repairCode: string;
  invoiceNumber: string;
  serviceName: string;
  address: string;
  schedule?: string;
  technicianName?: string;
  lines: EmailLine[];
  total: number;
  totalLabel: string;
  partWarranties?: string[];
};

function facts(input: BookingMailInput): string {
  const rows = [
    ['Repair', input.repairCode],
    ['Service', input.serviceName],
    ['Address', input.address || '—'],
    input.schedule ? ['When', input.schedule] : null,
    input.technicianName ? ['Technician', input.technicianName] : null,
  ].filter(Boolean) as string[][];

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    ${rows
      .map(
        ([label, value]) => `<tr>
          <td style="padding:0 0 10px;width:110px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#C8102E;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:#1A1A1C;">${escapeHtml(value)}</td>
        </tr>`,
      )
      .join('')}
  </table>`;
}

export type ConfirmationMailInput = {
  customerName: string;
  repairCode: string;
  serviceName: string;
  address: string;
  schedule?: string;
  notes?: string;
  technicianName?: string;
  technicianPhone?: string;
  technicianSkills?: string;
};

function appBase(): string {
  return (
    process.env.APP_PUBLIC_URL?.replace(/\/$/, '') ||
    process.env.FRONTEND_URL?.replace(/\/$/, '') ||
    'http://135.222.40.140'
  );
}

function linkRow(label: string, href: string): string {
  return `<tr>
    <td style="padding:0 8px 8px 0;">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:10px 14px;border:1px solid #F5C2C7;border-radius:999px;background:#FDE7E9;color:#C8102E;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;text-decoration:none;">${escapeHtml(label)}</a>
    </td>
  </tr>`;
}

export function buildConfirmationEmail(input: ConfirmationMailInput) {
  const name = input.customerName || 'there';
  const base = appBase();
  const links = [
    ['Your bookings', `${base}/my-bookings`],
    ['Spare parts shop', `${base}/spare-parts`],
    ['Appliances shop', `${base}/spare-parts/appliances`],
    ['Warranty', `${base}/warranty`],
    ['Terms', `${base}/terms`],
  ];
  const subject = `Fixxer confirmed your repair ${input.repairCode}`;
  const techLine = input.technicianName
    ? `${input.technicianName}${input.technicianPhone ? ` · ${input.technicianPhone}` : ''}${input.technicianSkills ? ` · ${input.technicianSkills}` : ''}`
    : 'A Fixxer technician will be assigned and shown on your booking.';
  const plainText = [
    `Hello ${name},`,
    '',
    `Your ${input.serviceName} booking is confirmed.`,
    `Repair ${input.repairCode}`,
    input.address ? `Address: ${input.address}` : '',
    input.schedule ? `When: ${input.schedule}` : '',
    `Technician: ${techLine}`,
    input.notes ? `Notes: ${input.notes}` : '',
    '',
    'Quick links',
    ...links.map(([label, href]) => `${label}: ${href}`),
    '',
    'Cool Air Refrigeration · MLA Colony, Raja Bazar, Patna 800014',
    '+91 70047 71388 · busigrowindia@gmail.com',
  ]
    .filter((line) => line !== '')
    .join('\n');

  const technicianBlock = input.technicianName
    ? `<div style="margin-top:8px;padding:16px 18px;background:#FDE7E9;border-radius:16px;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#C8102E;">Your technician</div>
        <div style="margin-top:8px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1A1A1C;">${escapeHtml(input.technicianName)}</div>
        ${input.technicianPhone ? `<div style="margin-top:4px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1A1A1C;">${escapeHtml(input.technicianPhone)}</div>` : ''}
        ${input.technicianSkills ? `<div style="margin-top:4px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64646B;">${escapeHtml(input.technicianSkills)}</div>` : ''}
      </div>`
    : `<p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#64646B;">A Fixxer technician will be assigned shortly. Their name and phone will show on your booking.</p>`;

  const notesBlock = input.notes
    ? `<div style="margin-top:18px;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#C8102E;">Notes</div>
        <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1A1A1C;">${escapeHtml(input.notes)}</p>
      </div>`
    : '';

  const html = renderEmail({
    eyebrow: 'Booking confirmed',
    headline: `You're on the book, ${name}.`,
    lede: `We have confirmed your <strong style="color:#1A1A1C;">${escapeHtml(input.serviceName)}</strong> visit. The details below are what the technician will follow.`,
    bodyHtml: `${facts({
      customerName: input.customerName,
      repairCode: input.repairCode,
      invoiceNumber: '',
      serviceName: input.serviceName,
      address: input.address,
      schedule: input.schedule,
      lines: [],
      total: 0,
      totalLabel: '',
    })}
      ${technicianBlock}
      ${notesBlock}
      <div style="height:1px;background:#E8E8EA;margin:22px 0 16px;"></div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#C8102E;">Quick links</div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
        ${links.map(([label, href]) => linkRow(label, href)).join('')}
      </table>`,
  });

  return { subject, plainText, html };
}

export function buildBillEmail(input: BookingMailInput) {
  const name = input.customerName || 'there';
  const subject = `Your Fixxer bill ${input.invoiceNumber} is ready`;
  const plainText = [
    `Hello ${name},`,
    '',
    `Your ${input.serviceName} job is closed. The invoice PDF is attached.`,
    `Invoice ${input.invoiceNumber}`,
    `Repair ${input.repairCode}`,
    '',
    'Final breakdown',
    ...input.lines.map((line) => `${line.label}${line.detail ? ` (${line.detail})` : ''}: ${formatInr(line.amount)}`),
    `${input.totalLabel}: ${formatInr(input.total)}`,
    'GST is not added on top.',
    '',
    'Labour for the same fault is covered for 60 days from completion.',
    ...(input.partWarranties?.length
      ? ['Parts with warranty', ...input.partWarranties]
      : []),
    'Keep this email with the attached bill.',
    '',
    'Cool Air Refrigeration · MLA Colony, Raja Bazar, Patna 800014',
    '+91 70047 71388 · busigrowindia@gmail.com',
  ].join('\n');

  const html = renderEmail({
    eyebrow: `Invoice ${input.invoiceNumber}`,
    headline: 'The job is closed.',
    lede: `Hello ${escapeHtml(name)}. Your <strong style="color:#1A1A1C;">${escapeHtml(input.serviceName)}</strong> visit is finished. The signed invoice is attached. The figures below are the final bill.`,
    bodyHtml: `${facts(input)}
      <div style="height:1px;background:#E8E8EA;margin:8px 0 18px;"></div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#C8102E;">Final breakdown</div>
      ${renderLedger(input.lines, input.totalLabel, input.total)}
      <p style="margin:22px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#64646B;">
        Labour for the same fault is covered for 60 days from completion.
      </p>
      ${
        input.partWarranties?.length
          ? `<div style="margin-top:16px;padding:16px 18px;background:#FDE7E9;border-radius:16px;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#C8102E;">Parts with warranty</div>
              ${input.partWarranties
                .map(
                  (line) =>
                    `<p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:#1A1A1C;">${escapeHtml(line)}</p>`,
                )
                .join('')}
            </div>`
          : ''
      }`,
  });

  return { subject, plainText, html };
}

export function buildEmailPreviewPage(): string {
  const sampleLines: EmailLine[] = [
    { label: 'Microwave repair visit', detail: 'Base service charge', amount: 400 },
    { label: 'Godrej turntable motor', detail: 'Qty 2 · ₹757.50 each · serial E2E-BILL-335 · 12-month part warranty', amount: 1515 },
    { label: 'Call-out', detail: 'Other charge', amount: 50 },
  ];
  const shared = {
    customerName: 'Abhas',
    repairCode: '#18C8FE',
    invoiceNumber: 'FX-18C8FE',
    serviceName: 'Microwave repair',
    address: 'Boring Road, Patna 800001',
    schedule: 'Mon 12 Oct · Afternoon',
    technicianName: 'Surya',
    lines: sampleLines,
    total: 1965,
    totalLabel: 'Total',
    partWarranties: ['Godrej turntable motor — 12-month part warranty'],
  };
  const confirmation = buildConfirmationEmail({
    customerName: 'Abhas',
    repairCode: '#18C8FE',
    serviceName: 'Microwave repair',
    address: 'Boring Road, Patna 800001',
    schedule: 'Mon 12 Oct · Afternoon',
    technicianName: 'Surya',
    technicianPhone: '+91 90000 11111',
    technicianSkills: 'Microwave · Refrigerator',
    notes: 'Turntable not spinning. Please call before arriving.',
  });
  const closed = buildBillEmail(shared);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Fixxer email samples</title>
  <style>
    body { margin: 0; background: #FAFAFA; color: #1A1A1C; font-family: Georgia, serif; }
    header { max-width: 720px; margin: 0 auto; padding: 48px 20px 12px; }
    h1 { font-weight: 500; font-size: 42px; margin: 0; }
    h1 span { color: #C8102E; }
    p { font-family: Arial, sans-serif; color: #64646B; line-height: 1.5; }
    section { max-width: 720px; margin: 0 auto 48px; padding: 0 12px; }
    h2 { font-weight: 500; font-size: 18px; letter-spacing: 0.14em; text-transform: uppercase; color: #C8102E; }
    iframe { width: 100%; height: 920px; border: 1px solid #E8E8EA; border-radius: 20px; background: #FAFAFA; }
  </style>
</head>
<body>
  <header>
    <h1>Sample <span>emails</span></h1>
    <p>Confirmation goes out when an admin sets the booking to confirmed. The closing email and the attached service bill go out when the job is closed. A part that carries a warranty is named on both.</p>
  </header>
  <section>
    <h2>After confirmation</h2>
    <iframe srcdoc="${escapeHtml(confirmation.html)}"></iframe>
  </section>
  <section>
    <h2>After the job is closed</h2>
    <iframe srcdoc="${escapeHtml(closed.html)}"></iframe>
  </section>
  <section>
    <h2>Service bill</h2>
    <iframe src="bill" style="height:1100px;background:#fff;"></iframe>
  </section>
</body>
</html>`;
}
