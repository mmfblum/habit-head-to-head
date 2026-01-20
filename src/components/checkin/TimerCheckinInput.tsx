import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, Check, Timer, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { createTimerMetadata, createConfirmedMetadata } from '@/lib/verification';

interface TimerCheckinInputProps {
  value: number; // duration in minutes from check-in
  onChange: (minutes: number, metadata: Record<string, unknown>) => void;
  disabled?: boolean;
  threshold?: number; // minimum duration in minutes for goal
  minDurationSeconds?: number; // minimum duration in seconds for verification
  taskName?: string;
  onComplete?: () => void;
}

type TimerState = 'idle' | 'running' | 'paused' | 'completed';

/**
 * TimerCheckinInput - Built-in timer for meditation and journaling
 * 
 * This component provides a verified timer that:
 * 1. Records start time when user begins
 * 2. Tracks actual elapsed time
 * 3. Creates verified timer metadata when completed
 * 4. Prevents gaming by requiring minimum duration
 * 
 * The timer automatically creates verification metadata including:
 * - timer_started_at: When the session began
 * - duration_seconds: Actual time elapsed
 * - timer_completed_at: When the user finished
 * - source: 'timer' (verified by app)
 */
export function TimerCheckinInput({
  value,
  onChange,
  disabled = false,
  threshold = 5,
  minDurationSeconds = 60,
  taskName = 'Session',
  onComplete,
}: TimerCheckinInputProps) {
  const [timerState, setTimerState] = useState<TimerState>(value > 0 ? 'completed' : 'idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(value * 60);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  // Preset durations in minutes
  const presets = [5, 10, 15, 20, 30];
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

  // Calculate progress towards threshold
  const thresholdSeconds = threshold * 60;
  const progress = Math.min((elapsedSeconds / thresholdSeconds) * 100, 100);
  const meetsThreshold = elapsedSeconds >= thresholdSeconds;
  const meetsMinDuration = elapsedSeconds >= minDurationSeconds;

  // Format time display
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Start timer
  const startTimer = useCallback(() => {
    if (disabled) return;
    
    const now = new Date().toISOString();
    setStartedAt(now);
    startTimeRef.current = Date.now() - pausedTimeRef.current;
    setTimerState('running');
    
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);
  }, [disabled]);

  // Pause timer
  const pauseTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    pausedTimeRef.current = Date.now() - startTimeRef.current;
    setTimerState('paused');
  }, []);

  // Resume timer
  const resumeTimer = useCallback(() => {
    if (disabled) return;
    
    startTimeRef.current = Date.now() - pausedTimeRef.current;
    setTimerState('running');
    
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);
  }, [disabled]);

  // Complete timer - creates verified metadata
  const completeTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setTimerState('completed');
    
    // Calculate final minutes (rounded up to nearest minute)
    const finalMinutes = Math.ceil(elapsedSeconds / 60);
    
    // Create verified timer metadata
    const metadata = startedAt 
      ? createTimerMetadata(elapsedSeconds, startedAt)
      : createConfirmedMetadata();
    
    onChange(finalMinutes, metadata);
    onComplete?.();
  }, [elapsedSeconds, startedAt, onChange, onComplete]);

  // Reset timer
  const resetTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setElapsedSeconds(0);
    setStartedAt(null);
    setSelectedPreset(null);
    pausedTimeRef.current = 0;
    setTimerState('idle');
  }, []);

  // Quick start with preset
  const startWithPreset = useCallback((minutes: number) => {
    setSelectedPreset(minutes);
    setElapsedSeconds(0);
    pausedTimeRef.current = 0;
    startTimer();
  }, [startTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Toggle play/pause
  const toggleTimer = () => {
    if (timerState === 'idle') {
      startTimer();
    } else if (timerState === 'running') {
      pauseTimer();
    } else if (timerState === 'paused') {
      resumeTimer();
    }
  };

  return (
    <div className="space-y-4">
      {/* Timer Display */}
      <div className="relative">
        <motion.div
          className={cn(
            'relative rounded-2xl p-6 text-center overflow-hidden',
            'bg-gradient-to-br from-muted/50 to-muted',
            timerState === 'running' && 'from-primary/10 to-primary/5',
            timerState === 'completed' && 'from-primary/20 to-primary/10'
          )}
          animate={timerState === 'running' ? { 
            boxShadow: ['0 0 20px hsl(var(--primary) / 0.1)', '0 0 40px hsl(var(--primary) / 0.2)', '0 0 20px hsl(var(--primary) / 0.1)']
          } : {}}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          {/* Animated background pulse when running */}
          <AnimatePresence>
            {timerState === 'running' && (
              <motion.div
                className="absolute inset-0 bg-primary/5"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1.2, opacity: [0, 0.3, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            )}
          </AnimatePresence>

          {/* Time Display */}
          <motion.div
            key={elapsedSeconds}
            initial={timerState === 'running' ? { scale: 1.02 } : false}
            animate={{ scale: 1 }}
            className="relative z-10"
          >
            <div className={cn(
              'text-5xl font-mono font-bold tracking-wider',
              timerState === 'completed' && 'text-primary'
            )}>
              {formatTime(elapsedSeconds)}
            </div>
            
            {/* Status indicator */}
            <div className="flex items-center justify-center gap-2 mt-2">
              {timerState === 'running' && (
                <motion.div
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                />
              )}
              <span className="text-sm text-muted-foreground">
                {timerState === 'idle' && 'Ready to start'}
                {timerState === 'running' && `${taskName} in progress...`}
                {timerState === 'paused' && 'Paused'}
                {timerState === 'completed' && (
                  <span className="flex items-center gap-1 text-primary">
                    <Sparkles className="w-4 h-4" />
                    Session complete!
                  </span>
                )}
              </span>
            </div>
          </motion.div>

          {/* Selected preset indicator */}
          {selectedPreset && timerState !== 'completed' && (
            <div className="absolute top-3 right-3 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded-full">
              Goal: {selectedPreset}m
            </div>
          )}
        </motion.div>

        {/* Progress towards threshold */}
        {threshold && timerState !== 'idle' && (
          <div className="mt-3 space-y-1">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0m</span>
              <span className={cn(meetsThreshold && 'text-primary font-medium')}>
                {meetsThreshold ? '✓ Goal reached!' : `Goal: ${threshold}m`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {timerState !== 'completed' ? (
          <>
            {/* Reset button */}
            {timerState !== 'idle' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Button
                  variant="outline"
                  size="icon"
                  className="w-12 h-12 rounded-full"
                  onClick={resetTimer}
                  disabled={disabled}
                >
                  <RotateCcw className="w-5 h-5" />
                </Button>
              </motion.div>
            )}

            {/* Play/Pause button */}
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button
                size="lg"
                className={cn(
                  'w-16 h-16 rounded-full',
                  timerState === 'running' 
                    ? 'bg-muted hover:bg-muted/80 text-foreground' 
                    : 'bg-primary hover:bg-primary/90'
                )}
                onClick={toggleTimer}
                disabled={disabled}
              >
                {timerState === 'running' ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-1" />
                )}
              </Button>
            </motion.div>

            {/* Complete button */}
            {(timerState === 'running' || timerState === 'paused') && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Button
                  variant={meetsMinDuration ? 'default' : 'outline'}
                  size="icon"
                  className={cn(
                    'w-12 h-12 rounded-full',
                    meetsMinDuration && 'bg-primary'
                  )}
                  onClick={completeTimer}
                  disabled={disabled || !meetsMinDuration}
                  title={meetsMinDuration ? 'Complete session' : `Wait ${Math.ceil((minDurationSeconds - elapsedSeconds) / 60)}m more`}
                >
                  <Check className="w-5 h-5" />
                </Button>
              </motion.div>
            )}
          </>
        ) : (
          /* Completed state - show reset option */
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-primary">
              <Timer className="w-5 h-5" />
              <span className="font-medium">{Math.ceil(elapsedSeconds / 60)} minutes logged</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetTimer}
              disabled={disabled}
            >
              Start New
            </Button>
          </div>
        )}
      </div>

      {/* Quick start presets - only show when idle */}
      {timerState === 'idle' && (
        <div className="space-y-2">
          <p className="text-xs text-center text-muted-foreground">Quick start:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {presets.map((minutes) => (
              <motion.button
                key={minutes}
                whileTap={{ scale: 0.95 }}
                onClick={() => startWithPreset(minutes)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-all',
                  'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary',
                  selectedPreset === minutes && 'bg-primary text-primary-foreground'
                )}
                disabled={disabled}
              >
                {minutes}m
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Verification hint */}
      {timerState === 'idle' && (
        <p className="text-xs text-center text-muted-foreground">
          <Timer className="w-3 h-3 inline mr-1" />
          Timer-verified sessions earn full points
        </p>
      )}
    </div>
  );
}
