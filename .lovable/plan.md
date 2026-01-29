
# Plan: Hybrid Dashboard - Mock Data Fallback with Real League Data

## Overview
Update the Dashboard to show real league data when a user has created/joined a league, while falling back to mock data for users who haven't yet created a league. This gives new users a preview of what the app looks like while providing real data for active users.

## Current State
- Dashboard imports all data from `mockData.ts`
- Shows fictional opponent "Alex K." and fake league "Productivity Pros"
- Real data hooks (`useUserPrimaryLeague`, `useTasksWithCheckins`) exist but are unused on Dashboard

## Implementation Strategy

### Conditional Data Loading
```text
Dashboard
    │
    ├── useUserPrimaryLeague()
    │       │
    │       ├── Has League? ──Yes──> Show Real Data
    │       │                         • Real league name/week/season
    │       │                         • Real members as matchup opponent  
    │       │                         • Real tasks from useTasksWithCheckins
    │       │                         • Real stats from member standings
    │       │
    │       └── No League? ──────> Show Mock Data (current behavior)
    │                               • Demo league info
    │                               • Sample matchup with Alex K.
    │                               • Sample tasks
```

---

## Detailed Changes

### Step 1: Update Dashboard.tsx - Add Data Hooks

Import and use real data hooks alongside mock data:

```tsx
import { useUserPrimaryLeague } from '@/hooks/useLeagueDetails';
import { useTasksWithCheckins } from '@/hooks/useTasksWithCheckins';
import { useAuth } from '@/hooks/useAuth';

// Fetch real data
const { data: leagueDetails, isLoading } = useUserPrimaryLeague();
const { user } = useAuth();

// Determine if we should show real or mock data
const hasLeague = !!leagueDetails;
```

### Step 2: Create Data Transformation Layer

Build helper functions to transform real league data into the mock data format (so existing components work):

**League Info:**
```tsx
const displayLeague = hasLeague ? {
  name: leagueDetails.name,
  week: leagueDetails.current_week?.week_number ?? 1,
  season: leagueDetails.current_season?.season_number ?? 1,
} : currentLeague; // mock fallback
```

**User & Opponent:**
```tsx
const currentMember = leagueDetails?.members.find(m => m.user_id === user?.id);
const opponentMember = leagueDetails?.members.find(m => m.user_id !== user?.id);

const displayUser = hasLeague && currentMember ? {
  id: currentMember.user_id,
  username: 'You',
  avatar: currentMember.avatar_url ? '👤' : '🏆',
  weeklyScore: currentMember.weekly_points,
  seasonScore: currentMember.total_points,
  wins: currentMember.wins,
  losses: currentMember.losses,
  streak: currentMember.current_streak,
  rank: currentMember.current_rank ?? 1,
} : currentUser; // mock fallback
```

**Matchup:**
```tsx
const displayMatchup = hasLeague && opponentMember ? {
  id: 'real-matchup',
  week: leagueDetails.current_week?.week_number ?? 1,
  user: displayUser,
  opponent: displayOpponent,
  userScore: currentMember?.weekly_points ?? 0,
  opponentScore: opponentMember?.weekly_points ?? 0,
  status: 'in_progress' as const,
} : currentMatchup; // mock fallback
```

### Step 3: Integrate Real Tasks

Fetch real tasks when a league exists:

```tsx
const seasonId = leagueDetails?.current_season?.id;
const { data: realTasks = [] } = useTasksWithCheckins(seasonId, new Date());

// Transform real tasks to mock format for TaskCard compatibility
const transformedTasks = realTasks.map(task => ({
  id: task.id,
  name: task.task_name,
  icon: TASK_ICONS[task.template?.icon ?? 'activity'] ?? '📊',
  description: task.template?.description ?? '',
  type: 'custom' as const,
  target: (task.config as any)?.target ?? 1,
  unit: task.template?.unit ?? '',
  pointsPerUnit: 1,
  maxPoints: (task.config as any)?.max_points ?? 100,
  currentValue: task.todayCheckin?.numeric_value ?? 
                (task.todayCheckin?.boolean_value ? 1 : 0) ?? 0,
  completed: !!task.todayCheckin?.boolean_value || 
             (task.todayCheckin?.numeric_value ?? 0) >= ((task.config as any)?.target ?? 1),
  streakDays: 0, // Would need separate query for streak data
}));

const displayTasks = hasLeague && transformedTasks.length > 0 
  ? transformedTasks 
  : tasks; // mock fallback
```

### Step 4: Update QuickStats Component

Modify `QuickStats` to accept optional real stats:

```tsx
// In StatsGrid.tsx
interface QuickStatsProps {
  rank?: number;
  totalMembers?: number;
  weeklyScore?: number;
  streak?: number;
  seasonPoints?: number;
  weekNumber?: number;
  weeksCount?: number;
}

export function QuickStats(props?: QuickStatsProps) {
  const stats: Stat[] = [
    { 
      icon: Trophy, 
      label: 'Season Rank', 
      value: props?.rank ? `#${props.rank}` : '#2', 
      subtext: `of ${props?.totalMembers ?? 6} players`, 
      color: 'primary' 
    },
    // ... similar for other stats
  ];
  return <StatsGrid stats={stats} />;
}
```

### Step 5: Handle Loading & Edge Cases

Add loading skeleton and handle single-member leagues:

```tsx
if (isLoading) {
  return <DashboardSkeleton />;
}

// If only one member, show invite prompt instead of matchup
const showMatchup = !hasLeague || (leagueDetails.members.length > 1);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Dashboard.tsx` | Add hooks, conditional data loading, transformations |
| `src/components/StatsGrid.tsx` | Update `QuickStats` to accept optional props |

---

## Technical Details

### Data Flow
1. Dashboard loads and calls `useUserPrimaryLeague()`
2. If user has a league membership, fetch real league details
3. Transform real data to match mock data interfaces
4. Pass to existing components (MatchupCard, TaskCard, QuickStats)
5. If no league exists, use mock data as fallback

### Type Safety
All transformations will maintain the existing mock data types (`User`, `Matchup`, `Task`, `League`) so no changes needed to `MatchupCard` or `TaskCard` components.

### Edge Cases Handled
- **No league**: Shows mock/demo data
- **League but no season**: Shows league name, prompts to start season
- **Single member**: Shows "Invite opponents" instead of matchup
- **No tasks configured**: Falls back to mock tasks
- **Loading state**: Shows skeleton UI

---

## Expected Outcome
- New users see a polished demo dashboard with mock data
- Once a league is created, the dashboard switches to real data
- Real league name, actual opponent (or invite prompt), real task progress
- Stats reflect actual season rankings and weekly scores
