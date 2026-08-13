import { useState } from 'react';
import { format } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, Calendar, Eye, Flag, ListFilter, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DailyCheckinList } from '@/components/checkin';
import { FinishMyCard, countFinishableTasks } from '@/components/checkin/FinishMyCard';
import { DeviceSyncCard } from '@/components/integrations/DeviceSyncCard';
import { useTasksWithCheckins } from '@/hooks/useTasksWithCheckins';
import { useUserPrimaryLeague } from '@/hooks/useLeagueDetails';
import { getCompetitionWeekPhase, formatWeekKickoff } from '@/lib/competition';
import { isTaskGoalMet } from '@/lib/taskProgress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

export default function Tasks() {
  const navigate = useNavigate();
  const { data: leagueDetails, isLoading: leagueLoading } = useUserPrimaryLeague();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [finishCardOpen, setFinishCardOpen] = useState(false);

  const currentSeasonId = leagueDetails?.current_season?.id;
  const seasonStatus = leagueDetails?.current_season?.status;
  const currentWeek = leagueDetails?.current_week;
  const weekPhase = getCompetitionWeekPhase(currentWeek?.start_date, currentWeek?.end_date);
  const isLeaderboard = leagueDetails?.game_format === 'leaderboard';
  const isSolo = leagueDetails?.game_format === 'solo';
  const isHeadToHead = leagueDetails?.game_format === 'head_to_head';
  const isSeasonDraft = seasonStatus === 'draft';
  const isSeasonActive = seasonStatus === 'active';
  const isWeekLive = isSeasonActive && weekPhase === 'live';
  const isPreseason = isWeekLive && currentWeek?.week_number === 0;
  const activeSeasonId = isWeekLive ? currentSeasonId : undefined;

  const { data: tasks = [], isLoading: tasksLoading } = useTasksWithCheckins(activeSeasonId, selectedDate);
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
    const next = new Date(previous);
    next.setDate(next.getDate() - 1);
    return next;
  });
  const goToNextDay = () => setSelectedDate((previous) => {
    const next = new Date(previous);
    next.setDate(next.getDate() + 1);
    return next;
  });

  const categories = ['All', ...Array.from(new Set(tasks.map((task) => task.template?.category).filter(Boolean))).map((category) => String(category).replace(/^./, (letter) => letter.toUpperCase()))];
  const filteredTasks = activeCategory && activeCategory !== 'All'
    ? tasks.filter((task) => task.template?.category?.toLowerCase() === activeCategory.toLowerCase())
    : tasks;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" onClick={goToPreviousDay} disabled={!isWeekLive}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="gap-2" disabled={!isWeekLive}>
                  <Calendar className="w-4 h-4" />
                  <span className="font-display font-bold">
                    {isWeekLive ? isPreseason ? 'Preseason Practice' : isToday ? 'Today’s Scoring' : format(selectedDate, 'EEE, MMM d') : 'Tasks'}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <CalendarComponent mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} initialFocus className={cn('p-3 pointer-events-auto')} />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" onClick={goToNextDay} disabled={!isWeekLive || isToday}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {isWeekLive && (
            <div className="bg-card rounded-xl p-3 border border-border/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{isPreseason ? 'Practice Scorecard' : 'Daily Scorecard'}</span>
                <span className="text-sm font-semibold">{completedCount} hit · {loggedCount} counted</span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  {scoringChancesLeft === 0 && tasks.length > 0
                    ? 'Perfect card — everything scored.'
                    : `${scoringChancesLeft} scoring chance${scoringChancesLeft === 1 ? '' : 's'} left`}
                </span>
                <span className="score-text text-sm text-primary">{Math.round(progress)}%</span>
              </div>
              {isToday && finishableCount >= 2 && (
                <Button variant="outline" className="w-full mt-3 h-9 gap-2" onClick={() => setFinishCardOpen(true)}>
                  <Zap className="w-3.5 h-3.5 text-secondary" />
                  Finish My Card · {finishableCount} quick decisions
                </Button>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="px-4 py-4">
        {isPreseason && (
          <div className="mb-4 rounded-xl border border-secondary/25 bg-secondary/10 p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-secondary/20 flex items-center justify-center shrink-0"><Flag className="w-4 h-4 text-secondary" /></div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-secondary font-bold">Preseason</p>
                <p className="font-semibold text-sm mt-0.5">Practice scoring is live</p>
                <p className="text-xs text-muted-foreground mt-1">Try every task now. Practice points reset when Week 1 starts Sunday and do not count toward standings, records, streaks, or Power Plays.</p>
              </div>
            </div>
          </div>
        )}

        {isWeekLive && (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
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
            </div>
            {isToday && <DeviceSyncCard tasks={tasks} date={selectedDate} />}
          </>
        )}

        {isSeasonDraft ? (
          <div className="text-center py-12 max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-secondary/15 flex items-center justify-center mx-auto mb-4"><Flag className="w-8 h-8 text-secondary" /></div>
            <p className="text-[10px] uppercase tracking-wider text-secondary font-bold">{isSolo ? 'Setup' : 'Preseason'}</p>
            <h2 className="text-xl font-display font-bold mt-1 mb-2">Week 1 hasn’t been started</h2>
            <p className="text-muted-foreground mb-6">
              {isSolo
                ? 'Finish your Solo scorecard setup, then start tracking immediately.'
                : isLeaderboard
                  ? 'League rules are set before kickoff. Once the commissioner starts the season, preseason practice opens immediately and the first official leaderboard starts Sunday.'
                  : 'League rules are set before kickoff. Once the commissioner starts the season, preseason practice opens immediately and the first official matchup starts Sunday.'}
            </p>
            <Button onClick={() => navigate('/league')}>Go to {isSolo ? 'Progress' : 'League'}</Button>
          </div>
        ) : isSeasonActive && weekPhase === 'scheduled' ? (
          <div className="text-center py-12 max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-secondary/15 flex items-center justify-center mx-auto mb-4"><Flag className="w-8 h-8 text-secondary" /></div>
            <p className="text-[10px] uppercase tracking-wider text-secondary font-bold">{isLeaderboard ? 'Leaderboard scheduled' : 'Matchup scheduled'}</p>
            <h2 className="text-xl font-display font-bold mt-1 mb-2">Check-ins unlock {formatWeekKickoff(currentWeek?.start_date)}</h2>
            <p className="text-muted-foreground mb-6">{isLeaderboard ? 'Everyone starts at zero when the Sunday-to-Saturday scoring week opens.' : 'Your opponent is set, but scoring stays locked until the Sunday-to-Saturday week begins.'}</p>
            <Button onClick={() => navigate(isLeaderboard ? '/league' : '/matchup')}>{isLeaderboard ? 'View Leaderboard' : 'View Matchup'}</Button>
          </div>
        ) : !currentSeasonId ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-xl font-display font-bold mb-2">No Season Yet</h2>
            <p className="text-muted-foreground mb-4">Join or create a league to start tracking your daily tasks.</p>
            <div className="flex flex-col gap-3 items-center">
              <Button onClick={() => navigate('/league')}>Go to League</Button>
              <Link to="/checkin-demo"><Button variant="outline" className="gap-2"><Eye className="w-4 h-4" />Preview Check-in UI</Button></Link>
            </div>
          </div>
        ) : isWeekLive ? (
          <DailyCheckinList
            tasks={filteredTasks}
            date={selectedDate}
            isLoading={tasksLoading || leagueLoading}
            weekId={currentWeek?.id}
            powerPlayEnabled={isHeadToHead && !isPreseason && isToday}
          />
        ) : (
          <div className="text-center py-12 text-muted-foreground"><p className="text-sm">This scoring week is closed.</p></div>
        )}
      </main>

      <FinishMyCard tasks={tasks} open={finishCardOpen} onOpenChange={setFinishCardOpen} />
    </div>
  );
}
