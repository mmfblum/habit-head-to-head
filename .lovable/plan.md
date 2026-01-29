

# Plan: Enhanced Task Configuration UX

## Overview
This plan addresses 8 specific improvements to make the task selection and configuration experience more intuitive:
1. Add a "Remove All" button to deselect all tasks
2. Remove confusing badges (tiered, 06:30) from task cards
3. Auto-expand configuration panel when a task is selected
4. Improve scoring mode selection with a prominent prompt and explanations
5. Auto-calculate evenly weighted points and add value inputs
6. Display configured values in task names (e.g., "30 minutes of active time")
7. Remove duplicate task templates from the database
8. Add difficulty modes (Easy, Medium, Extreme) to Quick Start that prepopulate values

---

## Implementation Details

### 1. Add "Remove All" Button

**Files:** `TaskSelectionGrid.tsx`, `InitialTaskSetupDialog.tsx`, `CreateLeagueWizard.tsx`

Add a new prop `onClearAll` to TaskSelectionGrid and display a "Clear All" button in the counter section when tasks are selected.

```tsx
// In counter section
{selectedTasks.size > 0 && (
  <Button variant="ghost" size="sm" onClick={onClearAll}>
    <X className="w-4 h-4 mr-1" />
    Clear All
  </Button>
)}
```

---

### 2. Remove Confusing Badges from Task Cards

**File:** `TaskSelectionGrid.tsx`

Remove the badges section that currently shows scoring type and config values (lines 119-144). These will instead be shown in the task display name after configuration.

**Before:**
```tsx
<div className="flex items-center gap-2 mt-2 flex-wrap">
  <Badge variant="outline" className="text-xs">
    {config?.scoring_mode === 'binary' ? 'Yes/No' : scoringTypeLabels[...]}
  </Badge>
  {config?.target_time && <Badge ...>{config.target_time}</Badge>}
  ...
</div>
```

**After:** Remove this entire section.

---

### 3. Auto-Expand Configuration When Task Selected

**File:** `TaskSelectionGrid.tsx`

When a task is selected, automatically expand its configuration panel by setting `expandedTask` to the newly selected task ID.

**Changes:**
- Modify `handleToggleTask` behavior to auto-expand
- Pass a callback to trigger expansion after selection

```tsx
// When task is selected (not deselected), auto-expand it
const handleTaskClick = (taskId: string, template: TaskTemplate) => {
  const wasSelected = selectedTasks.has(taskId);
  onToggleTask(taskId, template);
  
  // Auto-expand if newly selected
  if (!wasSelected) {
    setExpandedTask(taskId);
  } else {
    // If deselecting the currently expanded task, collapse it
    if (expandedTask === taskId) {
      setExpandedTask(null);
    }
  }
};
```

---

### 4. Improve Scoring Mode Selection with Prompt

**Files:** `TaskConfigurationPanel.tsx`, new `ScoringModePrompt.tsx`

Create a prominent scoring mode selection that appears first when a task is expanded, with clear explanations:

```tsx
<div className="p-4 bg-muted/50 rounded-lg border space-y-3">
  <p className="font-medium text-sm">How would you like to score this task?</p>
  
  <div className="grid grid-cols-2 gap-3">
    <button onClick={() => selectMode('binary')} 
      className="p-3 border rounded-lg hover:border-primary">
      <CheckCircle className="w-5 h-5 text-primary mb-2" />
      <p className="font-medium">Simple (Yes/No)</p>
      <p className="text-xs text-muted-foreground">
        Did you complete the task today? Earn points for checking it off.
      </p>
    </button>
    
    <button onClick={() => selectMode('detailed')}
      className="p-3 border rounded-lg hover:border-primary">
      <Gauge className="w-5 h-5 text-secondary mb-2" />
      <p className="font-medium">Detailed (Performance)</p>
      <p className="text-xs text-muted-foreground">
        Track specific values like time, reps, or duration. More points for better performance.
      </p>
    </button>
  </div>
</div>
```

**Simple Mode Must Still Have Value Input:**
Even in simple mode, show an input for the task value that users are committing to (e.g., "30 minutes of exercise").

---

### 5. Auto-Calculate Even Point Weights + Value Inputs

**Files:** `TaskConfigurationPanel.tsx`, `InitialTaskSetupDialog.tsx`, `CreateLeagueWizard.tsx`

**Point Calculation Logic:**
- Base total points per day = 100 (configurable)
- Each task gets `100 / taskCount` points by default
- When tasks are added/removed, recalculate all task points

```tsx
// Calculate even weights
const totalDailyPoints = 100;
const evenPointsPerTask = Math.floor(totalDailyPoints / taskConfigs.size);

// Update all task configs when count changes
useEffect(() => {
  if (taskConfigs.size > 0) {
    setTaskConfigs(prev => {
      const newMap = new Map(prev);
      newMap.forEach((config, taskId) => {
        newMap.set(taskId, {
          ...config,
          binary_points: evenPointsPerTask,
          points: evenPointsPerTask,
        });
      });
      return newMap;
    });
  }
}, [taskConfigs.size]);
```

**Detailed Mode with Tiers:**
For time-based tasks, replace "Max Points" with "Max Tiers":
- Each tier = 30-minute increment
- 1 point per tier by default
- Example: 5 tiers = up to 2.5 hours = 5 points max

```tsx
<ThresholdConfigInput
  label="Max Tiers"
  description="Each tier = 30 min increment. 1 point per tier."
  value={config.max_tiers || 5}
  onChange={(value) => updateConfig({ max_tiers: value })}
  unit="tiers"
  min={1}
  max={20}
/>
```

---

### 6. Display Configured Values in Task Name

**File:** `TaskSelectionGrid.tsx`

Create a helper function to generate a descriptive task name based on configuration:

```tsx
function getConfiguredTaskName(template: TaskTemplate, config: TaskConfigOverrides): string {
  const baseName = template.name;
  
  if (config.scoring_mode === 'binary' && config.target) {
    // E.g., "30 minutes of Active Time"
    return `${config.target} ${template.unit} of ${baseName}`;
  }
  
  if (config.target_time) {
    // E.g., "Wake Time at 6:00 AM"
    return `${baseName} at ${formatTime(config.target_time)}`;
  }
  
  if (config.threshold) {
    // E.g., "Workout (30 min goal)"
    return `${baseName} (${config.threshold} ${template.unit} goal)`;
  }
  
  return baseName;
}
```

Display this in the task card:
```tsx
<p className="font-medium truncate pr-6">
  {isSelected && config ? getConfiguredTaskName(task, config) : task.name}
</p>
```

---

### 7. Remove Duplicate Task Templates

**Database Change:** Run a migration to remove duplicate entries:

Duplicates found:
- Journaling (2)
- Reading (2)
- Wake Time (2)
- Bedtime (2)
- Workout (2)
- Meditation (2)

Keep the one with the most complete configuration and delete duplicates.

```sql
-- Delete duplicate task templates, keeping the one with richer config
DELETE FROM task_templates 
WHERE id IN (
  SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY name ORDER BY 
             CASE WHEN default_config::text != '{}' THEN 0 ELSE 1 END,
             created_at DESC
           ) as rn
    FROM task_templates
  ) t WHERE rn > 1
);
```

---

### 8. Quick Start with Difficulty Modes

**Files:** `InitialTaskSetupDialog.tsx`, `CreateLeagueWizard.tsx`

Replace the current "Use Recommended" button with a 3-option difficulty selector that prepopulates task values:

```tsx
<Card className="border-dashed border-2 border-primary/30 bg-primary/5">
  <CardContent className="py-4">
    <p className="font-medium mb-3">Quick Start - Choose Your Difficulty</p>
    <div className="grid grid-cols-3 gap-3">
      <Button variant="outline" onClick={() => handleQuickStart('easy')}>
        <Zap className="w-4 h-4 mr-2 text-green-500" />
        Easy
      </Button>
      <Button variant="outline" onClick={() => handleQuickStart('medium')}>
        <Flame className="w-4 h-4 mr-2 text-amber-500" />
        Medium
      </Button>
      <Button variant="outline" onClick={() => handleQuickStart('extreme')}>
        <Skull className="w-4 h-4 mr-2 text-red-500" />
        Extreme
      </Button>
    </div>
    <p className="text-xs text-muted-foreground mt-2 text-center">
      Selects 5 tasks with pre-configured values
    </p>
  </CardContent>
</Card>
```

**Difficulty Presets:**
| Setting | Easy | Medium | Extreme |
|---------|------|--------|---------|
| Wake Time | 7:30 AM | 6:30 AM | 5:30 AM |
| Workout | 20 min | 30 min | 45 min |
| Reading | 15 min | 20 min | 30 min |
| Steps | 5,000 | 8,000 | 12,000 |
| Journaling | Yes/No | Yes/No | Yes/No |

---

## Files to Modify

| File | Changes |
|------|---------|
| `TaskSelectionGrid.tsx` | Add onClearAll prop, remove badges, auto-expand, display configured names |
| `TaskConfigurationPanel.tsx` | Add scoring mode prompt, simple mode value input, tier-based scoring |
| `ScoringModeToggle.tsx` | Replace with new prominent prompt design |
| `InitialTaskSetupDialog.tsx` | Add clear all handler, difficulty quick start, auto-weight points |
| `CreateLeagueWizard.tsx` | Add clear all handler, difficulty quick start, auto-weight points |
| Database migration | Remove duplicate task templates |

---

## New Components

### `ScoringModePrompt.tsx`
A more prominent, card-based scoring mode selector with descriptions that appears when a task is first selected.

### `TaskValueInput.tsx`
A reusable input for task values that works in both simple and detailed modes:
- For simple mode: "How much do you commit to?" (e.g., 30 minutes)
- For detailed mode: Contextual based on task type

---

## Data Flow

```text
Task Selected
    │
    ├── Auto-expand config panel
    │
    ├── Show Scoring Mode Prompt
    │       │
    │       ├── Simple Mode: Show value commitment input + points
    │       │
    │       └── Detailed Mode: Show task-specific inputs + tiers
    │
    ├── Auto-recalculate points when task count changes
    │
    └── Update display name with configured values
```

---

## Expected Outcome

1. Users can clear all selections with one click
2. Task cards are clean without confusing technical badges
3. Configuration opens automatically when selecting a task
4. Scoring modes are clearly explained with a prominent choice
5. Points are evenly distributed and update dynamically
6. Task names show configured values for clarity
7. No duplicate tasks in the selection list
8. Quick Start offers Easy/Medium/Extreme presets with pre-filled values

