# Zrizin native health integrations

Zrizin now has real native Steps and Workout readers in the committed Capacitor iOS/Android projects. The web/PWA intentionally remains manual because browsers cannot read protected HealthKit/Health Connect stores.

## What is implemented

The React scoring surface uses `src/lib/nativeHealthBridge.ts` to call the native Capacitor plugin named `ZrizinHealth`.

On today's Tasks screen, **Sync today**:

1. requests only Steps and Workout access;
2. reads a device-local daily aggregate;
3. maps device Steps to Zrizin's Steps task and total workout minutes to the Workout task;
4. upserts those values through the existing authenticated `daily_checkins` mutation;
5. attaches `apple_health` or `health_connect` source metadata; and
6. lets the normal database trigger create `scoring_events`, weekly totals, matchup/leaderboard state, and celebrations.

There is no separate native scoring engine and no direct write to standings or matchup totals.

## iOS — Apple HealthKit

Implemented in `ios/App/App/AppDelegate.swift` as the native `ZrizinHealth` Capacitor plugin.

Current reads:

- `HKQuantityTypeIdentifier.stepCount` via a cumulative daily `HKStatisticsQuery`;
- `HKWorkout` records for the selected local day;
- workout duration and basic activity labels;
- workout distance when HealthKit supplies it.

`Info.plist` includes `NSHealthShareUsageDescription`. Zrizin requests read access only; it does not write health data.

### Remaining iOS release setup

A signed device build still needs the **HealthKit capability/entitlement** enabled for bundle id `com.zrizin.app` in the Apple Developer/Xcode signing configuration. That cannot be validated truthfully by an unsigned simulator build.

After the capability is attached, test on a physical iPhone with representative Apple Health data and verify permission denial, partial data, same-day resync, timezone/day boundaries, and edited/deleted Health data.

Official references:

- https://developer.apple.com/documentation/healthkit
- https://developer.apple.com/documentation/healthkit/setting-up-healthkit
- https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/stepcount

## Android — Health Connect

Implemented in `android/app/src/main/java/com/zrizin/app/ZrizinHealthPlugin.java` and registered from `MainActivity`.

The current first release path uses Android 14+ system Health Connect APIs:

- `android.permission.health.READ_STEPS`;
- `android.permission.health.READ_EXERCISE`;
- daily `StepsRecord` aggregation;
- `ExerciseSessionRecord` duration aggregation.

The Android manifest also declares the Health Connect package query and permission-usage intent required by the platform flow.

### Remaining Android release setup

The current native reader deliberately targets Android 14+ first. Older supported Android versions keep manual scoring until the Jetpack Health Connect compatibility path is added and device-tested.

Before Play Store release, replace the temporary permission-usage destination with Zrizin's final privacy-policy/health-permissions screen and complete the Play Console Health Apps declaration.

Official references:

- https://developer.android.com/health-and-fitness/guides/health-connect
- https://developer.android.com/health-and-fitness/guides/health-connect/develop/read-data
- https://developer.android.com/health-and-fitness/guides/health-connect/develop/get-started

## Screen Time

Screen Time is **not** being represented as a working health integration yet.

### iOS

Apple Screen Time is separate from HealthKit. A real implementation requires the Family Controls entitlement plus Screen Time frameworks such as `FamilyControls`, `DeviceActivity`, and `ManagedSettings`, and normally one or more app extensions. The entitlement is restricted and must be approved for the shipping app. Until that work is approved and real-device tested, Screen Time remains manual.

Official references:

- https://developer.apple.com/documentation/familycontrols
- https://developer.apple.com/documentation/deviceactivity
- https://developer.apple.com/documentation/managedsettings

### Android

Android usage-time data is available through `UsageStatsManager`, but it requires the user to grant special Usage Access in Settings. That integration remains a later native task; Zrizin does not claim it is connected today.

Official reference:

- https://developer.android.com/reference/android/app/usage/UsageStatsManager

## Integrity and privacy rules

- Ask only for device metrics Zrizin can actually use.
- Keep detailed workout samples on-device when a daily aggregate is sufficient for scoring.
- Store the aggregate check-in and its source, not an unnecessary copy of the user's entire health history.
- Manual web scoring remains available where league rules allow it.
- A later background-sync feature must still use the same check-in/scoring pipeline; it may never write scores directly.
- Do not market automatic/background tracking until real-device lifecycle behavior has been verified on both platforms.
