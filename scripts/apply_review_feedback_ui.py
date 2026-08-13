from pathlib import Path

ROOT = Path('.')

def read(path: str) -> str:
    return (ROOT / path).read_text()

def write(path: str, text: str) -> None:
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)

def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise RuntimeError(f'Needle not found in {path}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))

# ---------------------------------------------------------------------------
# Multi-league selection + automatic selection after create/join.
# ---------------------------------------------------------------------------
replace_once(
    'src/hooks/useLeagues.ts',
    "    onSuccess: async () => {\n      await queryClient.invalidateQueries({ queryKey: ['user-leagues'], exact: false });\n      await queryClient.refetchQueries({ queryKey: ['user-leagues'] });\n    },\n  });\n}\n\nexport function useCreateSeason()",
    "    onSuccess: async (league) => {\n      if (user?.id) {\n        localStorage.setItem(`zrizin:selected-league:${user.id}`, league.id);\n        queryClient.setQueryData(['selected-league', user.id], league.id);\n      }\n      await queryClient.invalidateQueries({ queryKey: ['user-leagues'], exact: false });\n      await queryClient.refetchQueries({ queryKey: ['user-leagues'] });\n    },\n  });\n}\n\nexport function useCreateSeason()"
)
replace_once(
    'src/hooks/useLeagues.ts',
    "      const configsToInsert = taskConfigs.map((config) => ({\n",
    "      // Scorecard configuration is replaceable while the season is being set up.\n      // This lets league creation install Classic Zrizin automatically and still\n      // lets a commissioner customize it before kickoff without duplicate rows.\n      const { error: clearError } = await supabase\n        .from('league_task_configs')\n        .delete()\n        .eq('season_id', seasonId);\n      if (clearError) throw clearError;\n\n      const configsToInsert = taskConfigs.map((config) => ({\n"
)
replace_once(
    'src/hooks/useLeagues.ts',
    "    onSuccess: async () => {\n      await queryClient.invalidateQueries({ queryKey: ['user-leagues'], exact: false });\n      await queryClient.invalidateQueries({ queryKey: ['user-league-memberships'] });\n      await queryClient.invalidateQueries({ queryKey: ['league-details'] });\n      await queryClient.refetchQueries({ queryKey: ['user-leagues'] });\n    },\n  });\n}\n",
    "    onSuccess: async (league) => {\n      if (user?.id) {\n        localStorage.setItem(`zrizin:selected-league:${user.id}`, league.id);\n        queryClient.setQueryData(['selected-league', user.id], league.id);\n      }\n      await queryClient.invalidateQueries({ queryKey: ['user-leagues'], exact: false });\n      await queryClient.invalidateQueries({ queryKey: ['user-league-memberships'] });\n      await queryClient.invalidateQueries({ queryKey: ['league-details'] });\n      await queryClient.refetchQueries({ queryKey: ['user-leagues'] });\n    },\n  });\n}\n"
)

path = 'src/hooks/useLeagueDetails.ts'
text = read(path)
text = text.replace("import { useQuery } from '@tanstack/react-query';", "import { useQuery, useQueryClient } from '@tanstack/react-query';")
marker = 'export function useUserPrimaryLeague() {'
idx = text.index(marker)
new_tail = r'''export interface UserLeagueMembership {
  league_id: string;
  leagues: {
    id: string;
    name: string;
    game_format?: LeagueGameFormat | null;
  } | null;
}

export function useUserPrimaryLeague() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const selectionKey = ['selected-league', user?.id] as const;

  const { data: selectedPreference } = useQuery({
    queryKey: selectionKey,
    queryFn: async () => {
      if (!user) return undefined;
      return localStorage.getItem(`zrizin:selected-league:${user.id}`) || undefined;
    },
    enabled: !!user,
    staleTime: Infinity,
  });

  const { data: memberships = [], isLoading: membershipsLoading } = useQuery({
    queryKey: ['user-league-memberships', user?.id],
    queryFn: async (): Promise<UserLeagueMembership[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('league_members')
        .select('league_id,joined_at,leagues(id,name,game_format)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as UserLeagueMembership[];
    },
    enabled: !!user,
  });

  const preferredIsValid = !!selectedPreference
    && memberships.some((membership) => membership.league_id === selectedPreference);
  const selectedLeagueId = preferredIsValid
    ? selectedPreference
    : memberships[0]?.league_id;

  const leagueDetails = useLeagueDetails(selectedLeagueId);

  const selectLeague = (leagueId: string) => {
    if (!user?.id || !memberships.some((membership) => membership.league_id === leagueId)) return;
    localStorage.setItem(`zrizin:selected-league:${user.id}`, leagueId);
    queryClient.setQueryData(selectionKey, leagueId);
    queryClient.invalidateQueries({ queryKey: ['league-details'] });
    queryClient.invalidateQueries({ queryKey: ['current-matchup'] });
    queryClient.invalidateQueries({ queryKey: ['tasks-with-checkins'] });
  };

  return {
    ...leagueDetails,
    isLoading: membershipsLoading || leagueDetails.isLoading,
    leagueId: selectedLeagueId,
    memberships,
    selectLeague,
  };
}
'''
write(path, text[:idx] + new_tail)

# ---------------------------------------------------------------------------
# League creation: Classic Zrizin is installed automatically. Customization is
# optional, not a required wizard step.
# ---------------------------------------------------------------------------
path = 'src/components/league/CreateLeagueWizard.tsx'
text = read(path)
start = text.index('  const handleDetailsSubmit = async () => {')
end = text.index('  const handleToggleTask', start)
new_handler = r'''  const handleDetailsSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a league name');
      return;
    }
    if (tasksLoading) {
      toast.info('Loading the Zrizin scorecard…');
      return;
    }

    const classic = buildStarterPack('classic');
    if (classic.size < 3) {
      toast.error('The default scorecard is not available yet.');
      return;
    }

    try {
      const league = await createLeague.mutateAsync({
        name: formData.name,
        description: formData.description,
        gameFormat: formData.gameFormat,
      });

      const season = await createSeason.mutateAsync({
        leagueId: league.id,
        name: 'Season 1',
        weeksCount: formData.weeksCount,
        startDate: new Date(),
      });

      const taskConfigArray = Array.from(classic.entries()).map(([taskId, config], index) => ({
        task_template_id: taskId,
        display_order: index,
        config_overrides: serializeConfig(config),
      }));
      await configureTasks.mutateAsync({ seasonId: season.id, taskConfigs: taskConfigArray });

      setCreatedLeague(league);
      setCreatedSeason(season);
      setTaskConfigs(classic);
      setDefaultPackLoaded(true);

      if (formData.gameFormat === 'solo') {
        await startSeason.mutateAsync({ seasonId: season.id, gameFormat: 'solo' });
        toast.success('Solo is live with the Classic Zrizin scorecard.');
        onClose();
        navigate('/tasks');
        return;
      }

      setStep('invite');
      toast.success('League created. Classic Zrizin is already set up.');
    } catch (error) {
      console.error(error);
      toast.error('Failed to create league');
    }
  };

'''
text = text[:start] + new_handler + text[end:]
old_steps = r'''  const steps = isSolo
    ? [
        { id: 'details', label: 'Solo', icon: UserRound },
        { id: 'tasks', label: 'Goals', icon: Gamepad2 },
      ]
    : [
        { id: 'details', label: 'League', icon: Trophy },
        { id: 'tasks', label: 'Game', icon: Gamepad2 },
        { id: 'invite', label: 'Friends', icon: Users },
      ];'''
new_steps = r'''  const steps = isSolo
    ? step === 'tasks'
      ? [
          { id: 'details', label: 'Solo', icon: UserRound },
          { id: 'tasks', label: 'Goals', icon: Gamepad2 },
        ]
      : [{ id: 'details', label: 'Solo', icon: UserRound }]
    : step === 'tasks'
      ? [
          { id: 'details', label: 'League', icon: Trophy },
          { id: 'tasks', label: 'Game', icon: Gamepad2 },
          { id: 'invite', label: 'Friends', icon: Users },
        ]
      : [
          { id: 'details', label: 'League', icon: Trophy },
          { id: 'invite', label: 'Friends', icon: Users },
        ];'''
if old_steps not in text:
    raise RuntimeError('CreateLeagueWizard steps block missing')
text = text.replace(old_steps, new_steps, 1)
text = text.replace(
    "                <Button onClick={handleDetailsSubmit} className=\"w-full\" size=\"lg\" disabled={createLeague.isPending || createSeason.isPending}>\n                  {createLeague.isPending || createSeason.isPending ? 'Creating...' : 'Build the Daily Game'}",
    "                <Button onClick={handleDetailsSubmit} className=\"w-full\" size=\"lg\" disabled={createLeague.isPending || createSeason.isPending || configureTasks.isPending || startSeason.isPending || tasksLoading}>\n                  {createLeague.isPending || createSeason.isPending || configureTasks.isPending || startSeason.isPending ? 'Creating...' : 'Create League'}",
    1,
)
needle = r'''                <Button onClick={finishSetup} className="w-full" size="lg">
                  Go to League
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>'''
replacement = r'''                <div className="grid grid-cols-1 gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep('tasks')}>
                    <Settings2 className="w-4 h-4 mr-2" />
                    Customize Scorecard
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">Optional — Classic Zrizin is already installed and ready.</p>
                </div>

                <Button onClick={finishSetup} className="w-full" size="lg">
                  Go to League
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>'''
if needle not in text:
    raise RuntimeError('CreateLeagueWizard invite button block missing')
text = text.replace(needle, replacement, 1)
text = text.replace(
    "import { Check, ChevronLeft, ChevronRight, Copy, Gamepad2, ListOrdered, Share2, Swords, Trophy, UserRound, Users, Zap } from 'lucide-react';",
    "import { Check, ChevronLeft, ChevronRight, Copy, Gamepad2, ListOrdered, Settings2, Share2, Swords, Trophy, UserRound, Users, Zap } from 'lucide-react';",
    1,
)
write(path, text)

# ---------------------------------------------------------------------------
# Cleaner task filtering; unresolved optional tasks stay pending instead of
# being treated as failures in the progress percentage.
# ---------------------------------------------------------------------------
path = 'src/pages/Tasks.tsx'
text = read(path)
text = text.replace(
    "import { ChevronLeft, ChevronRight, Calendar, Eye, Flag, Zap } from 'lucide-react';",
    "import { ChevronLeft, ChevronRight, Calendar, Eye, Flag, ListFilter, Zap } from 'lucide-react';",
    1,
)
old_metrics = r'''  const { data: tasks = [], isLoading: tasksLoading } = useTasksWithCheckins(activeSeasonId, selectedDate);
  const completedCount = tasks.filter(isTaskGoalMet).length;
  const scoringChancesLeft = Math.max(tasks.length - completedCount, 0);
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;
  const finishableCount = countFinishableTasks(tasks);

  const goToPreviousDay = () => setSelectedDate((previous) => {
'''
new_metrics = r'''  const { data: tasks = [], isLoading: tasksLoading } = useTasksWithCheckins(activeSeasonId, selectedDate);
  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  // A skipped optional task stays pending rather than becoming a synthetic
  // failure. On prior days, unlogged clock/timestamp tasks are the exception:
  // they represent an actual missed wake/bedtime input and count as unresolved.
  const countedForProgress = tasks.filter((task) => !!task.todayCheckin || (!isToday && task.input_type === 'time'));
  const completedCount = countedForProgress.filter(isTaskGoalMet).length;
  const loggedCount = countedForProgress.length;
  const scoringChancesLeft = tasks.filter((task) => !task.todayCheckin).length;
  const progress = loggedCount > 0 ? (completedCount / loggedCount) * 100 : 0;
  const finishableCount = countFinishableTasks(tasks);

  const goToPreviousDay = () => setSelectedDate((previous) => {
'''
if old_metrics not in text:
    raise RuntimeError('Tasks metrics block missing')
text = text.replace(old_metrics, new_metrics, 1)
text = text.replace("\n  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');\n  const categories = ['All', 'Fitness', 'Sleep', 'Learning', 'Mindfulness', 'Productivity', 'Wellness', 'Nutrition', 'Social', 'Custom'];\n", "\n  const categories = ['All', ...Array.from(new Set(tasks.map((task) => task.template?.category).filter(Boolean))).map((category) => String(category).replace(/^./, (letter) => letter.toUpperCase()))];\n", 1)
text = text.replace("<span className=\"text-sm font-semibold\">{completedCount}/{tasks.length} goals hit</span>", "<span className=\"text-sm font-semibold\">{completedCount} hit · {loggedCount} counted</span>", 1)
old_filter = r'''            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-4 px-4">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category === 'All' ? null : category)}
                  className={cn(
                    'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                    (category === 'All' && !activeCategory) || activeCategory === category
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {category}
                </button>
              ))}
            </div>'''
new_filter = r'''            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Today’s tasks</p>
                <p className="text-xs text-muted-foreground">{filteredTasks.length} shown{activeCategory ? ` · ${activeCategory}` : ''}</p>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 rounded-full">
                    <ListFilter className="w-4 h-4" />
                    {activeCategory || 'All tasks'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="end">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Filter tasks</p>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.map((category) => {
                      const selected = (category === 'All' && !activeCategory) || activeCategory === category;
                      return (
                        <button
                          key={category}
                          type="button"
                          onClick={() => setActiveCategory(category === 'All' ? null : category)}
                          className={cn(
                            'rounded-xl px-3 py-2 text-sm text-left transition-colors border',
                            selected
                              ? 'bg-primary/15 border-primary/30 text-primary font-semibold'
                              : 'bg-background border-border hover:bg-muted'
                          )}
                        >
                          {category}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>'''
if old_filter not in text:
    raise RuntimeError('Tasks horizontal filter block missing')
text = text.replace(old_filter, new_filter, 1)
text = text.replace(
    "            tasks={filteredTasks}\n            isLoading={tasksLoading || leagueLoading}",
    "            tasks={filteredTasks}\n            date={selectedDate}\n            isLoading={tasksLoading || leagueLoading}",
    1,
)
write(path, text)

# ---------------------------------------------------------------------------
# Clock picker shared by setup + any manual time input.
# ---------------------------------------------------------------------------
write('src/components/ui/clock-time-picker.tsx', r'''import { useMemo, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ClockTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

function parseTime(value: string) {
  const [rawHour = '7', rawMinute = '0'] = value.split(':');
  const hour24 = Math.min(23, Math.max(0, Number(rawHour) || 0));
  const minute = Math.min(59, Math.max(0, Number(rawMinute) || 0));
  return {
    hour: hour24 % 12 || 12,
    minute,
    period: hour24 >= 12 ? 'PM' : 'AM' as 'AM' | 'PM',
  };
}

function to24Hour(hour: number, minute: number, period: 'AM' | 'PM') {
  const hour24 = period === 'PM' ? (hour % 12) + 12 : hour % 12;
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatTime(value: string) {
  if (!value) return '';
  const parsed = parseTime(value);
  return `${parsed.hour}:${String(parsed.minute).padStart(2, '0')} ${parsed.period}`;
}

export function ClockTimePicker({ value, onChange, disabled, className, placeholder = 'Choose time' }: ClockTimePickerProps) {
  const initial = useMemo(() => parseTime(value || '07:00'), [value]);
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [period, setPeriod] = useState<'AM' | 'PM'>(initial.period);

  const openPicker = () => {
    const parsed = parseTime(value || '07:00');
    setHour(parsed.hour);
    setMinute(parsed.minute);
    setPeriod(parsed.period);
    setOpen(true);
  };

  const save = () => {
    onChange(to24Hour(hour, minute, period));
    setOpen(false);
  };

  return (
    <>
      <Button type="button" variant="outline" disabled={disabled} onClick={openPicker} className={cn('w-full justify-between h-11', className)}>
        <span className={value ? 'font-semibold' : 'text-muted-foreground'}>{value ? formatTime(value) : placeholder}</span>
        <Clock3 className="w-4 h-4 text-muted-foreground" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Choose a time</DialogTitle></DialogHeader>
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="text-center text-4xl font-display font-bold mb-5">{hour}:{String(minute).padStart(2, '0')} <span className="text-xl text-muted-foreground">{period}</span></div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <select aria-label="Hour" value={hour} onChange={(event) => setHour(Number(event.target.value))} className="h-12 rounded-xl border border-border bg-background px-3 text-center font-semibold">
                {Array.from({ length: 12 }, (_, index) => index + 1).map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select aria-label="Minute" value={minute} onChange={(event) => setMinute(Number(event.target.value))} className="h-12 rounded-xl border border-border bg-background px-3 text-center font-semibold">
                {Array.from({ length: 60 }, (_, index) => index).map((item) => <option key={item} value={item}>{String(item).padStart(2, '0')}</option>)}
              </select>
              <div className="grid grid-rows-2 gap-1">
                {(['AM', 'PM'] as const).map((item) => (
                  <button key={item} type="button" onClick={() => setPeriod(item)} className={cn('rounded-lg border px-3 text-xs font-bold', period === item ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-background')}>{item}</button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" onClick={save}>Set time</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
''')
write('src/components/league/config-inputs/TimeConfigInput.tsx', r'''import { Label } from '@/components/ui/label';
import { ClockTimePicker } from '@/components/ui/clock-time-picker';

interface TimeConfigInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  description?: string;
}

export function TimeConfigInput({ value, onChange, label, description }: TimeConfigInputProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <ClockTimePicker value={value} onChange={onChange} />
    </div>
  );
}
''')
write('src/components/checkin/TimeCheckinInput.tsx', r'''import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ClockTimePicker } from '@/components/ui/clock-time-picker';

interface TimeCheckinInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  targetTime?: string;
  isBefore?: boolean;
}

function friendlyTime(value: string) {
  const [hourText, minute = '00'] = value.split(':');
  const hour24 = Number(hourText);
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour = hour24 % 12 || 12;
  return `${hour}:${minute} ${period}`;
}

export function TimeCheckinInput({ value, onChange, disabled = false, label = 'Time', targetTime, isBefore = true }: TimeCheckinInputProps) {
  const [localValue, setLocalValue] = useState(value || '');
  useEffect(() => setLocalValue(value || ''), [value]);

  const meetsTarget = (): boolean | null => {
    if (!value || !targetTime) return null;
    const [valueHours, valueMinutes] = value.split(':').map(Number);
    const [targetHours, targetMinutes] = targetTime.split(':').map(Number);
    const valueTotal = valueHours * 60 + valueMinutes;
    const targetTotal = targetHours * 60 + targetMinutes;
    return isBefore ? valueTotal <= targetTotal : valueTotal >= targetTotal;
  };
  const targetMet = meetsTarget();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        {targetTime && <span className="text-xs text-muted-foreground">Target: {isBefore ? 'by' : 'after'} {friendlyTime(targetTime)}</span>}
      </div>
      <ClockTimePicker value={localValue} onChange={(next) => { setLocalValue(next); onChange(next); }} disabled={disabled} className={cn(targetMet === true && 'border-primary ring-1 ring-primary/20', targetMet === false && 'border-loss ring-1 ring-loss/20')} />
      {targetMet !== null && <div className={cn('text-xs font-medium', targetMet ? 'text-primary' : 'text-loss')}>{targetMet ? '✓ Target met!' : '✗ Target not met'}</div>}
    </div>
  );
}
''')

# ---------------------------------------------------------------------------
# Reading completion note: optional prompt after a Reading check-in. It stores
# the note on the check-in metadata so the existing immutable score event stays
# the source of truth while the feed can show what was read.
# ---------------------------------------------------------------------------
write('src/components/checkin/ReadingSharePrompt.tsx', r'''import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useSubmitCheckin } from '@/hooks/useTasksWithCheckins';
import type { TaskWithTemplate } from '@/types/checkin';

export function ReadingSharePrompt({ task, date }: { task: TaskWithTemplate; date?: Date }) {
  const submit = useSubmitCheckin();
  const checkin = task.todayCheckin;
  const metadata = useMemo(() => (checkin?.metadata || {}) as Record<string, unknown>, [checkin?.metadata]);
  const isReading = /reading/i.test(task.task_name) || /reading/i.test(task.template?.name || '');
  const shouldPrompt = !!checkin && isReading && !metadata.reading_note && metadata.reading_prompt_skipped !== true;
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (shouldPrompt) setOpen(true);
  }, [shouldPrompt, checkin?.id]);

  if (!checkin || !isReading) return null;

  const saveMetadata = async (patch: Record<string, unknown>) => {
    await submit.mutateAsync({
      taskInstanceId: task.id,
      date,
      value: {
        boolean_value: checkin.boolean_value ?? undefined,
        numeric_value: checkin.numeric_value ?? undefined,
        time_value: checkin.time_value ?? undefined,
        duration_minutes: checkin.duration_minutes ?? undefined,
        metadata: { ...metadata, ...patch },
      },
    });
  };

  const skip = async () => {
    await saveMetadata({ reading_prompt_skipped: true });
    setOpen(false);
  };

  const share = async () => {
    const clean = note.trim();
    if (!clean) return;
    await saveMetadata({ reading_note: clean, reading_shared_at: new Date().toISOString(), reading_prompt_skipped: false });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center mb-2"><BookOpen className="w-5 h-5" /></div>
          <DialogTitle>What did you read?</DialogTitle>
          <p className="text-sm text-muted-foreground">Optional. Share a little context with the league so Reading feels like a real activity, not just +3.</p>
        </DialogHeader>
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={180} rows={3} placeholder="20 pages of To Kill a Mockingbird" autoFocus />
        <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" onClick={() => void skip()} disabled={submit.isPending}>Skip</Button>
          <Button type="button" onClick={() => void share()} disabled={submit.isPending || !note.trim()} className="gap-2"><Send className="w-4 h-4" />Share</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
''')
replace_once('src/components/checkin/DailyCheckinList.tsx', "import { CheckinCard } from './CheckinCard';", "import { CheckinCard } from './CheckinCard';\nimport { ReadingSharePrompt } from './ReadingSharePrompt';")
replace_once('src/components/checkin/DailyCheckinList.tsx', "  tasks: TaskWithTemplate[];\n  isLoading: boolean;", "  tasks: TaskWithTemplate[];\n  date?: Date;\n  isLoading: boolean;")
replace_once('src/components/checkin/DailyCheckinList.tsx', "export function DailyCheckinList({ tasks, isLoading, weekId, powerPlayEnabled = false }: DailyCheckinListProps)", "export function DailyCheckinList({ tasks, date, isLoading, weekId, powerPlayEnabled = false }: DailyCheckinListProps)")
replace_once('src/components/checkin/DailyCheckinList.tsx', "                  />\n                </motion.div>", "                  />\n                  <ReadingSharePrompt task={task} date={date} />\n                </motion.div>")

# ---------------------------------------------------------------------------
# Feed: reactions remain; add comments and show optional Reading details.
# ---------------------------------------------------------------------------
write('src/pages/Feed.tsx', r'''import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Activity, Clock, MessageCircle, Send, TrendingUp, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUserPrimaryLeague } from '@/hooks/useLeagueDetails';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface FeedEntry {
  id: string;
  kind: 'score' | 'taunt' | 'league';
  title: string;
  body: string | null;
  created_at: string;
  avatar_url: string | null;
  points?: number;
  powerPlay?: boolean;
}

type LeagueEventRow = { id: string; event_type: string; title: string; body: string | null; created_at: string; profiles?: { avatar_url?: string | null } | null };
type ScoringFeedRow = {
  id: string;
  points_awarded: number;
  powerup_applied?: unknown;
  created_at: string;
  profiles?: { display_name?: string | null; avatar_url?: string | null } | null;
  task_instances?: { league_task_configs?: { task_templates?: { name?: string | null } | null } | null } | null;
  daily_checkins?: { metadata?: Record<string, unknown> | null } | null;
};
type ReactionRow = { id: string; event_key: string; user_id: string; emoji: string };
type RawCommentRow = { id: string; event_key: string; user_id: string; body: string; created_at: string };
type CommentRow = RawCommentRow & { display_name: string; avatar_url: string | null };

const REACTIONS = ['🔥', '😂', '💀', '👏', '😤'] as const;
function isImageUrl(value: string | null): boolean { return !!value && (value.startsWith('http://') || value.startsWith('https://')); }

export default function Feed() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: league } = useUserPrimaryLeague();
  const leagueId = league?.id;
  const queryKey = ['league-events', leagueId];
  const reactionKey = ['feed-reactions', leagueId];
  const commentKey = ['feed-comments', leagueId];
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data: entries = [], isLoading } = useQuery({
    queryKey,
    enabled: !!leagueId,
    queryFn: async (): Promise<FeedEntry[]> => {
      if (!leagueId) return [];
      const [eventsResult, scoresResult] = await Promise.all([
        supabase.from('league_events').select(`id,event_type,title,body,created_at,actor_user_id,profiles!league_events_actor_user_id_fkey(display_name,avatar_url)`).eq('league_id', leagueId).order('created_at', { ascending: false }).limit(60),
        supabase.from('scoring_events').select(`id,user_id,points_awarded,powerup_applied,created_at,daily_checkins!scoring_events_daily_checkin_id_fkey(metadata),task_instances!scoring_events_task_instance_id_fkey(league_task_configs(task_templates(name,icon))),profiles!scoring_events_user_id_fkey(display_name,avatar_url)`).eq('league_id', leagueId).eq('is_reversed', false).gt('points_awarded', 0).order('created_at', { ascending: false }).limit(80),
      ]);
      if (eventsResult.error) throw eventsResult.error;
      if (scoresResult.error) throw scoresResult.error;

      const leagueRows = (eventsResult.data || []) as unknown as LeagueEventRow[];
      const scoreRows = (scoresResult.data || []) as unknown as ScoringFeedRow[];
      const leagueEntries: FeedEntry[] = leagueRows.map((event) => ({ id: `event-${event.id}`, kind: event.event_type === 'taunt' ? 'taunt' : 'league', title: event.title, body: event.body, created_at: event.created_at, avatar_url: event.profiles?.avatar_url || null }));
      const scoringEntries: FeedEntry[] = scoreRows.map((event) => {
        const profile = event.profiles;
        const template = event.task_instances?.league_task_configs?.task_templates;
        const points = Number(event.points_awarded);
        const powerPlay = event.powerup_applied != null;
        const taskName = template?.name || 'a task';
        const readingNote = typeof event.daily_checkins?.metadata?.reading_note === 'string' ? event.daily_checkins.metadata.reading_note : null;
        return {
          id: `score-${event.id}`,
          kind: 'score',
          title: powerPlay ? `⚡ ${profile?.display_name || 'Player'} dropped a Power Play on ${taskName}` : points >= 5 ? `🔥 ${profile?.display_name || 'Player'} put up ${points} on ${taskName}` : `${profile?.display_name || 'Player'} scored ${taskName}`,
          body: readingNote ? `📖 ${readingNote}` : null,
          created_at: event.created_at,
          avatar_url: profile?.avatar_url || null,
          points,
          powerPlay,
        };
      });
      return [...leagueEntries, ...scoringEntries].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 100);
    },
    staleTime: 10_000,
  });

  const { data: reactions = [] } = useQuery({
    queryKey: reactionKey,
    enabled: !!leagueId,
    queryFn: async (): Promise<ReactionRow[]> => {
      if (!leagueId) return [];
      const { data, error } = await supabase.from('feed_reactions' as never).select('id,event_key,user_id,emoji').eq('league_id', leagueId);
      if (error) throw error;
      return (data || []) as unknown as ReactionRow[];
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: commentKey,
    enabled: !!leagueId,
    queryFn: async (): Promise<CommentRow[]> => {
      if (!leagueId) return [];
      const { data, error } = await supabase.from('feed_comments' as never).select('id,event_key,user_id,body,created_at').eq('league_id', leagueId).order('created_at', { ascending: true });
      if (error) throw error;
      const rows = (data || []) as unknown as RawCommentRow[];
      const userIds = [...new Set(rows.map((row) => row.user_id))];
      if (userIds.length === 0) return [];
      const { data: profiles, error: profileError } = await supabase.from('profiles').select('id,display_name,avatar_url').in('id', userIds);
      if (profileError) throw profileError;
      const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
      return rows.map((row) => ({ ...row, display_name: profileMap.get(row.user_id)?.display_name || 'Player', avatar_url: profileMap.get(row.user_id)?.avatar_url || null }));
    },
  });

  const reactToEntry = useMutation({
    mutationFn: async ({ eventKey, emoji }: { eventKey: string; emoji: string }) => {
      if (!leagueId || !user?.id) throw new Error('Sign in to react');
      const existing = reactions.find((reaction) => reaction.event_key === eventKey && reaction.user_id === user.id);
      if (existing?.emoji === emoji) {
        const { error } = await supabase.from('feed_reactions' as never).delete().eq('id', existing.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from('feed_reactions' as never).upsert({ league_id: leagueId, event_key: eventKey, user_id: user.id, emoji } as never, { onConflict: 'event_key,user_id' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reactionKey }),
  });

  const addComment = useMutation({
    mutationFn: async ({ eventKey, body }: { eventKey: string; body: string }) => {
      if (!leagueId || !user?.id) throw new Error('Sign in to comment');
      const clean = body.trim();
      if (!clean) return;
      const { error } = await supabase.from('feed_comments' as never).insert({ league_id: leagueId, event_key: eventKey, user_id: user.id, body: clean } as never);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      setDrafts((current) => ({ ...current, [variables.eventKey]: '' }));
      queryClient.invalidateQueries({ queryKey: commentKey });
    },
  });

  useEffect(() => {
    if (!leagueId) return;
    const channel = supabase.channel(`league-feed-${leagueId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'league_events', filter: `league_id=eq.${leagueId}` }, () => queryClient.invalidateQueries({ queryKey }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scoring_events', filter: `league_id=eq.${leagueId}` }, () => queryClient.invalidateQueries({ queryKey }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_reactions', filter: `league_id=eq.${leagueId}` }, () => queryClient.invalidateQueries({ queryKey: reactionKey }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_comments', filter: `league_id=eq.${leagueId}` }, () => queryClient.invalidateQueries({ queryKey: commentKey }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [leagueId, queryClient]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border safe-top"><div className="px-4 py-3"><p className="text-xs text-muted-foreground">{league?.name || 'Your league'}</p><h1 className="font-display font-bold text-xl">League Feed</h1></div></header>
      <main className="px-4 py-4">
        <div className="mb-4"><p className="text-sm font-semibold">League moments</p><p className="text-xs text-muted-foreground">Scores, books, Power Plays, taunts, punishments and the moments worth talking about.</p></div>
        {isLoading ? <div className="space-y-3">{[1,2,3,4].map((item)=><Skeleton key={item} className="h-24 rounded-xl" />)}</div> : entries.length === 0 ? (
          <div className="card-elevated rounded-xl py-12 text-center text-muted-foreground"><Activity className="w-8 h-8 mx-auto mb-3 opacity-50" /><p className="text-sm font-medium">Quiet league so far</p><p className="text-xs mt-1">The first score or taunt will show up here.</p></div>
        ) : <div className="space-y-3">{entries.map((entry) => {
          const isTaunt=entry.kind==='taunt'; const isScore=entry.kind==='score'; const initials=entry.title.charAt(0).toUpperCase(); const entryReactions=reactions.filter((reaction)=>reaction.event_key===entry.id); const myReaction=entryReactions.find((reaction)=>reaction.user_id===user?.id)?.emoji; const entryComments=comments.filter((comment)=>comment.event_key===entry.id); const commentsOpen=expandedComments[entry.id] || entryComments.length>0; const draft=drafts[entry.id] || '';
          return <div key={entry.id} className={`p-3 rounded-xl border ${isTaunt?'bg-secondary/10 border-secondary/20':entry.powerPlay?'bg-secondary/5 border-secondary/25':isScore?'bg-primary/5 border-primary/15':'bg-card border-border'}`}>
            <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0 ${isTaunt?'bg-secondary/20':isScore?'bg-primary/20':'bg-muted'}`}>{entry.avatar_url ? isImageUrl(entry.avatar_url) ? <img src={entry.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xl">{entry.avatar_url}</span> : isTaunt?<MessageCircle className="w-5 h-5 text-secondary"/>:entry.powerPlay?<Zap className="w-5 h-5 text-secondary"/>:isScore?<TrendingUp className="w-5 h-5 text-primary"/>:<span className="font-semibold text-sm">{initials}</span>}</div>
              <div className="flex-1 min-w-0"><div className="flex items-start justify-between gap-2"><p className="font-medium text-sm leading-tight">{entry.title}</p>{isScore&&entry.points!==undefined&&<span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-bold bg-primary/20 text-primary">+{entry.points}</span>}</div>{entry.body&&<p className="text-sm mt-1">{entry.body}</p>}<p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><Clock className="w-2.5 h-2.5"/>{formatDistanceToNow(new Date(entry.created_at),{addSuffix:true})}</p></div></div>
            <div className="flex items-center gap-1 mt-3 pl-12 flex-wrap">{REACTIONS.map((emoji)=>{const count=entryReactions.filter((reaction)=>reaction.emoji===emoji).length;const selected=myReaction===emoji;return <button type="button" key={emoji} onClick={()=>reactToEntry.mutate({eventKey:entry.id,emoji})} className={`h-7 min-w-8 px-1.5 rounded-full border text-xs flex items-center justify-center gap-1 transition-colors ${selected?'bg-primary/15 border-primary/30':'bg-muted/40 border-border hover:bg-muted'}`}><span>{emoji}</span>{count>0&&<span className="text-[10px]">{count}</span>}</button>;})}<button type="button" onClick={()=>setExpandedComments((current)=>({...current,[entry.id]:!current[entry.id]}))} className="h-7 px-2 rounded-full border border-border bg-muted/40 text-[11px] flex items-center gap-1"><MessageCircle className="w-3 h-3"/>{entryComments.length || 'Comment'}</button></div>
            {commentsOpen && <div className="mt-3 ml-12 space-y-2"><div className="space-y-2">{entryComments.map((comment)=><div key={comment.id} className="rounded-xl bg-background/70 border border-border/60 px-3 py-2"><div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-muted overflow-hidden flex items-center justify-center text-[10px]">{comment.avatar_url ? isImageUrl(comment.avatar_url)?<img src={comment.avatar_url} alt="" className="w-full h-full object-cover"/>:<span>{comment.avatar_url}</span>:comment.display_name.charAt(0)}</div><span className="text-[11px] font-semibold">{comment.display_name}</span><span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(comment.created_at),{addSuffix:true})}</span></div><p className="text-sm mt-1">{comment.body}</p></div>)}</div><div className="flex gap-2"><Input value={draft} onChange={(event)=>setDrafts((current)=>({...current,[entry.id]:event.target.value}))} placeholder="Talk trash or cheer them on…" maxLength={500} onKeyDown={(event)=>{if(event.key==='Enter'&&!event.shiftKey&&draft.trim()){event.preventDefault();addComment.mutate({eventKey:entry.id,body:draft});}}}/><Button type="button" size="icon" onClick={()=>addComment.mutate({eventKey:entry.id,body:draft})} disabled={!draft.trim()||addComment.isPending}><Send className="w-4 h-4"/></Button></div></div>}
          </div>;
        })}</div>}
      </main>
    </div>
  );
}
''')

# ---------------------------------------------------------------------------
# Unlimited custom tasks in the commissioner task manager.
# ---------------------------------------------------------------------------
write('src/components/league/ManageTasksDialog.tsx', r'''import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Clock, Plus, Settings2, Sparkles, Trash2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTaskTemplates, TaskTemplate } from '@/hooks/useTaskTemplates';
import { useLeagueTaskConfigs, useUpdateTaskConfig, useRemoveTaskConfig, useAddTaskConfig, LeagueTaskConfig } from '@/hooks/useLeagueTaskConfigs';
import { TaskConfigurationPanel, TaskConfigOverrides, getInitialConfig } from './TaskConfigurationPanel';
import { CustomChallengeBuilder, type CustomChallengeValue } from './CustomChallengeBuilder';
import { toast } from 'sonner';

interface ManageTasksDialogProps { open: boolean; onOpenChange: (open: boolean) => void; seasonId: string; nextWeekStart?: string; }
const CUSTOM_PREFIX = 'Custom Challenge —';

export function ManageTasksDialog({ open, onOpenChange, seasonId, nextWeekStart }: ManageTasksDialogProps) {
  const { data: configs, isLoading: configsLoading } = useLeagueTaskConfigs(seasonId);
  const { data: templates } = useTaskTemplates();
  const updateConfig = useUpdateTaskConfig();
  const removeConfig = useRemoveTaskConfig();
  const addConfig = useAddTaskConfig();
  const [expandedConfigId, setExpandedConfigId] = useState<string | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newCustomTask, setNewCustomTask] = useState<CustomChallengeValue | undefined>();

  const enabledConfigs = configs?.filter((config) => config.is_enabled && config.task_template) || [];
  const customTemplates = templates?.filter((template) => template.name.startsWith(CUSTOM_PREFIX)) || [];
  const customTemplateIds = new Set(customTemplates.map((template) => template.id));
  const addedStandardIds = new Set(enabledConfigs.filter((config) => !customTemplateIds.has(config.task_template_id)).map((config) => config.task_template_id));
  const availableTemplates = templates?.filter((template) => !customTemplateIds.has(template.id) && !addedStandardIds.has(template.id)) || [];

  const timingDescription = nextWeekStart ? `Changes take effect ${nextWeekStart}` : 'Changes saved';

  const handleUpdateConfig = async (configId: string, overrides: TaskConfigOverrides) => {
    try { await updateConfig.mutateAsync({ configId, updates: { config_overrides: overrides } }); toast.success('Task configuration updated', { description: timingDescription }); }
    catch { toast.error('Failed to update task'); }
  };
  const handleRemoveTask = async (configId: string, taskName: string) => {
    try { await removeConfig.mutateAsync(configId); toast.success(`${taskName} removed`, { description: timingDescription }); }
    catch { toast.error('Failed to remove task'); }
  };
  const handleAddTask = async (template: TaskTemplate) => {
    try { await addConfig.mutateAsync({ seasonId, taskTemplateId: template.id, configOverrides: getInitialConfig(template) }); toast.success(`${template.name} added`, { description: timingDescription }); }
    catch { toast.error('Failed to add task'); }
  };
  const handleAddCustom = async () => {
    if (!newCustomTask?.config.custom_name?.trim()) { toast.error('Give the custom task a name'); return; }
    try {
      await addConfig.mutateAsync({ seasonId, taskTemplateId: newCustomTask.templateId, configOverrides: newCustomTask.config as never });
      toast.success(`${newCustomTask.config.custom_name} added`, { description: timingDescription });
      setNewCustomTask(undefined);
    } catch { toast.error('Failed to add custom task'); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings2 className="w-5 h-5" />Manage League Tasks</DialogTitle></DialogHeader>
        {nextWeekStart && <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20"><Clock className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" /><p className="text-sm text-amber-500">Changes take effect at the start of next week ({nextWeekStart})</p></div>}

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {configsLoading ? <div className="text-center py-8 text-muted-foreground">Loading tasks...</div> : enabledConfigs.length === 0 ? <div className="text-center py-8"><AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-2" /><p className="text-muted-foreground">No tasks configured yet</p></div> : <div className="space-y-3">{enabledConfigs.map((config) => <TaskConfigCard key={config.id} config={config} isExpanded={expandedConfigId===config.id} onToggleExpand={()=>setExpandedConfigId(expandedConfigId===config.id?null:config.id)} onUpdate={(overrides)=>handleUpdateConfig(config.id,overrides)} onRemove={()=>handleRemoveTask(config.id, String((config.config_overrides as Record<string, unknown> | null)?.custom_name || config.task_template.name))} isUpdating={updateConfig.isPending} isRemoving={removeConfig.isPending} />)}</div>}

          <AnimatePresence>{showAddTask && <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden"><div className="border border-dashed border-border rounded-xl p-4 space-y-5">
            <div className="flex items-center justify-between"><div><h4 className="font-medium">Add tasks</h4><p className="text-xs text-muted-foreground">Use defaults or create as many league-specific tasks as you want.</p></div><Button variant="ghost" size="icon" onClick={()=>setShowAddTask(false)}><X className="w-4 h-4"/></Button></div>
            {availableTemplates.length>0 && <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Default tasks</p><div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">{availableTemplates.map((template)=><button key={template.id} onClick={()=>handleAddTask(template)} disabled={addConfig.isPending} className="p-3 rounded-lg border border-border bg-card hover:bg-accent/50 text-left transition-colors disabled:opacity-50"><p className="font-medium text-sm truncate">{template.name}</p><p className="text-xs text-muted-foreground capitalize">{template.category}</p></button>)}</div></div>}
            <div className="border-t border-border pt-4 space-y-3"><div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-secondary"/><p className="text-sm font-semibold">Custom task</p></div><CustomChallengeBuilder templates={customTemplates} value={newCustomTask} onChange={setNewCustomTask}/>{newCustomTask && <Button type="button" className="w-full" onClick={()=>void handleAddCustom()} disabled={addConfig.isPending||!newCustomTask.config.custom_name?.trim()}><Plus className="w-4 h-4 mr-2"/>Add this custom task</Button>}<p className="text-[11px] text-muted-foreground text-center">Add another after saving—there is no custom-task limit.</p></div>
          </div></motion.div>}</AnimatePresence>
        </div>

        <div className="flex gap-2 pt-4 border-t border-border"><Button variant="outline" onClick={()=>setShowAddTask((current)=>!current)} className="flex-1"><Plus className="w-4 h-4 mr-2"/>{showAddTask?'Hide':'Add Task'}</Button><Button onClick={()=>onOpenChange(false)} className="flex-1">Done</Button></div>
      </DialogContent>
    </Dialog>
  );
}

interface TaskConfigCardProps { config: LeagueTaskConfig; isExpanded:boolean; onToggleExpand:()=>void; onUpdate:(overrides:TaskConfigOverrides)=>void; onRemove:()=>void; isUpdating:boolean; isRemoving:boolean; }
function TaskConfigCard({config,isExpanded,onToggleExpand,onUpdate,onRemove,isRemoving}:TaskConfigCardProps){
  const template=config.task_template;
  const currentOverrides=(config.config_overrides||{}) as unknown as TaskConfigOverrides;
  if(!template)return null;
  const displayName=currentOverrides.custom_name?.trim()||template.name;
  return <motion.div layout className="rounded-xl border border-border bg-card p-4"><div className="flex items-start justify-between gap-3"><div className="flex-1 min-w-0"><p className="font-medium truncate">{displayName}</p><div className="flex items-center gap-2 mt-1"><Badge variant="outline" className="text-xs capitalize">{template.name.startsWith(CUSTOM_PREFIX)?'custom':template.category}</Badge>{currentOverrides?.scoring_mode==='binary'&&<Badge variant="secondary" className="text-xs">Goal</Badge>}{currentOverrides?.target_time&&<Badge variant="secondary" className="text-xs">{currentOverrides.target_time}</Badge>}</div></div><Button variant="ghost" size="icon" onClick={onRemove} disabled={isRemoving} className="text-destructive hover:text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4"/></Button></div><TaskConfigurationPanel template={template} config={currentOverrides||getInitialConfig(template)} onChange={onUpdate} isExpanded={isExpanded} onToggleExpand={onToggleExpand}/></motion.div>;
}
''')
replace_once('src/components/league/CustomChallengeBuilder.tsx', 'Add one shared challenge that fits your group—religious study, language practice, no dessert, anything you care about.', 'Create a league-specific task—religious study, language practice, no dessert, anything you care about.')
replace_once('src/components/league/CustomChallengeBuilder.tsx', 'Add a custom challenge', 'Create a custom task')
replace_once('src/components/league/CustomChallengeBuilder.tsx', '<p className="font-semibold">League Challenge</p>', '<p className="font-semibold">Custom Task</p>')

# ---------------------------------------------------------------------------
# League switcher + create-another-league UI.
# ---------------------------------------------------------------------------
write('src/components/league/LeagueSwitcher.tsx', r'''import { ChevronDown, Plus, Swords, ListOrdered, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { UserLeagueMembership } from '@/hooks/useLeagueDetails';

export function LeagueSwitcher({ currentLeagueId, currentName, memberships, onSelect, onCreate }: { currentLeagueId:string; currentName:string; memberships:UserLeagueMembership[]; onSelect:(leagueId:string)=>void; onCreate:()=>void }) {
  if (memberships.length <= 1) {
    return <button type="button" onClick={onCreate} className="text-left group"><h1 className="font-display font-bold text-xl flex items-center gap-1">{currentName}<Plus className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60"/></h1></button>;
  }
  return <Popover><PopoverTrigger asChild><button type="button" className="flex items-center gap-1 text-left"><h1 className="font-display font-bold text-xl">{currentName}</h1><ChevronDown className="w-4 h-4 text-muted-foreground"/></button></PopoverTrigger><PopoverContent align="start" className="w-72 p-2"><p className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Your leagues</p><div className="space-y-1">{memberships.map((membership)=>{const item=membership.leagues; if(!item)return null; const Icon=item.game_format==='solo'?UserRound:item.game_format==='leaderboard'?ListOrdered:Swords; const selected=membership.league_id===currentLeagueId; return <button key={membership.league_id} type="button" onClick={()=>onSelect(membership.league_id)} className={`w-full rounded-xl p-2.5 flex items-center gap-3 text-left ${selected?'bg-primary/10 text-primary':'hover:bg-muted'}`}><div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"><Icon className="w-4 h-4"/></div><div className="min-w-0"><p className="text-sm font-semibold truncate">{item.name}</p><p className="text-[10px] text-muted-foreground capitalize">{String(item.game_format||'head_to_head').replaceAll('_',' ')}</p></div></button>})}</div><div className="border-t border-border mt-2 pt-2"><Button variant="ghost" className="w-full justify-start gap-2" onClick={onCreate}><Plus className="w-4 h-4"/>Create another league</Button></div></PopoverContent></Popover>;
}
''')
path='src/pages/League.tsx'
text=read(path)
text=text.replace("import { Crown, ListOrdered, Trophy, Share2, Settings, Swords, Loader2, Zap, Play, Users, Clock } from 'lucide-react';", "import { Crown, ListOrdered, Trophy, Share2, Settings, Swords, Loader2, Zap, Play, Users, Clock } from 'lucide-react';\nimport { CreateLeagueWizard } from '@/components/league/CreateLeagueWizard';\nimport { LeagueSwitcher } from '@/components/league/LeagueSwitcher';",1)
text=text.replace("  const { data: league, isLoading, error, leagueId } = useUserPrimaryLeague();", "  const { data: league, isLoading, error, leagueId, memberships, selectLeague } = useUserPrimaryLeague();",1)
text=text.replace("  const [showInitialSetup, setShowInitialSetup] = useState(false);", "  const [showInitialSetup, setShowInitialSetup] = useState(false);\n  const [showCreateLeague, setShowCreateLeague] = useState(false);",1)
old_no_league=r'''  if (error || !league) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-display font-bold mb-2">No League Found</h2>
          <p className="text-muted-foreground">Join or create a league to get started.</p>
        </div>
      </div>
    );
  }'''
new_no_league=r'''  if (error || !league) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-display font-bold mb-2">No League Selected</h2>
          <p className="text-muted-foreground mb-5">Create a league or join one with an invite.</p>
          <Button onClick={() => setShowCreateLeague(true)}>Create League</Button>
        </div>
        {showCreateLeague && <CreateLeagueWizard onClose={() => setShowCreateLeague(false)} />}
      </div>
    );
  }'''
if old_no_league not in text: raise RuntimeError('League no-league block missing')
text=text.replace(old_no_league,new_no_league,1)
text=text.replace('<h1 className="font-display font-bold text-xl">{league.name}</h1>', '<LeagueSwitcher currentLeagueId={league.id} currentName={league.name} memberships={memberships} onSelect={selectLeague} onCreate={() => setShowCreateLeague(true)} />',1)
# insert wizard before outer root closes, using known dialogs near end
needle='''      {currentSeason && (\n        <ManageTasksDialog'''
# no-op: wizard gets inserted before the final closing root using a stable final dialog marker below.
last='''      {currentSeason && (\n        <ManageTasksDialog'''
# Append wizard immediately before the final root closing by replacing the final two lines.
if text.rstrip().endswith('  );\n}'):
    text=text.rstrip()[:-5] + "      {showCreateLeague && <CreateLeagueWizard onClose={() => setShowCreateLeague(false)} />}\n    </div>\n  );\n}\n"
else:
    raise RuntimeError('Unexpected League.tsx ending')
write(path,text)

print('review feedback UI patch applied')
