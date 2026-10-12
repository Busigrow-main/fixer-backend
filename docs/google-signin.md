# Google sign-in

Customers can continue with Google on `/login`. The browser gets a Google ID token; the Nest API verifies it and returns the same Fixxer JWT as phone login.

## Flow

1. User taps **Continue with Google** on the login page.
2. Google Identity Services returns an ID token to the browser.
3. Frontend posts to `POST /api/v1/auth/google` with `{ "idToken": "..." }`.
4. Backend verifies the token with `GOOGLE_CLIENT_ID`, finds or creates the user, returns `{ "access_token": "..." }`.
5. Google sign-in does not ask for a mobile number. The booking form collects the contact number, and that number is saved on the user account when the booking is created.

Accounts stay phone-keyed for bookings. Google links `googleId` + email on the user document.

## Google Cloud Console setup

1. Open [Google Cloud Console](https://console.cloud.google.com/) → create or pick a project (for example `fixxer`).
2. **APIs & Services** → **OAuth consent screen**
   - User type: **External**
   - App name: `Fixxer`
   - Support email: your Gmail
   - Authorized domains: add later when you have a real domain; for IP/localhost testing you can leave this and stay in **Testing**
   - Add test users (your Gmail) while the app is in Testing
3. **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `Fixxer Web`
   - **Authorized JavaScript origins**:
     - `http://localhost:3000`
     - `http://127.0.0.1:3000`
     - `http://135.222.40.140` (deployed site)
   - **Authorized redirect URIs** (GIS button often works with origins only; add if Google asks):
     - `http://localhost:3000`
     - `http://135.222.40.140`
4. Copy the **Client ID** (ends with `.apps.googleusercontent.com`). You do **not** need the client secret for this ID-token flow.

## Env — backend (`fixer-backend/.env`)

```text
GOOGLE_CLIENT_ID=123456789-xxxx.apps.googleusercontent.com
```

Restart `npm run start:dev`.

## Env — frontend (`fixer-frontend/.env.local`)

```text
NEXT_PUBLIC_GOOGLE_CLIENT_ID=123456789-xxxx.apps.googleusercontent.com
NEXT_PUBLIC_API_URL=http://127.0.0.1:8081/api/v1
```

Restart `npm run dev`. The Google button only renders when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set.

## Deployed VM

Add `GOOGLE_CLIENT_ID` to `/opt/busigrow/.env` and rebuild backend.  
Add `NEXT_PUBLIC_GOOGLE_CLIENT_ID` as a build arg for the frontend image (same value), then rebuild frontend so Next bakes it in.

## Test

1. Open `http://localhost:3000/login`
2. Click Continue with Google and pick a test-user Google account
3. Existing Fixxer user with that email → signed in
4. Brand-new Google email → signed in with no phone. The number entered while booking a service is stored on the account.
