# Zrizin device-data integration plan

Zrizin's web/PWA build must not pretend it can read protected health or screen-time data. Automatic tracking belongs in the native mobile shell and feeds the existing verified check-in/scoring pipeline.

## iOS

### Steps, runs, workouts
Use HealthKit from the native iOS target.

- Request only the read permissions needed by selected league tasks.
- Daily Steps maps to HealthKit step-count samples.
- Workout / runs map to HealthKit workout records (duration, activity type, route/distance where permitted).
- Normalize the device-local day before sending a daily snapshot to the React app.

Official references:
- https://developer.apple.com/documentation/healthkit
- https://developer.apple.com/documentation/healthkit/setting-up-healthkit
- https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/stepcount

### Screen time
Use Apple's Screen Time frameworks, primarily DeviceActivity + FamilyControls. This requires native entitlements/authorization and may require an app extension; it is not a normal browser API.

Official references:
- https://developer.apple.com/documentation/deviceactivity
- https://developer.apple.com/documentation/familycontrols

## Android

### Steps, runs, workouts
Use Health Connect.

- Steps maps to `StepsRecord`.
- Workouts map to exercise-session records and associated metrics.
- Android 14+ Health Connect can provide on-device step data when the user grants the relevant permission.

Official references:
- https://developer.android.com/health-and-fitness/guides/health-connect
- https://developer.android.com/health-and-fitness/guides/health-connect/develop/exercise-routes
- https://developer.android.com/health-and-fitness/guides/health-connect/develop/read-data

### Screen time
Use `UsageStatsManager`. The user must explicitly grant usage access in Android Settings.

Official reference:
- https://developer.android.com/reference/android/app/usage/UsageStatsManager

## React/native bridge already added

`src/lib/nativeHealthBridge.ts` defines the contract the native shell exposes to the React app:

- request permission for `steps`, `workouts`, and/or `screen_time_minutes`
- read one normalized daily snapshot
- identify the native platform/source

The current browser build intentionally returns no bridge. A future Capacitor/native implementation should install `window.ZrizinHealth` and keep platform SDK code outside the React scoring layer.

## Scoring rules

Automatic data must enter Zrizin through the same `daily_checkins` → verification → `scoring_events` path as manual data. Never write directly to matchup totals.

Recommended sync behavior:

1. Read the latest device snapshot.
2. Upsert the applicable daily check-in with source/timestamp metadata.
3. Let the database scoring trigger recalculate the score.
4. Re-sync when HealthKit / Health Connect data changes.
5. Preserve manual fallback only where the league rules permit it.

## Privacy defaults

- Ask only for metrics corresponding to tasks the player actually uses.
- Keep raw device detail on-device when a daily aggregate is enough.
- Make the source visible on the scored check-in.
- Let users revoke/disconnect without breaking manual tasks.
- Do not claim background sync until the native implementation and OS scheduling behavior are tested on real devices.
