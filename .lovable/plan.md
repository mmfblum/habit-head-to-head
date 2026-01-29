
# Plan: Improve Task Configuration Experience in League Creation

## Overview
The current league creation wizard has a task configuration step (Step 2), but users are not completing it successfully. We need to make the task selection more intuitive and add a fallback path for leagues that were created without configured tasks.

## Problem Analysis
- Users complete Step 1 (league details) but don't finish Step 2 (tasks)
- Database shows multiple leagues with `task_count: 0` and `status: draft`
- The current UI requires selecting 3+ tasks before proceeding, but this may not be clear

## Implementation Strategy

### Step 1: Enhance Task Selection UI in CreateLeagueWizard
Make it clearer that users must select tasks:

**Changes to `CreateLeagueWizard.tsx`:**
- Add a prominent selection counter showing "0 of 3 minimum selected"
- Show visual feedback when tasks are selected (animation, color change)
- Add quick-select presets: "Recommended Tasks" button that auto-selects 5 popular tasks
- Add a progress indicator within the task section

### Step 2: Add Quick-Select Preset Feature
Add a one-click option to select recommended tasks:

**New component behavior:**
```
┌─────────────────────────────────────────┐
│ Quick Start: Select 5 recommended tasks │
│           [ Use Recommended ]           │
│                  or                     │
│        Choose individual tasks:         │
└─────────────────────────────────────────┘
```

This helps users who feel overwhelmed by choices.

### Step 3: Add "Configure Tasks" Prompt on League Page
For leagues with draft seasons and no tasks, show a setup prompt:

**Changes to `League.tsx`:**
- When season status is `draft` AND `task_count === 0`, show a "Complete Setup" card
- Include a button that opens the ManageTasksDialog or a simplified task picker
- Add a "Start Season" button once tasks are configured

### Step 4: Create Simplified Initial Task Setup Dialog
A focused dialog for first-time task configuration:

**New component: `InitialTaskSetupDialog.tsx`:**
- Simpler than ManageTasksDialog - focused on first selection
- Shows categories with checkboxes
- Has "Recommended" preset button
- After selecting 3+ tasks, enables "Start Season" action
- Combines task config + season activation in one flow

### Step 5: Update Season Activation Flow
Ensure season can be started from the League page:

**Changes:**
- Add `useStartSeason` call after task configuration in InitialTaskSetupDialog
- Show clear feedback when season is activated
- Refresh league data to show active state

---

## Detailed Changes

### File: `src/components/league/CreateLeagueWizard.tsx`

**Add quick-select button:**
```tsx
const RECOMMENDED_TASK_NAMES = [
  'Steps',
  'Workout',
  'Reading',
  'Journaling',
  'Wake Time',
];

const handleQuickSelect = () => {
  if (!groupedTemplates) return;
  const allTemplates = Object.values(groupedTemplates).flat();
  const recommended = allTemplates.filter(t => 
    RECOMMENDED_TASK_NAMES.some(name => t.name.includes(name))
  );
  
  const newConfigs = new Map(taskConfigs);
  recommended.forEach(template => {
    if (!newConfigs.has(template.id)) {
      newConfigs.set(template.id, getInitialConfig(template));
    }
  });
  setTaskConfigs(newConfigs);
};
```

**Add visual counter:**
```tsx
<div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-primary/10">
  <span className="font-medium">Selected: {taskConfigs.size}</span>
  <span className="text-sm text-muted-foreground">
    {taskConfigs.size < 3 
      ? `Need ${3 - taskConfigs.size} more` 
      : '✓ Ready to continue'}
  </span>
</div>
```

### File: `src/pages/League.tsx`

**Add setup prompt for unconfigured leagues:**
```tsx
// After the "no season" check, add check for draft season with no tasks
{currentSeason?.status === 'draft' && (
  <SetupPromptCard 
    onConfigureTasks={() => setShowInitialSetup(true)}
    seasonId={currentSeason.id}
  />
)}
```

### New File: `src/components/league/InitialTaskSetupDialog.tsx`

A simplified dialog for first-time setup:
- Shows task templates in a grid with checkboxes
- "Select Recommended" button for quick setup
- "Configure & Start Season" button at bottom
- Handles both task configuration AND season activation

### File: `src/components/league/TaskSelectionGrid.tsx`

**Improve visual feedback:**
- Add pulse animation to unselected tasks when count < 3
- Show clearer selected state with checkmark badge

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/league/CreateLeagueWizard.tsx` | Modify | Add quick-select button, selection counter |
| `src/pages/League.tsx` | Modify | Add setup prompt for unconfigured leagues |
| `src/components/league/InitialTaskSetupDialog.tsx` | Create | New simplified task setup dialog |
| `src/components/league/TaskSelectionGrid.tsx` | Modify | Improve visual feedback |

---

## Technical Considerations

### Data Flow for Initial Setup
```
League Page (draft season, no tasks)
    │
    ├── Show "Complete Setup" prompt
    │
    └── Open InitialTaskSetupDialog
            │
            ├── User selects 3+ tasks
            │
            ├── Call useConfigureSeasonTasks()
            │
            ├── Call useStartSeason()
            │
            └── Close dialog, refresh league data
```

### Edge Cases
- **User has existing draft season**: Show setup prompt
- **User refreshes during setup**: Season stays draft, can retry
- **Quick-select finds fewer tasks**: Fall back to manual selection

---

## Expected Outcome
1. New league creation flow is clearer with "Select Recommended" option
2. Users who skip task configuration see a prominent "Complete Setup" card
3. One-click recommended task selection reduces decision fatigue
4. Season activation happens automatically after task configuration
5. No leagues left in limbo with draft status and no tasks
