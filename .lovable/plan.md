

# Plan: Fixed Points Per Task + Build Error Fixes

## Overview
Two sets of changes:
1. Simplify the points system -- every task is worth exactly **10 points**, no user-configurable points anywhere
2. Fix all existing build errors (missing database tables, broken property access, hooks violations)

---

## Part 1: Fixed 10-Point System

### What changes
- Remove all points-related inputs from the configuration panel
- Set `TOTAL_DAILY_POINTS` to be dynamic based on task count (10 per task)
- Remove the `PointsConfigInput` from simple mode in `TaskConfigurationPanel.tsx`
- Remove `PointsConfigInput` from threshold detailed mode in `TaskConfigurationPanel.tsx`
- Remove the auto-weight `useEffect` in both `InitialTaskSetupDialog.tsx` and `CreateLeagueWizard.tsx` (no longer needed -- every task is always 10)
- Update `getInitialConfig` to always set `points: 10` and `binary_points: 10`
- Update difficulty presets in `DifficultyQuickStart.tsx` to use `binary_points: 10` instead of 20
- Update `TaskSummaryPreview.tsx` to always show "10 pts" per task and calculate total as `configs.size * 10`
- Update the selection counter text to show total points (`taskConfigs.size * 10 pts total`) instead of per-task calculation
- Update `ScoringPreview.tsx` to use 10 as the default points in example generation

### Files to modify
| File | Change |
|------|--------|
| `TaskConfigurationPanel.tsx` | Remove `PointsConfigInput` from `renderSimpleModeConfig` and from threshold in `renderDetailedConfig`. Set defaults to 10. |
| `InitialTaskSetupDialog.tsx` | Remove `TOTAL_DAILY_POINTS` constant and auto-weight `useEffect`. Set fixed 10 pts in config. Update counter text. Update `TaskSummaryPreview` totalPoints to `taskConfigs.size * 10`. |
| `CreateLeagueWizard.tsx` | Same changes as InitialTaskSetupDialog. |
| `DifficultyQuickStart.tsx` | Change all `binary_points: 20` to `binary_points: 10`. |
| `TaskSummaryPreview.tsx` | Simplify to always show "10 pts" per task. |
| `ScoringPreview.tsx` | Update default points values to 10 in example generation. |
| `getInitialConfig` in `TaskConfigurationPanel.tsx` | Default `points: 10`, `binary_points: 10`. |

---

## Part 2: Fix Build Errors

### 2a. Create missing database tables (migration)

**`user_notifications`** table:
- id, user_id, league_id, type, title, body, notify_date, read_at, created_at
- Unique constraint on (user_id, type, notify_date)
- RLS: users can read/insert/update their own notifications

**`league_events`** table:
- id, league_id, event_type, title, body, actor_user_id, created_at
- RLS: league members can read; authenticated users can insert

### 2b. Fix `Matchup.tsx`

Three issues:
1. `leagueDetails?.league?.id` changed to `leagueDetails?.id` (3 occurrences)
2. `opponentMember` changed to `opponent` (3 occurrences)
3. `useDailyMatchupNotifications` is called inside conditional blocks (lines 73, 87, 102). Move to a single call at the top of the component, before any conditional returns.

### 2c. Fix `Feed.tsx`

- `league?.league.id` changed to `league?.id` (line 8)

---

## Technical Summary

### Config changes at a glance

```text
Before: Points configurable per task, auto-weighted to split 100 points
After:  Every task = 10 points, no configuration needed
```

### Files modified (total)

| File | Changes |
|------|--------|
| `TaskConfigurationPanel.tsx` | Remove points inputs, set defaults to 10 |
| `InitialTaskSetupDialog.tsx` | Remove auto-weight logic, fixed 10 pts |
| `CreateLeagueWizard.tsx` | Remove auto-weight logic, fixed 10 pts |
| `DifficultyQuickStart.tsx` | binary_points: 20 to 10 |
| `TaskSummaryPreview.tsx` | Always show 10 pts |
| `ScoringPreview.tsx` | Default points to 10 |
| `Matchup.tsx` | Fix property access, variable name, hook placement |
| `Feed.tsx` | Fix property access |
| New migration | Create user_notifications and league_events tables |

