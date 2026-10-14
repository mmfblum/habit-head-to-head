# Zrizin native health and device integrations

Zrizin now has real native Steps and Workout readers in the committed Capacitor iOS/Android projects, plus Android Screen Time import through system Usage Access. The web/PWA intentionally remains manual because browsers cannot read these protected device stores.

## What is implemented

The React scoring surface uses `src/lib/nativeHealthBridge.ts` to call the native Capacitor plugin named `ZrizinHealth`.

On today's Tasks screen, **Connect & sync / Refresh device data**:

1. requests only the device metrics represented on the current scorecard;
2. reads a device-local daily aggregate;
3. maps device Steps, Workout minutes, and supported Screen Time into the matching Zrizin tasks;
4. upserts only changed values through the existing authenticated `daily_checkins` mutation;
5. attaches `apple_health`, `health_connect`, or `android_usage` source metadata; and
6. lets the normal database trigger create `scoring_events`, weekly totals, matchup/leaderboard state, and celebrations.

After an explicit successful connection, opening Today's Scorecard may refresh connected metrics quietly. Unchanged aggregates are not rewritten, which avoids artificial scoring/feed churn.

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

### Remaining Android Health Connect release setup

The current Health Connect reader deliberately targets Android 14+ first. Older Android versions can still use Android Screen Time below, but Steps/Workout remain manual until the Jetpack Health Connect compatibility path is added and device-tested.

Before Play Store release, replace the temporary health-permission destination with Zrizin's final privacy-policy/health-permissions screen and complete the Play Console Health Apps declaration.

Official references:

- https://developer.android.com/health-and-fitness/guides/health-connect
- https://developer.android.com/health-and-fitness/guides/health-connect/develop/read-data
- https://developer.android.com/health-and-fitness/guides/health-connect/develop/get-started

## Screen Time

### Android — implemented

Zrizin now uses Android `UsageStatsManager` to calculate the selected day's aggregate app foreground minutes when the scorecard contains a **Screen Time** task.

The manifest declares `android.permission.PACKAGE_USAGE_STATS`. This is a special app-op rather than an ordinary runtime permission, so the user must explicitly enable Zrizin under Android **Usage Access** settings. If access is missing during an explicit sync, Zrizin opens the appropriate system Settings screen and asks the user to return and refresh.

The imported value is stored as a normal Screen Time numeric check-in with source `android_usage`. The task catalog allows `manual` and `android_usage` for Screen Time.

This aggregate is based on Android-reported application foreground time; it should not be marketed as bit-for-bit identical to every OEM's Digital Wellbeing calculation until real-device comparisons are complete.

Official references:

- https://developer.android.com/reference/android/app/usage/UsageStatsManager
- https://developer.android.com/reference/android/provider/Settings#ACTION_USAGE_ACCESS_SETTINGS

### iOS — entitlement-bound

Apple Screen Time is separate from HealthKit. A real implementation requires the Family Controls entitlement plus Screen Time frameworks such as `FamilyControls`, `DeviceActivity`, and `ManagedSettings`, and normally one or more app extensions. The entitlement is restricted and must be approved for the shipping app. Until that approval and real-device work exist, iOS Screen Time remains manual.

Official references:

- https://developer.apple.com/documentation/familycontrols
- https://developer.apple.com/documentation/deviceactivity
- https://developer.apple.com/documentation/managedsettings

## Integrity and privacy rules

- Ask only for device metrics Zrizin can actually use.
- Keep detailed workout samples on-device when a daily aggregate is sufficient for scoring.
- Store the aggregate check-in and its source, not an unnecessary copy of the user's entire health or app-usage history.
- Manual web scoring remains available where league rules allow it.
- Automatic refresh still uses the same check-in/scoring pipeline; native code never writes points, standings, or matchup scores directly.
- Do not market automatic/background tracking as fully validated until real-device lifecycle behavior has been verified on both platforms.
