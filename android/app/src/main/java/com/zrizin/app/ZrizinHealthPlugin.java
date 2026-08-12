package com.zrizin.app;

import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.health.connect.HealthConnectException;
import android.health.connect.HealthConnectManager;
import android.health.connect.ReadRecordsRequestUsingFilters;
import android.health.connect.ReadRecordsResponse;
import android.health.connect.TimeInstantRangeFilter;
import android.health.connect.datatypes.ExerciseSessionRecord;
import android.health.connect.datatypes.StepsRecord;
import android.net.Uri;
import android.os.Build;
import android.os.OutcomeReceiver;
import android.os.Process;
import android.provider.Settings;

import androidx.annotation.RequiresApi;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONException;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;

@CapacitorPlugin(
    name = "ZrizinHealth",
    permissions = {
        @Permission(alias = "healthSteps", strings = { "android.permission.health.READ_STEPS" }),
        @Permission(alias = "healthExercise", strings = { "android.permission.health.READ_EXERCISE" })
    }
)
public class ZrizinHealthPlugin extends Plugin {

    @PluginMethod
    public void requestAuthorization(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            requestAllPermissions(call, "healthPermissionsCallback");
            return;
        }

        resolveAuthorization(call);
    }

    @PermissionCallback
    private void healthPermissionsCallback(PluginCall call) {
        resolveAuthorization(call);
    }

    private void resolveAuthorization(PluginCall call) {
        JSArray requested = call.getArray("metrics", new JSArray());
        JSArray granted = new JSArray();
        JSArray denied = new JSArray();

        try {
            for (Object value : requested.toList()) {
                String metric = String.valueOf(value);
                boolean allowed;

                if ("steps".equals(metric)) {
                    allowed = Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
                        && getPermissionState("healthSteps") == PermissionState.GRANTED;
                } else if ("workouts".equals(metric)) {
                    allowed = Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
                        && getPermissionState("healthExercise") == PermissionState.GRANTED;
                } else if ("screen_time_minutes".equals(metric)) {
                    allowed = hasUsageStatsAccess();
                } else {
                    allowed = false;
                }

                if (allowed) granted.put(metric);
                else denied.put(metric);
            }
        } catch (JSONException exception) {
            call.reject("Could not read requested device metrics", exception);
            return;
        }

        JSObject result = new JSObject();
        result.put("granted", granted);
        result.put("denied", denied);
        call.resolve(result);
    }

    @PluginMethod
    public void openScreenTimeSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception appSpecificError) {
            try {
                Intent fallback = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
                getActivity().startActivity(fallback);
                call.resolve();
            } catch (Exception error) {
                call.reject("Could not open Android Usage Access settings", error);
            }
        }
    }

    @PluginMethod
    public void readDailySnapshot(PluginCall call) {
        String dateValue = call.getString("date");
        if (dateValue == null) {
            call.reject("date is required");
            return;
        }

        final LocalDate date;
        try {
            date = LocalDate.parse(dateValue);
        } catch (Exception exception) {
            call.reject("Invalid device snapshot date", exception);
            return;
        }

        new Thread(() -> {
            Long screenTimeMinutes = null;
            if (hasUsageStatsAccess()) {
                screenTimeMinutes = readScreenTimeMinutes(date);
            }

            final Long screenTime = screenTimeMinutes;
            getActivity().runOnUiThread(() -> readHealthSnapshotOrResolve(call, date, screenTime));
        }).start();
    }

    private boolean hasUsageStatsAccess() {
        AppOpsManager appOps = (AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
        if (appOps == null) return false;

        int mode;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            mode = appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                getContext().getPackageName()
            );
        } else {
            mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                getContext().getPackageName()
            );
        }
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    private Long readScreenTimeMinutes(LocalDate date) {
        UsageStatsManager manager = (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
        if (manager == null) return null;

        ZoneId zone = ZoneId.systemDefault();
        long start = date.atStartOfDay(zone).toInstant().toEpochMilli();
        long end = date.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli();
        Map<String, UsageStats> usage = manager.queryAndAggregateUsageStats(start, end);
        if (usage == null || usage.isEmpty()) return 0L;

        long foregroundMillis = 0;
        for (UsageStats stats : usage.values()) {
            foregroundMillis += Math.max(0, stats.getTotalTimeInForeground());
        }
        return Math.max(0, foregroundMillis / 60000L);
    }

    private void readHealthSnapshotOrResolve(PluginCall call, LocalDate date, Long screenTimeMinutes) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            if (screenTimeMinutes == null) {
                call.reject("No native device permissions are granted");
            } else {
                resolveSnapshot(call, date.toString(), null, null, new JSArray(), screenTimeMinutes, false);
            }
            return;
        }

        boolean canReadSteps = ContextCompat.checkSelfPermission(
            getContext(), "android.permission.health.READ_STEPS"
        ) == PackageManager.PERMISSION_GRANTED;
        boolean canReadExercise = ContextCompat.checkSelfPermission(
            getContext(), "android.permission.health.READ_EXERCISE"
        ) == PackageManager.PERMISSION_GRANTED;

        if (!canReadSteps && !canReadExercise) {
            if (screenTimeMinutes == null) {
                call.reject("Health Connect and Usage Access permissions are not granted");
            } else {
                resolveSnapshot(call, date.toString(), null, null, new JSArray(), screenTimeMinutes, false);
            }
            return;
        }

        readAndroid14Snapshot(call, date, screenTimeMinutes, canReadSteps, canReadExercise);
    }

    @RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
    private void readAndroid14Snapshot(
        PluginCall call,
        LocalDate date,
        Long screenTimeMinutes,
        boolean canReadSteps,
        boolean canReadExercise
    ) {
        HealthConnectManager manager = getContext().getSystemService(HealthConnectManager.class);
        if (manager == null) {
            if (screenTimeMinutes != null) {
                resolveSnapshot(call, date.toString(), null, null, new JSArray(), screenTimeMinutes, false);
            } else {
                call.reject("Health Connect is not available on this device");
            }
            return;
        }

        ZoneId zone = ZoneId.systemDefault();
        Instant start = date.atStartOfDay(zone).toInstant();
        Instant end = date.plusDays(1).atStartOfDay(zone).toInstant();
        TimeInstantRangeFilter range = new TimeInstantRangeFilter.Builder()
            .setStartTime(start)
            .setEndTime(end)
            .build();

        if (canReadSteps) {
            ReadRecordsRequestUsingFilters<StepsRecord> stepsRequest =
                new ReadRecordsRequestUsingFilters.Builder<>(StepsRecord.class)
                    .setTimeRangeFilter(range)
                    .setPageSize(5000)
                    .build();

            manager.readRecords(
                stepsRequest,
                getContext().getMainExecutor(),
                new OutcomeReceiver<ReadRecordsResponse<StepsRecord>, HealthConnectException>() {
                    @Override
                    public void onResult(ReadRecordsResponse<StepsRecord> response) {
                        long totalSteps = 0;
                        for (StepsRecord record : response.getRecords()) totalSteps += record.getCount();
                        readWorkoutsAndResolve(
                            call,
                            manager,
                            range,
                            date.toString(),
                            totalSteps,
                            canReadExercise,
                            screenTimeMinutes
                        );
                    }

                    @Override
                    public void onError(HealthConnectException error) {
                        call.reject("Could not read steps from Health Connect", error);
                    }
                }
            );
        } else {
            readWorkoutsAndResolve(
                call,
                manager,
                range,
                date.toString(),
                null,
                canReadExercise,
                screenTimeMinutes
            );
        }
    }

    @RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
    private void readWorkoutsAndResolve(
        PluginCall call,
        HealthConnectManager manager,
        TimeInstantRangeFilter range,
        String date,
        Long steps,
        boolean canReadExercise,
        Long screenTimeMinutes
    ) {
        if (!canReadExercise) {
            resolveSnapshot(call, date, steps, null, new JSArray(), screenTimeMinutes, true);
            return;
        }

        ReadRecordsRequestUsingFilters<ExerciseSessionRecord> exerciseRequest =
            new ReadRecordsRequestUsingFilters.Builder<>(ExerciseSessionRecord.class)
                .setTimeRangeFilter(range)
                .setPageSize(1000)
                .build();

        manager.readRecords(
            exerciseRequest,
            getContext().getMainExecutor(),
            new OutcomeReceiver<ReadRecordsResponse<ExerciseSessionRecord>, HealthConnectException>() {
                @Override
                public void onResult(ReadRecordsResponse<ExerciseSessionRecord> response) {
                    long totalMinutes = 0;
                    JSArray workouts = new JSArray();

                    for (ExerciseSessionRecord record : response.getRecords()) {
                        long minutes = Math.max(0, Duration.between(record.getStartTime(), record.getEndTime()).toMinutes());
                        totalMinutes += minutes;

                        JSObject workout = new JSObject();
                        workout.put("id", record.getStartTime().toString() + "-" + record.getExerciseType());
                        workout.put("activity", "Health Connect exercise " + record.getExerciseType());
                        workout.put("startedAt", record.getStartTime().toString());
                        workout.put("endedAt", record.getEndTime().toString());
                        workout.put("durationMinutes", minutes);
                        workouts.put(workout);
                    }

                    resolveSnapshot(call, date, steps, totalMinutes, workouts, screenTimeMinutes, true);
                }

                @Override
                public void onError(HealthConnectException error) {
                    call.reject("Could not read workouts from Health Connect", error);
                }
            }
        );
    }

    private void resolveSnapshot(
        PluginCall call,
        String date,
        Long steps,
        Long workoutMinutes,
        JSArray workouts,
        Long screenTimeMinutes,
        boolean includesHealthConnect
    ) {
        JSObject result = new JSObject();
        result.put("date", date);
        if (steps != null) result.put("steps", steps);
        if (workoutMinutes != null) result.put("workoutMinutes", workoutMinutes);
        if (screenTimeMinutes != null) result.put("screenTimeMinutes", screenTimeMinutes);
        result.put("workouts", workouts);

        JSArray sources = new JSArray();
        if (includesHealthConnect) sources.put("health_connect");
        if (screenTimeMinutes != null) sources.put("android_usage");
        result.put("sources", sources);
        call.resolve(result);
    }
}
