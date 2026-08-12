# Zrizin native push notifications

The application-side push pipeline is implemented for iOS and Android. The remaining release steps require Apple/Firebase credentials and a deployed Supabase Edge Function.

## What is already in code

- `@capacitor/push-notifications` permission, registration and action listeners.
- Opt-in in-app permission prompt; Zrizin does not surprise users with the OS dialog.
- iOS AppDelegate forwarding of APNs registration success/failure into Capacitor.
- Authenticated token registration/unregistration RPCs.
- Raw device-token table hidden from `anon` and `authenticated` roles.
- Token is disabled on sign-out.
- `push-dispatch` Supabase Edge Function sends Android tokens through FCM HTTP v1 and iOS tokens through APNs.
- Notification taps are restricted to a small allowlist of in-app routes.
- Invalid/unregistered tokens are disabled by the sender.

## Required Supabase Edge Function secrets

Set these through Supabase Edge Function secrets. Never commit them.

```text
ZRIZIN_PUSH_DISPATCH_SECRET=<high-entropy random value>
FIREBASE_SERVICE_ACCOUNT_JSON=<complete Firebase service-account JSON>
APNS_TEAM_ID=<Apple Developer Team ID>
APNS_KEY_ID=<APNs key ID>
APNS_PRIVATE_KEY=<contents of the .p8 APNs private key>
APNS_TOPIC=com.zrizin.app
APNS_ENVIRONMENT=sandbox
```

Use `APNS_ENVIRONMENT=production` for the shipping build.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied by the hosted Supabase Edge Function environment.

Deploy with:

```bash
supabase functions deploy push-dispatch --project-ref <project-ref>
```

The function has `verify_jwt = false` because it is intended for a database webhook, not a signed-in browser. It still rejects every request unless `x-zrizin-push-secret` exactly matches `ZRIZIN_PUSH_DISPATCH_SECRET`.

## Database webhook

After deploying the function, create a Supabase Database Webhook on:

- schema: `public`
- table: `user_notifications`
- event: `INSERT`
- destination: `https://<project-ref>.supabase.co/functions/v1/push-dispatch`
- header: `x-zrizin-push-secret: <same secret>`

The webhook's insert payload includes the notification record. `push-dispatch` reloads the notification by ID from Supabase before sending, so the webhook body is never trusted as the notification source of truth.

## Android / Firebase setup

1. Create/select the Firebase project used by Zrizin.
2. Register Android app id `com.zrizin.app`.
3. Put Firebase's `google-services.json` at `android/app/google-services.json`.
4. Enable the Firebase Cloud Messaging HTTP v1 API.
5. Create a Firebase service account permitted to send FCM messages and save its JSON as the `FIREBASE_SERVICE_ACCOUNT_JSON` Edge Function secret.
6. Build on a physical Android device and enable **Game alerts** inside Zrizin.

Do not commit `google-services.json` if it contains project configuration you do not want public; provide it through the release environment instead.

## iOS / APNs setup

1. In Apple Developer/Xcode, enable the **Push Notifications** capability for bundle id `com.zrizin.app`.
2. Create an APNs token-signing key (`.p8`) and record its Key ID and Team ID.
3. Store the key values only in Supabase Edge Function secrets.
4. Sign/install a device build with a provisioning profile carrying the APNs entitlement.
5. Start with `APNS_ENVIRONMENT=sandbox`; switch to `production` for the store build.
6. Enable **Game alerts** inside Zrizin and verify registration plus foreground/background/tap delivery on a real iPhone.

## Test sequence

1. Sign into Zrizin on a physical device.
2. Tap **Enable game alerts** and grant permission.
3. Confirm one enabled row exists in `device_push_tokens` for the user using an admin/server query (the client cannot read the token table).
4. Insert a representative `user_notifications` row through the normal game flow.
5. Confirm the database webhook invokes `push-dispatch`.
6. Verify the device receives the title/body and tapping opens the expected Zrizin screen.
7. Sign out and confirm the stored token is disabled.
8. Repeat for iOS and Android.

## Not yet verifiable in CI

CI can compile the Capacitor plugin into Android and the iOS simulator, but APNs/FCM delivery cannot be truthfully validated without platform credentials and physical devices.
