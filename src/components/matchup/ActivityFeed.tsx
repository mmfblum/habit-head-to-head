import { useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ActivityEvent } from '@/hooks/useMatchupActivity';
import { TrendingUp, TrendingDown, Flame, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityFeedProps {
  events: ActivityEvent[];
  currentUserId?: string;
  onScrollPositionChange?: (isAtTop: boolean) => void;
  isLoading?: boolean;
}

function getRelativeTime(dateString: string): string {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return 'just now';
  }
}

function ActivityItem({ 
  event, 
  isCurrentUser,
  index 
}: { 
  event: ActivityEvent; 
  isCurrentUser: boolean;
  index: number;
}) {
  const isPositive = event.points_awarded > 0;
  const isStreak = Math.abs(event.points_awarded) >= 50;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ 
        type: 'spring', 
        stiffness: 500, 
        damping: 30,
        delay: index * 0.02 
      }}
      className={`
        flex items-center gap-3 p-3 rounded-lg
        ${isCurrentUser ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'}
        ${isStreak ? 'ring-1 ring-streak/30' : ''}
      `}
    >
      {/* Avatar */}
      <div className={`
        w-8 h-8 rounded-full flex items-center justify-center text-sm
        ${isCurrentUser ? 'bg-primary/20 ring-2 ring-primary/50' : 'bg-muted'}
      `}>
        {event.avatar_url ? (
          <img 
            src={event.avatar_url} 
            alt={event.display_name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <span>{event.display_name.charAt(0).toUpperCase()}</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-lg">{event.task_icon}</span>
          <span className="font-medium text-sm truncate">
            {isCurrentUser ? 'You' : event.display_name}
          </span>
          <span className="text-xs text-muted-foreground">
            completed
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground truncate">
            {event.task_name}
          </span>
          <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" />
            {getRelativeTime(event.created_at)}
          </span>
        </div>
      </div>

      {/* Points */}
      <div className={`
        flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold
        ${isPositive ? 'bg-primary/20 text-primary' : 'bg-loss/20 text-loss'}
        ${isStreak ? 'animate-pulse' : ''}
      `}>
        {isStreak && <Flame className="w-3 h-3" />}
        {isPositive ? (
          <TrendingUp className="w-3 h-3" />
        ) : (
          <TrendingDown className="w-3 h-3" />
        )}
        <span>{isPositive ? '+' : ''}{event.points_awarded}</span>
      </div>
    </motion.div>
  );
}

export function ActivityFeed({ 
  events, 
  currentUserId, 
  onScrollPositionChange,
  isLoading 
}: ActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtTopRef = useRef(true);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const atTop = target.scrollTop < 10;
    if (atTop !== isAtTopRef.current) {
      isAtTopRef.current = atTop;
      onScrollPositionChange?.(atTop);
    }
  }, [onScrollPositionChange]);

  // Auto-scroll to top when new events arrive (if user is at top)
  useEffect(() => {
    if (isAtTopRef.current && scrollRef.current && events.length > 0) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events.length]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <div className="text-3xl mb-2">⏳</div>
        <p className="text-sm">No activity yet this week</p>
        <p className="text-xs mt-1">Complete tasks to see them here!</p>
      </div>
    );
  }

  return (
    <ScrollArea 
      className="h-[300px] pr-2"
      ref={scrollRef}
      onScrollCapture={handleScroll}
    >
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {events.map((event, index) => (
            <ActivityItem
              key={event.id}
              event={event}
              isCurrentUser={event.user_id === currentUserId}
              index={index}
            />
          ))}
        </AnimatePresence>
      </div>
    </ScrollArea>
  );
}
