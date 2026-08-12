import { useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { Plus, ChevronLeft, ChevronRight, Calendar, Eye, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DailyCheckinList } from '@/components/checkin';
import { useTasksWithCheckins } from '@/hooks/useTasksWithCheckins';
import { useUserPrimaryLeague } from '@/hooks/useLeagueDetails';
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
  const isSeasonDraft = seasonStatus === 'draft';
  const isSeasonActive = seasonStatus === 'active';
  const activeSeasonId = isSeasonActive ? currentSeasonId : undefined;

  const { data: tasks = [], isLoading: tasksLoading } = useTasksWithCheckins(
    activeSeasonId,
    selectedDate
  );

  const completedCount = tasks.filter(t => {
    if (t.input_type === 'binary') return t.todayCheckin?.boolean_value;
    if (t.input_type === 'numeric') {
      const config = t.config as Record<string, unknown>;
      const threshold = (config.threshold as number) || (config.target as number) || (config.daily_cap as number) || 0;
      return (t.todayCheckin?.numeric_value || 0) >= threshold;
    }
    if (t.input_type === 'duration') {
      const config = t.config as Record<string, unknown>;
      const threshold = (config.threshold as number) || (config.target as number) || 0;
      return (t.todayCheckin?.duration_minutes || 0) >= threshold;
    }
    if (t.input_type === 'time') return !!t.todayCheckin?.time_value;
    return false;
  }).length;

  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  const goToPreviousDay = () => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() - 1);
      return newDate;
    });
  };

  const goToNextDay = () => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + 1);
      return newDate;
    });
  };

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  const categories = ['All', 'Fitness', 'Sleep', 'Learning', 'Mindfulness', 'Productivity'];
  const filteredTasks = activeCategory && activeCategory !== 'All'
    ? tasks.filter(t => t.template?.category?.toLowerCase() === activeCategory.toLowerCase())
    : tasks;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" onClick={goToPreviousDay} disabled={!isSeasonActive}>
              <ChevronLeft className="w-5 h-5" />
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="gap-2" disabled={!isSeasonActive}>
                  <Calendar className="w-4 h-4" />
                  <span className="font-display font-bold">
                    {isSeasonActive ? (isToday ? 'Today' : format(selectedDate, 'EEE, MMM d')) : 'Tasks'}
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

            <Button variant="ghost" size="icon" onClick={goToNextDay} disabled={!isSeasonActive || isToday}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {isSeasonActive && (
            <div className="bg-card rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Daily Progress</span>
                <span className="text-sm font-semibold">{completedCount}/{tasks.length} Complete</span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">
                  {isToday ? 'Keep scoring.' : format(selectedDate, 'MMMM d, yyyy')}
                </span>
                <span className="score-text text-sm text-primary">{Math.round(progress)}%</span>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="px-4 py-4">
        {isSeasonActive && (
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
        )}

        {isSeasonDraft ? (
          <div className="text-center py-12 max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-secondary/15 flex items-center justify-center mx-auto mb-4">
              <Flag className="w-8 h-8 text-secondary" />
            </div>
            <p className="text-[10px] uppercase tracking-wider text-secondary font-bold">Preseason</p>
            <h2 className="text-xl font-display font-bold mt-1 mb-2">Week 1 hasn’t kicked off</h2>
            <p className="text-muted-foreground mb-6">
              League rules are set before kickoff. Once the commissioner starts the season, your daily check-ins appear here.
            </p>
            <Button onClick={() => navigate('/league')}>Go to League</Button>
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
        ) : (
          <DailyCheckinList tasks={filteredTasks} isLoading={tasksLoading || leagueLoading} />
        )}

        {isSeasonActive && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="w-full mt-6 p-4 rounded-xl border-2 border-dashed border-muted text-muted-foreground"
          >
            <div className="flex items-center justify-center gap-2">
              <Plus className="w-5 h-5" />
              <span className="font-medium">Custom tasks coming next</span>
            </div>
          </motion.button>
        )}
      </main>
    </div>
  );
}
