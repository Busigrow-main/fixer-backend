export type OtpEmailContent = {
  subject: string;
  plainText: string;
  html: string;
};

/** Fixxer brand tokens — match frontend globals.css */
const BRAND = {
  primary: '#C8102E',
  primaryContainer: '#FDE7E9',
  onPrimary: '#FFFFFF',
  onSurface: '#1A1A1C',
  onSurfaceVariant: '#64646B',
  surface: '#FAFAFA',
  surfaceBright: '#FFFFFF',
  outline: '#E8E8EA',
  secondary: '#D48F0E',
} as const;

function appBaseUrl(): string {
  return (
    process.env.APP_PUBLIC_URL?.replace(/\/$/, '') ||
    process.env.FRONTEND_URL?.replace(/\/$/, '') ||
    'http://135.222.40.140'
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Branded Fixxer login OTP email (table layout + inline styles for mail clients).
 */
export function buildOtpEmail(code: string, toEmail: string): OtpEmailContent {
  const safeCode = escapeHtml(String(code).trim());
  const safeTo = escapeHtml(toEmail);
  const base = appBaseUrl();
  const termsUrl = `${base}/terms`;
  const privacyUrl = `${base}/privacy`;
  const warrantyUrl = `${base}/warranty`;

  const subject = 'Your Fixxer login code';

  const plainText = [
    'Fixxer — login verification',
    '',
    `Your one-time login code is: ${code}`,
    '',
    'This code expires in 5 minutes.',
    'Enter it on the Fixxer sign-in screen to continue.',
    '',
    'If you did not request this code, you can ignore this email. Someone may have typed your address by mistake.',
    'Never share this code with anyone. Fixxer staff will never ask you for it by phone or WhatsApp.',
    '',
    `Sent to: ${toEmail}`,
    '',
    `Terms of Service: ${termsUrl}`,
    `Privacy Policy: ${privacyUrl}`,
    `Warranty Policy: ${warrantyUrl}`,
    '',
    'Cool Air Refrigeration · MLA Colony, Raja Bazar, Patna 800014',
    'Support: +91 70047 71388 · busigrowindia@gmail.com',
    '© Fixxer. All rights reserved.',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.surface};-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.surface};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:${BRAND.surfaceBright};border-radius:16px;overflow:hidden;border:1px solid ${BRAND.outline};">
          <!-- Header -->
          <tr>
            <td style="background-color:#C8102E;padding:28px 32px;text-align:left;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:700;letter-spacing:-0.4px;color:#FFFFFF;">Fixxer<span style="color:#FFB3B1;">.</span></div>
              <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#FFD0D4;">
                Master appliance repair
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 8px;font-family:Arial,Helvetica,sans-serif;color:${BRAND.onSurface};">
              <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;line-height:1.25;color:${BRAND.onSurface};">
                Your login code
              </h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:${BRAND.onSurfaceVariant};">
                Use this one-time code to sign in to Fixxer. It expires in
                <strong style="color:${BRAND.onSurface};">5 minutes</strong>.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center" style="background-color:${BRAND.primaryContainer};border-radius:12px;padding:22px 16px;border:1px solid #F5C2C7;">
                    <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${BRAND.primary};">
                      One-time password
                    </p>
                    <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:700;letter-spacing:10px;color:${BRAND.primary};line-height:1.2;">
                      ${safeCode}
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:14px;line-height:1.55;color:${BRAND.onSurfaceVariant};">
                Enter the code on the Fixxer sign-in screen. Do not forward this email.
              </p>
              <p style="margin:0 0 24px;font-size:13px;line-height:1.55;color:${BRAND.onSurfaceVariant};">
                This message was sent to <strong style="color:${BRAND.onSurface};">${safeTo}</strong>.
              </p>

              <!-- Security -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;background-color:${BRAND.surface};border-radius:12px;border:1px solid ${BRAND.outline};">
                <tr>
                  <td style="padding:16px 18px;font-family:Arial,Helvetica,sans-serif;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND.secondary};">
                      Security notice
                    </p>
                    <p style="margin:0;font-size:13px;line-height:1.55;color:${BRAND.onSurfaceVariant};">
                      Fixxer will never ask for this code by phone, SMS, or WhatsApp.
                      If you did not request a login code, ignore this email — your account stays secure.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Legal footer -->
          <tr>
            <td style="padding:0 32px 28px;font-family:Arial,Helvetica,sans-serif;">
              <hr style="border:0;border-top:1px solid ${BRAND.outline};margin:0 0 20px;" />
              <p style="margin:0 0 10px;font-size:12px;line-height:1.5;color:${BRAND.onSurfaceVariant};">
                By signing in you agree to our
                <a href="${termsUrl}" style="color:${BRAND.primary};text-decoration:underline;">Terms of Service</a>,
                <a href="${privacyUrl}" style="color:${BRAND.primary};text-decoration:underline;">Privacy Policy</a>,
                and
                <a href="${warrantyUrl}" style="color:${BRAND.primary};text-decoration:underline;">Warranty Policy</a>.
              </p>
              <p style="margin:0 0 10px;font-size:11px;line-height:1.5;color:${BRAND.onSurfaceVariant};">
                This is a transactional message about your Fixxer account. It is not marketing mail.
                Personal data in this message is used only to complete sign-in, as described in our Privacy Policy.
              </p>
              <p style="margin:0 0 4px;font-size:11px;line-height:1.5;color:${BRAND.onSurfaceVariant};">
                Cool Air Refrigeration · MLA Colony, Raja Bazar, Patna 800014
              </p>
              <p style="margin:0 0 12px;font-size:11px;line-height:1.5;color:${BRAND.onSurfaceVariant};">
                Support:
                <a href="tel:+917004771388" style="color:${BRAND.primary};text-decoration:none;">+91 70047 71388</a>
                ·
                <a href="mailto:busigrowindia@gmail.com" style="color:${BRAND.primary};text-decoration:none;">busigrowindia@gmail.com</a>
              </p>
              <p style="margin:0;font-size:11px;color:${BRAND.onSurfaceVariant};">
                © ${new Date().getFullYear()} Fixxer. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, plainText, html };
}
