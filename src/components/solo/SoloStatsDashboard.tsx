import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { eachDayOfInterval, format, isAfter, isBefore, parseISO, startOfDay, subDays } from 'date-fns';
import { BarChart3, CheckCircle2, Flame, Gauge, Target, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { TASK_ICONS, type TaskWithTemplate } from '@/types/checkin';
import { isTaskGoalMet } from '@/lib/taskProgress';

interface SoloStatsDashboardProps {
  seasonId: string;
  userId: string;
  seasonStart?: string | null;
  weekStart: string;
  weekEnd: string;
  weekPoints: number;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function SoloStatsDashboard({
  seasonId,
  userId,
  seasonStart,
  weekStart,
  weekEnd,
  weekPoints,
}: SoloStatsDashboardProps) {
  const query = useQuery({
    queryKey: ['solo-stats', seasonId, userId, weekStart, weekEnd],
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

      const start = seasonStart || weekStart;
      const { data: checkins, error: checkinError } = await supabase
        .from('daily_checkins')
        .select('*')
        .eq('user_id', userId)
        .in('task_instance_id', taskIds)
        .gte('checkin_date', start)
        .lte('checkin_date', format(new Date(), 'yyyy-MM-dd'))
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
    const weekStartDate = startOfDay(parseISO(weekStart));
    const parsedWeekEnd = startOfDay(parseISO(weekEnd));
    const effectiveWeekEnd = isBefore(today, parsedWeekEnd) ? today : parsedWeekEnd;
    const seasonStartDate = startOfDay(parseISO(seasonStart || weekStart));

    const weekDays = isAfter(weekStartDate, effectiveWeekEnd)
      ? []
      : eachDayOfInterval({ start: weekStartDate, end: effectiveWeekEnd });
    const seasonDays = isAfter(seasonStartDate, today)
      ? []
      : eachDayOfInterval({ start: seasonStartDate, end: today });

    const byTask = new Map<string, Map<string, (typeof checkins)[number]>>();
    checkins.forEach((checkin) => {
      const taskMap = byTask.get(checkin.task_instance_id) || new Map();
      taskMap.set(checkin.checkin_date, checkin);
      byTask.set(checkin.task_instance_id, taskMap);
    });

    const taskWithCheckin = (task: (typeof tasks)[number], checkin?: (typeof checkins)[number]): TaskWithTemplate => ({
      ...task,
      template: task.league_task_config?.task_template,
      todayCheckin: checkin,
    } as TaskWithTemplate);

    const goalMet = (task: (typeof tasks)[number], checkin?: (typeof checkins)[number]) =>
      !!checkin && isTaskGoalMet(taskWithCheckin(task, checkin));

    let weeklyLogged = 0;
    let weeklyHits = 0;
    let perfectDays = 0;

    const daily = weekDays.map((day) => {
      const key = format(day, 'yyyy-MM-dd');
      let logged = 0;
      let hits = 0;
      tasks.forEach((task) => {
        const checkin = byTask.get(task.id)?.get(key);
        if (checkin) logged += 1;
        if (goalMet(task, checkin)) hits += 1;
      });
      weeklyLogged += logged;
      weeklyHits += hits;
      if (tasks.length > 0 && hits === tasks.length) perfectDays += 1;
      return { key, label: format(day, 'EEE'), logged, hits };
    });

    const opportunities = tasks.length * weekDays.length;
    const hitRate = weeklyLogged > 0 ? (weeklyHits / weeklyLogged) * 100 : 0;
    const coverage = opportunities > 0 ? (weeklyLogged / opportunities) * 100 : 0;

    const perTask = tasks.map((task) => {
      const taskMap = byTask.get(task.id) || new Map<string, (typeof checkins)[number]>();
      let logged = 0;
      let hits = 0;
      let bestStreak = 0;
      let running = 0;

      seasonDays.forEach((day) => {
        const checkin = taskMap.get(format(day, 'yyyy-MM-dd'));
        if (checkin) logged += 1;
        if (goalMet(task, checkin)) {
          hits += 1;
          running += 1;
          bestStreak = Math.max(bestStreak, running);
        } else {
          running = 0;
        }
      });

      let currentStreak = 0;
      let cursor = today;
      const todayCheckin = taskMap.get(format(today, 'yyyy-MM-dd'));
      if (!todayCheckin) cursor = subDays(cursor, 1);

      while (!isBefore(cursor, seasonStartDate)) {
        const checkin = taskMap.get(format(cursor, 'yyyy-MM-dd'));
        if (!goalMet(task, checkin)) break;
        currentStreak += 1;
        cursor = subDays(cursor, 1);
      }

      return {
        id: task.id,
        name: task.task_name,
        icon: TASK_ICONS[task.league_task_config?.task_template?.icon ?? 'activity'] ?? '🎯',
        currentStreak,
        bestStreak,
        hitRate: logged > 0 ? (hits / logged) * 100 : 0,
        hits,
        logged,
      };
    }).sort((a, b) => b.currentStreak - a.currentStreak || b.hitRate - a.hitRate);

    return {
      daily,
      perTask,
      weeklyHits,
      weeklyLogged,
      hitRate,
      coverage,
      perfectDays,
    };
  }, [query.data, seasonStart, weekEnd, weekStart]);

  if (query.isLoading) {
    return (
      <section className="space-y-3">
        <Skeleton className="h-6 w-36" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-primary font-bold">Solo leaderboard</p>
          <h2 className="font-display font-bold text-xl mt-1">Beat your own numbers</h2>
        </div>
        <Trophy className="w-6 h-6 text-pending" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card-elevated rounded-xl p-4">
          <Gauge className="w-5 h-5 text-primary mb-2" />
          <p className="score-text text-2xl">{clampPercent(stats.hitRate)}%</p>
          <p className="text-xs font-semibold mt-1">Week hit rate</p>
          <p className="text-[10px] text-muted-foreground mt-1">{stats.weeklyHits} hits / {stats.weeklyLogged} logged</p>
        </div>
        <div className="card-elevated rounded-xl p-4">
          <BarChart3 className="w-5 h-5 text-secondary mb-2" />
          <p className="score-text text-2xl">{clampPercent(stats.coverage)}%</p>
          <p className="text-xs font-semibold mt-1">Card coverage</p>
          <p className="text-[10px] text-muted-foreground mt-1">How much of the week you logged</p>
        </div>
        <div className="card-elevated rounded-xl p-4">
          <Target className="w-5 h-5 text-primary mb-2" />
          <p className="score-text text-2xl">{weekPoints.toLocaleString()}</p>
          <p className="text-xs font-semibold mt-1">Week points</p>
          <p className="text-[10px] text-muted-foreground mt-1">Your personal weekly score</p>
        </div>
        <div className="card-elevated rounded-xl p-4">
          <CheckCircle2 className="w-5 h-5 text-primary mb-2" />
          <p className="score-text text-2xl">{stats.perfectDays}</p>
          <p className="text-xs font-semibold mt-1">Perfect days</p>
          <p className="text-[10px] text-muted-foreground mt-1">Every configured task hit</p>
        </div>
      </div>

      {stats.daily.length > 0 && (
        <div className="card-elevated rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-sm">This week</p>
            <p className="text-[10px] text-muted-foreground">hits / logged</p>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {stats.daily.map((day) => {
              const pct = day.logged > 0 ? (day.hits / day.logged) * 100 : 0;
              return (
                <div key={day.key} className="text-center">
                  <div className="h-20 rounded-lg bg-muted/60 overflow-hidden flex items-end">
                    <div className="w-full bg-primary/70 transition-all" style={{ height: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] font-semibold mt-1.5">{day.label}</p>
                  <p className="text-[9px] text-muted-foreground">{day.hits}/{day.logged}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-streak" />
          <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">Task streaks</h3>
        </div>
        {stats.perTask.map((task) => (
          <div key={task.id} className="card-elevated rounded-xl p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl">{task.icon}</div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">{task.name}</p>
                <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                  <span><strong className="text-foreground">{task.currentStreak}</strong> current</span>
                  <span><strong className="text-foreground">{task.bestStreak}</strong> best</span>
                  <span><strong className="text-foreground">{clampPercent(task.hitRate)}%</strong> hit rate</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="score-text text-lg">{task.currentStreak}</p>
                <p className="text-[9px] text-muted-foreground">day streak</p>
              </div>
            </div>
            <Progress value={task.hitRate} className="h-1.5 mt-3" />
          </div>
        ))}
      </div>
    </section>
  );
}
