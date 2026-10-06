# Azure email OTP login

Email login sends a 6-digit code through Azure Communication Services Email, stores only a bcrypt hash in MongoDB, and returns the same JWT as phone login after verify.

**You do not need your own domain to start.** Azure provides a managed sender such as `DoNotReply@xxxx.azurecomm.net`. Map `busigrow.in` (or any domain) later; only the `AZURE_EMAIL_SENDER` value changes.

## API

```http
POST /api/v1/auth/send-email-otp
Content-Type: application/json

{ "email": "you@example.com" }
```

```http
POST /api/v1/auth/verify-email-otp
Content-Type: application/json

{
  "email": "you@example.com",
  "otp": "123456",
  "phone": "9876543210",
  "fullName": "Optional"
}
```

`phone` is required only when no account exists for that email yet. Accounts remain keyed by phone.

In development, if Azure env vars are missing, the code is logged as `[EMAIL OTP]` and returned as `devOtp` in the send response. In production, Azure must be configured.

## Azure portal — no custom domain (recommended first)

Use the same resource group as the VM (for example `Busigrow-Fixxer_group`). Use data location **India** for both resources so they can be linked.

1. Create **Email Communication Services**. Name: `fixxer-email`. Data location: **India**. Region stays **Global**.
2. Open it → **Provision domains** → **Add domain** → choose **Azure managed domain** (not Custom domain). Wait until the domain status is **Verified**.
3. Copy the MailFrom / sender address. It looks like `DoNotReply@xxxx.azurecomm.net`. That is your temporary from-address.
4. Create **Communication Services**. Name: `fixxer-comms`. Data location: **India**.
5. Open Communication Services → **Email** → **Domains** → **Connect domain** → select the managed domain from step 2.
6. Open Communication Services → **Keys** → copy the **primary connection string**. Do not commit it or paste it into chat.
7. Optional smoke test in the portal: open Communication Services → **Try Email**, pick the managed MailFrom address, send to your own inbox, and confirm delivery.

No DNS records, no domain purchase, and **no allowed-inbox list** are required for the managed domain. Sending volume on `azurecomm.net` is limited; that is enough for OTP testing.

## Env on local Mac

Add to `fixer-backend/.env`:

```text
AZURE_COMMUNICATION_CONNECTION_STRING=<primary connection string>
AZURE_EMAIL_SENDER=DoNotReply@xxxx.azurecomm.net
```

Restart `npm run start:dev`.

Quick test:

```bash
curl -sS -X POST http://127.0.0.1:8081/api/v1/auth/send-email-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"your-inbox@gmail.com"}'
```

Then verify with the code from that inbox (or `devOtp` if Azure env is still empty).

Check spam if the first message does not show in the inbox. Managed-domain volume is low; if Azure returns a quota error, wait and retry or move to a custom domain later.

The OTP message uses a branded HTML template (`src/auth/templates/otp-email.template.ts`) with Fixxer red `#C8102E`, a wordmark header, the code block, security notice, and links to Terms, Privacy, and Warranty. Set `APP_PUBLIC_URL` so those links point at your site. Optionally set `FIXXER_BRAND_LOGO_URL` to an HTTPS logo image for the header.

## Env on the Azure VM

Add the same two keys to `/opt/busigrow/.env`, then:

```bash
cd /opt/busigrow
docker compose up -d --build backend
```

## Optional: custom domain later

When you own and control a domain (for example `busigrow.in`):

1. In Email Communication Services → **Provision domains** → **Add domain** → **Custom domain**.
2. Add the DNS records Azure shows (domain verification, SPF, DKIM).
3. Wait until the domain is **Verified**.
4. Connect that custom domain to the same Communication Services resource if it is not already connected.
5. Change only this in `.env` (local and/or VM):

```text
AZURE_EMAIL_SENDER=DoNotReply@busigrow.in
```

6. Restart the backend. No code change is required.

Until then, keep using the `azurecomm.net` sender for development and internal testing.
