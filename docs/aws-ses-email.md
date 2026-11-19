# Email via Amazon SES

All customer email (login codes, booking confirmations, assignment emails, bills with PDF) goes
through `src/auth/email.service.ts`. It uses **Amazon SES** when `SES_FROM_EMAIL` is set
(or `EMAIL_PROVIDER=ses`), and falls back to Azure only if `EMAIL_PROVIDER=azure`.

## One-time AWS setup (region: Asia Pacific (Mumbai) ap-south-1)

1. **Verify the domain** — SES → Configuration → Identities → Create identity → *Domain* → `fixxer.in`,
   Easy DKIM, RSA 2048. Add the **3 CNAME records** it shows at your DNS provider. Status turns
   *Verified* in ~5–30 min.
2. **DMARC** (helps Gmail/Outlook trust you) — DNS TXT record:
   `_dmarc.fixxer.in` → `v=DMARC1; p=none; rua=mailto:myfixxer@gmail.com`
3. **Leave the sandbox** — SES → Account dashboard → *Request production access*:
   mail type **Transactional**, website `https://fixxer.in`. Until approved, SES only delivers to
   addresses you verified under Identities (add your own email to test). Approval: hours to ~3 days;
   if AWS emails asking for details, reply (login codes + booking/bill receipts to customers who
   signed up; bounces/complaints handled via SES suppression list).
4. **Permission for the server** — IAM → Roles → Create role → *AWS service: EC2* → skip policies →
   name `fixxer-ec2`. Then add an inline policy:
   ```json
   { "Version": "2012-10-17",
     "Statement": [{ "Effect": "Allow",
       "Action": ["ses:SendEmail", "ses:SendRawEmail"],
       "Resource": "*" }] }
   ```
   Attach it: EC2 → Instances → Fixer-production1 → Actions → Security → **Modify IAM role** → `fixxer-ec2`.
   No access keys are stored anywhere; the SDK picks up the role automatically.

## Server config

In `/opt/fixxer/shared/backend.env`:
```
EMAIL_PROVIDER=ses
SES_FROM_EMAIL="Fixxer <no-reply@fixxer.in>"
SES_REGION=ap-south-1
```
then `pm2 reload fixxer-api --update-env`.

## Cost
$0.10 per 1,000 emails (+ attachment data); covered by Free Tier credits.

## Troubleshooting (`pm2 logs fixxer-api`)
| Log says | Fix |
|---|---|
| `MessageRejected: Email address is not verified` | Still in sandbox — verify the recipient, or wait for production access |
| `AccessDeniedException` / `not authorized to perform ses:SendRawEmail` | IAM role not attached or missing the policy |
| `CredentialsProviderError` | No IAM role on the instance |
| `Amazon SES SDK missing` | `npm install @aws-sdk/client-sesv2` wasn't committed |
