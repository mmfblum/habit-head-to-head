import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  eachDayOfInterval,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import { CheckCircle2, ChevronDown, ChevronUp, Circle, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { TASK_ICONS, type TaskWithTemplate } from '@/types/checkin';
import { isTaskGoalMet } from '@/lib/taskProgress';

type PeriodKey = 'day' | 'week' | 'month';

interface SoloStatsDashboardProps {
  seasonId: string;
  userId: string;
  seasonStart?: string | null;
  weekStart: string;
  weekEnd: string;
  weekPoints?: number;
  displayName?: string;
  scorecardName?: string;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function laterDate(a: Date, b: Date) {
  return isAfter(a, b) ? a : b;
}

function earlierDate(a: Date, b: Date) {
  return isBefore(a, b) ? a : b;
}

export function SoloStatsDashboard({
  seasonId,
  userId,
  seasonStart,
  weekStart,
  weekEnd,
  displayName,
  scorecardName,
}: SoloStatsDashboardProps) {
  const [expanded, setExpanded] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>('week');

  const query = useQuery({
    queryKey: ['solo-scorecard', seasonId, userId, weekStart, weekEnd],
    queryFn: async () => {
      const { data: tasks, error: taskError } = await supabase
        .from('task_instances')
        .select(`
          *,
          league_task_config:league_task_configs(
            task_template:task_templates(*)
          )
        `)
        .eq('season_id', seasonId);

      if (taskError) throw taskError;

      const taskIds = (tasks || []).map((task) => task.id);
      if (taskIds.length === 0) return { tasks: [], checkins: [] };

      const today = startOfDay(new Date());
      const seasonStartDate = startOfDay(parseISO(seasonStart || weekStart));
      const calendarStart = startOfDay(startOfMonth(today));
      const competitionWeekStart = startOfDay(parseISO(weekStart));
      const earliestNeeded = isBefore(calendarStart, competitionWeekStart) ? calendarStart : competitionWeekStart;
      const queryStart = laterDate(seasonStartDate, earliestNeeded);

      const { data: checkins, error: checkinError } = await supabase
        .from('daily_checkins')
        .select('*')
        .eq('user_id', userId)
        .in('task_instance_id', taskIds)
        .gte('checkin_date', format(queryStart, 'yyyy-MM-dd'))
        .lte('checkin_date', format(today, 'yyyy-MM-dd'))
        .order('checkin_date', { ascending: true });

      if (checkinError) throw checkinError;
      return { tasks: tasks || [], checkins: checkins || [] };
    },
    enabled: !!seasonId && !!userId,
  });

  const stats = useMemo(() => {
    const tasks = query.data?.tasks || [];
    const checkins = query.data?.checkins || [];
    const today = startOfDay(new Date());
    const seasonStartDate = startOfDay(parseISO(seasonStart || weekStart));
    const parsedWeekStart = startOfDay(parseISO(weekStart));
    const parsedWeekEnd = startOfDay(parseISO(weekEnd));

    const byTask = new Map<string, Map<string, (typeof checkins)[number]>>();
    checkins.forEach((checkin) => {
      const taskMap = byTask.get(checkin.task_instance_id) || new Map();
      taskMap.set(checkin.checkin_date, checkin);
      byTask.set(checkin.task_instance_id, taskMap);
    });

    const taskWithCheckin = (
      task: (typeof tasks)[number],
      checkin?: (typeof checkins)[number]
    ): TaskWithTemplate => ({
      ...task,
      template: task.league_task_config?.task_template,
      todayCheckin: checkin,
    } as TaskWithTemplate);

    const goalMet = (task: (typeof tasks)[number], checkin?: (typeof checkins)[number]) =>
      !!checkin && isTaskGoalMet(taskWithCheckin(task, checkin));

    const buildPeriod = (start: Date, end: Date) => {
      const effectiveStart = laterDate(startOfDay(start), seasonStartDate);
      const effectiveEnd = earlierDate(startOfDay(end), today);
      const days = isAfter(effectiveStart, effectiveEnd)
        ? []
        : eachDayOfInterval({ start: effectiveStart, end: effectiveEnd });

      let hits = 0;
      const perTask = tasks.map((task) => {
        let taskHits = 0;
        days.forEach((day) => {
          const checkin = byTask.get(task.id)?.get(format(day, 'yyyy-MM-dd'));
          if (goalMet(task, checkin)) {
            hits += 1;
            taskHits += 1;
          }
        });

        const opportunities = days.length;
        return {
          id: task.id,
          name: task.task_name,
          icon: TASK_ICONS[task.league_task_config?.task_template?.icon ?? 'activity'] ?? '🎯',
          hits: taskHits,
          opportunities,
          percentage: opportunities > 0 ? clampPercent((taskHits / opportunities) * 100) : 0,
        };
      }).sort((a, b) => a.percentage - b.percentage || a.name.localeCompare(b.name));

      const opportunities = tasks.length * days.length;
      return {
        hits,
        opportunities,
        percentage: opportunities > 0 ? clampPercent((hits / opportunities) * 100) : 0,
        perTask,
      };
    };

    const day = buildPeriod(today, today);
    const week = buildPeriod(parsedWeekStart, parsedWeekEnd);
    const month = buildPeriod(startOfMonth(today), today);

    return { day, week, month, taskCount: tasks.length, todayLabel: format(today, 'MMM d') };
  }, [query.data, seasonStart, weekEnd, weekStart]);

  if (query.isLoading) {
    return <Skeleton className="h-56 w-full rounded-2xl" />;
  }

  const selected = stats[period];
  const metricItems: Array<{ key: PeriodKey; label: string; value: number }> = [
    { key: 'day', label: 'Today', value: stats.day.percentage },
    { key: 'week', label: 'This week', value: stats.week.percentage },
    { key: 'month', label: 'This month', value: stats.month.percentage },
  ];

  return (
    <section className="rounded-2xl border border-primary/25 bg-card overflow-hidden shadow-sm">
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-primary font-bold">Zrizin Solo Scorecard</p>
            <h2 className="font-display font-bold text-xl mt-0.5 truncate">{scorecardName || 'My Scorecard'}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {displayName ? `${displayName} · ` : ''}through {stats.todayLabel}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Target className="w-5 h-5 text-primary" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          {metricItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setPeriod(item.key);
                setExpanded(true);
              }}
              className={`rounded-xl border px-2 py-3 text-center transition-colors ${
                period === item.key && expanded
                  ? 'border-primary/50 bg-primary/10'
                  : 'border-border bg-background/60 hover:border-primary/30'
              }`}
            >
              <p className="score-text text-2xl leading-none">{item.value}%</p>
              <p className="text-[10px] text-muted-foreground mt-1.5">{item.label}</p>
            </button>
          ))}
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 text-xs mb-2">
            <span className="font-semibold">Today</span>
            <span className="text-muted-foreground">
              {stats.day.hits}/{stats.day.opportunities} tasks complete
            </span>
          </div>
          <Progress value={stats.day.percentage} className="h-2" />
        </div>

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="w-full mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-xs font-semibold"
        >
          <span>{expanded ? 'Hide task breakdown' : 'See what is going well and what needs work'}</span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border bg-muted/20 p-4">
          <div className="grid grid-cols-3 gap-1.5 mb-4">
            {metricItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPeriod(item.key)}
                className={`rounded-lg px-2 py-2 text-xs font-semibold ${
                  period === item.key ? 'bg-primary text-primary-foreground' : 'bg-background border border-border'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs mb-3">
            <span className="font-semibold">{metricItems.find((item) => item.key === period)?.label}</span>
            <span className="text-muted-foreground">{selected.hits}/{selected.opportunities} completed</span>
          </div>

          <div className="space-y-2">
            {selected.perTask.map((task) => (
              <div key={task.id} className="rounded-xl bg-background border border-border/70 px-3 py-2.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-base shrink-0">{task.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold truncate">{task.name}</p>
                    <span className="text-sm font-bold">{task.percentage}%</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <Progress value={task.percentage} className="h-1.5 flex-1 mr-3" />
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {task.hits}/{task.opportunities}
                    </span>
                  </div>
                </div>
                {task.percentage === 100 ? (
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </div>
            ))}

            {stats.taskCount === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No tasks are configured yet.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
