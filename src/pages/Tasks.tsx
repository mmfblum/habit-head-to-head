import { useState } from 'react';
import { format } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, Calendar, Eye, Flag, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DailyCheckinList } from '@/components/checkin';
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

  const currentSeasonId = leagueDetails?.current_season?.id;
  const seasonStatus = leagueDetails?.current_season?.status;
  const currentWeek = leagueDetails?.current_week;
  const weekPhase = getCompetitionWeekPhase(currentWeek?.start_date, currentWeek?.end_date);
  const isLeaderboard = leagueDetails?.game_format === 'leaderboard';
  const isSeasonDraft = seasonStatus === 'draft';
  const isSeasonActive = seasonStatus === 'active';
  const isWeekLive = isSeasonActive && weekPhase === 'live';
  const activeSeasonId = isWeekLive ? currentSeasonId : undefined;

  const { data: tasks = [], isLoading: tasksLoading } = useTasksWithCheckins(activeSeasonId, selectedDate);

  const completedCount = tasks.filter(isTaskGoalMet).length;
  const scoringChancesLeft = Math.max(tasks.length - completedCount, 0);
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  const goToPreviousDay = () => {
    setSelectedDate((previous) => {
      const next = new Date(previous);
      next.setDate(next.getDate() - 1);
      return next;
    });
  };

  const goToNextDay = () => {
    setSelectedDate((previous) => {
      const next = new Date(previous);
      next.setDate(next.getDate() + 1);
      return next;
    });
  };

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  const categories = ['All', 'Fitness', 'Sleep', 'Learning', 'Mindfulness', 'Productivity', 'Custom'];
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
                    {isWeekLive ? (isToday ? 'Today’s Scoring' : format(selectedDate, 'EEE, MMM d')) : 'Tasks'}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>

            <Button variant="ghost" size="icon" onClick={goToNextDay} disabled={!isWeekLive || isToday}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {isWeekLive && (
            <div className="bg-card rounded-xl p-3 border border-border/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Daily Scorecard</span>
                <span className="text-sm font-semibold">{completedCount}/{tasks.length} goals hit</span>
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
            </div>
          )}
        </div>
      </header>

      <main className="px-4 py-4">
        {isWeekLive && (
          <>
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-4 px-4">
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
            </div>
            {isToday && <DeviceSyncCard />}
          </>
        )}

        {isSeasonDraft ? (
          <div className="text-center py-12 max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-secondary/15 flex items-center justify-center mx-auto mb-4">
              <Flag className="w-8 h-8 text-secondary" />
            </div>
            <p className="text-[10px] uppercase tracking-wider text-secondary font-bold">Preseason</p>
            <h2 className="text-xl font-display font-bold mt-1 mb-2">Week 1 hasn’t been started</h2>
            <p className="text-muted-foreground mb-6">
              {isLeaderboard
                ? 'League rules are set before kickoff. Once the commissioner starts the season, the first weekly leaderboard opens on Sunday.'
                : 'League rules are set before kickoff. Once the commissioner starts the season, the Sunday matchup schedule appears here.'}
            </p>
            <Button onClick={() => navigate('/league')}>Go to League</Button>
          </div>
        ) : isSeasonActive && weekPhase === 'scheduled' ? (
          <div className="text-center py-12 max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-secondary/15 flex items-center justify-center mx-auto mb-4">
              <Flag className="w-8 h-8 text-secondary" />
            </div>
            <p className="text-[10px] uppercase tracking-wider text-secondary font-bold">
              {isLeaderboard ? 'Leaderboard scheduled' : 'Matchup scheduled'}
            </p>
            <h2 className="text-xl font-display font-bold mt-1 mb-2">
              Check-ins unlock {formatWeekKickoff(currentWeek?.start_date)}
            </h2>
            <p className="text-muted-foreground mb-6">
              {isLeaderboard
                ? 'Everyone starts at zero when the Sunday-to-Saturday scoring week opens.'
                : 'Your opponent is set, but scoring stays locked until the Sunday-to-Saturday week begins.'}
            </p>
            <Button onClick={() => navigate(isLeaderboard ? '/league' : '/matchup')}>
              {isLeaderboard ? 'View Leaderboard' : 'View Matchup'}
            </Button>
          </div>
        ) : !currentSeasonId ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-xl font-display font-bold mb-2">No Season Yet</h2>
            <p className="text-muted-foreground mb-4">Join or create a league to start tracking your daily tasks.</p>
            <div className="flex flex-col gap-3 items-center">
              <Button onClick={() => navigate('/league')}>Go to League</Button>
              <Link to="/checkin-demo">
                <Button variant="outline" className="gap-2">
                  <Eye className="w-4 h-4" />
                  Preview Check-in UI
                </Button>
              </Link>
            </div>
          </div>
        ) : isWeekLive ? (
          <DailyCheckinList tasks={filteredTasks} isLoading={tasksLoading || leagueLoading} />
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">This scoring week is closed.</p>
          </div>
        )}
      </main>
    </div>
  );
}
