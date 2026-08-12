package com.zrizin.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.health.connect.HealthConnectException;
import android.health.connect.HealthConnectManager;
import android.health.connect.ReadRecordsRequestUsingFilters;
import android.health.connect.ReadRecordsResponse;
import android.health.connect.TimeInstantRangeFilter;
import android.health.connect.datatypes.ExerciseSessionRecord;
import android.health.connect.datatypes.StepsRecord;
import android.os.Build;
import android.os.OutcomeReceiver;

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
import java.util.ArrayList;
import java.util.List;

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
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            resolveAuthorization(call, false);
            return;
        }

        requestAllPermissions(call, "healthPermissionsCallback");
    }

    @PermissionCallback
    private void healthPermissionsCallback(PluginCall call) {
        resolveAuthorization(call, true);
    }

    private void resolveAuthorization(PluginCall call, boolean supported) {
        JSArray requested = call.getArray("metrics", new JSArray());
        JSArray granted = new JSArray();
        JSArray denied = new JSArray();

        try {
            for (Object value : requested.toList()) {
                String metric = String.valueOf(value);
                boolean allowed = supported && (
                    ("steps".equals(metric) && getPermissionState("healthSteps") == PermissionState.GRANTED) ||
                    ("workouts".equals(metric) && getPermissionState("healthExercise") == PermissionState.GRANTED)
                );

                if (allowed) granted.put(metric);
                else denied.put(metric);
            }
        } catch (JSONException exception) {
            call.reject("Could not read requested health metrics", exception);
            return;
        }

        JSObject result = new JSObject();
        result.put("granted", granted);
        result.put("denied", denied);
        call.resolve(result);
    }

    @PluginMethod
    public void readDailySnapshot(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            call.reject("Health Connect system APIs require Android 14 or newer");
            return;
        }

        String dateValue = call.getString("date");
        if (dateValue == null) {
            call.reject("date is required");
            return;
        }

        try {
            readAndroid14Snapshot(call, LocalDate.parse(dateValue));
        } catch (Exception exception) {
            call.reject("Invalid health snapshot date", exception);
        }
    }

    @RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
    private void readAndroid14Snapshot(PluginCall call, LocalDate date) {
        boolean canReadSteps = ContextCompat.checkSelfPermission(
            getContext(), "android.permission.health.READ_STEPS"
        ) == PackageManager.PERMISSION_GRANTED;
        boolean canReadExercise = ContextCompat.checkSelfPermission(
            getContext(), "android.permission.health.READ_EXERCISE"
        ) == PackageManager.PERMISSION_GRANTED;

        if (!canReadSteps && !canReadExercise) {
            call.reject("Health Connect permissions are not granted");
            return;
        }

        HealthConnectManager manager = getContext().getSystemService(HealthConnectManager.class);
        if (manager == null) {
            call.reject("Health Connect is not available on this device");
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
                        readWorkoutsAndResolve(call, manager, range, dateValue(date), totalSteps, canReadExercise);
                    }

                    @Override
                    public void onError(HealthConnectException error) {
                        call.reject("Could not read steps from Health Connect", error);
                    }
                }
            );
        } else {
            readWorkoutsAndResolve(call, manager, range, dateValue(date), null, canReadExercise);
        }
    }

    @RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
    private void readWorkoutsAndResolve(
        PluginCall call,
        HealthConnectManager manager,
        TimeInstantRangeFilter range,
        String date,
        Long steps,
        boolean canReadExercise
    ) {
        if (!canReadExercise) {
            resolveSnapshot(call, date, steps, null, new JSArray());
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

                    resolveSnapshot(call, date, steps, totalMinutes, workouts);
                }

                @Override
                public void onError(HealthConnectException error) {
                    call.reject("Could not read workouts from Health Connect", error);
                }
            }
        );
    }

    private String dateValue(LocalDate date) {
        return date.toString();
    }

    private void resolveSnapshot(PluginCall call, String date, Long steps, Long workoutMinutes, JSArray workouts) {
        JSObject result = new JSObject();
        result.put("date", date);
        if (steps != null) result.put("steps", steps);
        if (workoutMinutes != null) result.put("workoutMinutes", workoutMinutes);
        result.put("workouts", workouts);
        result.put("sources", new JSArray().put("health_connect"));
        call.resolve(result);
    }
}
