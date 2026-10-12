export function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

export type EmailLine = {
  label: string;
  detail?: string;
  amount: number;
};

/** Fixxer tokens from the app theme. */
const RED = '#C8102E';
const RED_SOFT = '#FDE7E9';
const INK = '#1A1A1C';
const MUTED = '#64646B';
const PAPER = '#FFFFFF';
const CANVAS = '#FAFAFA';
const RULE = '#E8E8EA';

export function renderLedger(lines: EmailLine[], totalLabel: string, total: number): string {
  const rows = lines
    .map((line) => {
      const detail = line.detail
        ? `<div style="margin-top:3px;font-size:12px;line-height:1.4;color:${MUTED};">${escapeHtml(line.detail)}</div>`
        : '';
      return `<tr>
        <td style="padding:14px 0;border-bottom:1px solid ${RULE};vertical-align:top;">
          <div style="font-size:14px;color:${INK};">${escapeHtml(line.label)}</div>
          ${detail}
        </td>
        <td style="padding:14px 0 14px 16px;border-bottom:1px solid ${RULE};text-align:right;vertical-align:top;font-size:14px;color:${INK};white-space:nowrap;">
          ${escapeHtml(formatInr(line.amount))}
        </td>
      </tr>`;
    })
    .join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0;">
    ${rows}
    <tr>
      <td style="padding:16px 14px;background:${RED_SOFT};font-family:Georgia,'Times New Roman',serif;font-size:18px;color:${INK};border-radius:12px 0 0 12px;">
        ${escapeHtml(totalLabel)}
      </td>
      <td style="padding:16px 14px;background:${RED_SOFT};text-align:right;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:${RED};white-space:nowrap;border-radius:0 12px 12px 0;">
        ${escapeHtml(formatInr(total))}
      </td>
    </tr>
  </table>
  <p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:${MUTED};">
    GST is not added on top of this figure.
  </p>`;
}

export function renderEmail(input: {
  eyebrow: string;
  headline: string;
  lede: string;
  bodyHtml: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(input.headline)}</title>
</head>
<body style="margin:0;padding:0;background:${CANVAS};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CANVAS};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;">
          <tr>
            <td style="background:${RED};border-radius:20px 20px 0 0;padding:28px 36px;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:700;letter-spacing:-0.4px;color:#FFFFFF;">Fixxer<span style="color:#FFB3B1;">.</span></div>
              <div style="margin-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#FFD0D4;">
                ${escapeHtml(input.eyebrow)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:${PAPER};border:1px solid ${RULE};border-top:0;border-radius:0 0 20px 20px;padding:32px 36px 28px;">
              <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:1.08;font-weight:500;color:${INK};">
                ${escapeHtml(input.headline)}
              </h1>
                ${escapeHtml(input.headline)}
              </h1>
              <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${MUTED};">
                ${input.lede}
              </p>
              <div style="height:1px;background:${RULE};margin:28px 0;"></div>
              ${input.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:22px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:${MUTED};">
              Cool Air Refrigeration · MLA Colony, Raja Bazar, Patna 800014<br/>
              +91 70047 71388 · busigrowindia@gmail.com<br/>
              Labour for the same fault is covered for 60 days. Genuine Fixxer-installed parts are covered for 6 months unless the bill says otherwise.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
