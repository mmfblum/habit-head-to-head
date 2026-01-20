import { useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { Plus, ChevronLeft, ChevronRight, Calendar, Eye, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DailyCheckinList } from '@/components/checkin';
import { useTasksWithCheckins } from '@/hooks/useTasksWithCheckins';
import { useUserPrimaryLeague } from '@/hooks/useLeagueDetails';
import { useStartSeason } from '@/hooks/useSeasonActions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

export default function Tasks() {
  const { data: leagueDetails, isLoading: leagueLoading } = useUserPrimaryLeague();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const startSeason = useStartSeason();
  
  // Get the current season from the league details
  const currentSeasonId = leagueDetails?.current_season?.id;
  const seasonStatus = leagueDetails?.current_season?.status;
  const isSeasonDraft = seasonStatus === 'draft';
  const isLeagueOwner = leagueDetails?.created_by === leagueDetails?.members?.find(
    m => m.role === 'owner'
  )?.user_id;
  
  const { data: tasks = [], isLoading: tasksLoading } = useTasksWithCheckins(
    currentSeasonId,
    selectedDate
  );
  
  // Calculate daily stats
  const completedCount = tasks.filter(t => {
    if (t.input_type === 'binary') return t.todayCheckin?.boolean_value;
    if (t.input_type === 'numeric') {
      const config = t.config as Record<string, unknown>;
      const threshold = (config.threshold as number) || (config.daily_cap as number) || 0;
      return (t.todayCheckin?.numeric_value || 0) >= threshold;
    }
    if (t.input_type === 'duration') {
      const config = t.config as Record<string, unknown>;
      const threshold = (config.threshold as number) || 0;
      return (t.todayCheckin?.duration_minutes || 0) >= threshold;
    }
    if (t.input_type === 'time') return !!t.todayCheckin?.time_value;
    return false;
  }).length;
  
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;
  
  // Navigate dates
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
  
  // Filter tasks by category
  const filteredTasks = activeCategory && activeCategory !== 'All'
    ? tasks.filter(t => t.template?.category?.toLowerCase() === activeCategory.toLowerCase())
    : tasks;

  // Show demo content if no season is active or season is in draft
  const showDemo = !currentSeasonId;
  const showStartSeason = isSeasonDraft && currentSeasonId;

  const handleStartSeason = async () => {
    if (currentSeasonId) {
      await startSeason.mutateAsync(currentSeasonId);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="px-4 py-3">
          {/* Date navigation */}
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" onClick={goToPreviousDay}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <Calendar className="w-4 h-4" />
                  <span className="font-display font-bold">
                    {isToday ? 'Today' : format(selectedDate, 'EEE, MMM d')}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={goToNextDay}
              disabled={isToday}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Daily Progress */}
          <div className="bg-card rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Daily Progress</span>
              <span className="text-sm font-semibold">
                {completedCount}/{tasks.length} Complete
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">
                {isToday ? 'Keep going!' : format(selectedDate, 'MMMM d, yyyy')}
              </span>
              <span className="score-text text-sm text-primary">
                {Math.round(progress)}%
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-4">
        {/* Category filters */}
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

        {/* Task List */}
        {showStartSeason ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🚀</div>
            <h2 className="text-xl font-display font-bold mb-2">Ready to Start!</h2>
            <p className="text-muted-foreground mb-6">
              Your season is configured and ready. Start it to begin tracking tasks.
            </p>
            <Button 
              onClick={handleStartSeason} 
              disabled={startSeason.isPending}
              className="gap-2"
            >
              <Play className="w-4 h-4" />
              {startSeason.isPending ? 'Starting...' : 'Start Season'}
            </Button>
          </div>
        ) : showDemo ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-xl font-display font-bold mb-2">No Active Season</h2>
            <p className="text-muted-foreground mb-4">
              Join or create a league to start tracking your daily tasks.
            </p>
            <div className="flex flex-col gap-3 items-center">
              <Button>Join a League</Button>
              <Link to="/checkin-demo">
                <Button variant="outline" className="gap-2">
                  <Eye className="w-4 h-4" />
                  Preview Check-in UI
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <DailyCheckinList 
            tasks={filteredTasks} 
            isLoading={tasksLoading || leagueLoading} 
          />
        )}

        {/* Add Custom Task Prompt */}
        {!showDemo && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            whileTap={{ scale: 0.98 }}
            className="w-full mt-6 p-4 rounded-xl border-2 border-dashed border-muted hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Plus className="w-5 h-5" />
              <span className="font-medium">Add Custom Task</span>
            </div>
            <p className="text-xs text-muted-foreground/70 mt-1">
              1 of 2 custom task slots remaining
            </p>
          </motion.button>
        )}
      </main>
    </div>
  );
}
