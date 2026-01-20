import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Flame, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { BinaryCheckinInput } from './BinaryCheckinInput';
import { NumericCheckinInput } from './NumericCheckinInput';
import { TimeCheckinInput } from './TimeCheckinInput';
import { DurationCheckinInput } from './DurationCheckinInput';
import { TimerCheckinInput } from './TimerCheckinInput';
import { VerificationBadge } from './VerificationBadge';
import { useSubmitCheckin } from '@/hooks/useTasksWithCheckins';
import { TASK_ICONS } from '@/types/checkin';
import type { TaskWithTemplate, CheckinValue } from '@/types/checkin';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getVerificationConfig, type VerificationConfig, type VerificationMetadata } from '@/lib/verification';

interface CheckinCardProps {
  task: TaskWithTemplate;
  streakDays?: number;
}

export function CheckinCard({ task, streakDays = 0 }: CheckinCardProps) {
  const { toast } = useToast();
  const submitCheckin = useSubmitCheckin();
  
  // Get config from task instance
  const config = task.config as Record<string, unknown>;
  const template = task.template;
  const verificationConfig = getVerificationConfig(config);
  const existingMetadata = task.todayCheckin?.metadata as VerificationMetadata | null;
  const isTimerBased = verificationConfig?.method === 'timer_based';
  
  // Initialize state from existing check-in or defaults
  const [binaryValue, setBinaryValue] = useState(task.todayCheckin?.boolean_value ?? false);
  const [numericValue, setNumericValue] = useState(task.todayCheckin?.numeric_value ?? 0);
  const [timeValue, setTimeValue] = useState(task.todayCheckin?.time_value ?? '');
  const [durationValue, setDurationValue] = useState(task.todayCheckin?.duration_minutes ?? 0);

  // Track if user has made changes
  const [hasChanges, setHasChanges] = useState(false);

  // Auto-save with debounce
  useEffect(() => {
    if (!hasChanges) return;

    const timeout = setTimeout(() => {
      saveCheckin();
    }, 1000);

    return () => clearTimeout(timeout);
  }, [binaryValue, numericValue, timeValue, durationValue, hasChanges]);

  const saveCheckin = async (metadata?: Record<string, unknown>) => {
    const value: CheckinValue = {};
    
    switch (task.input_type) {
      case 'binary':
        value.boolean_value = binaryValue;
        break;
      case 'numeric':
        value.numeric_value = numericValue;
        break;
      case 'time':
        value.time_value = timeValue || undefined;
        break;
      case 'duration':
        value.duration_minutes = durationValue;
        break;
    }

    // Include verification metadata if provided
    if (metadata) {
      value.metadata = metadata;
    }

    try {
      await submitCheckin.mutateAsync({
        taskInstanceId: task.id,
        value,
      });
      setHasChanges(false);
    } catch (error) {
      toast({
        title: 'Error saving check-in',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handler for timer completion with metadata
  const handleTimerComplete = async (minutes: number, metadata: Record<string, unknown>) => {
    setDurationValue(minutes);
    
    const value: CheckinValue = {
      duration_minutes: minutes,
      metadata,
    };

    try {
      await submitCheckin.mutateAsync({
        taskInstanceId: task.id,
        value,
      });
      toast({
        title: 'Session verified!',
        description: `${minutes} minutes logged with timer verification.`,
      });
    } catch (error) {
      toast({
        title: 'Error saving check-in',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Calculate progress and points based on input type
  const calculateProgress = (): { progress: number; points: number; isComplete: boolean } => {
    switch (task.scoring_type) {
      case 'binary_yesno': {
        const pts = binaryValue ? (config.points_per_completion as number || 10) : 0;
        return { progress: binaryValue ? 100 : 0, points: pts, isComplete: binaryValue };
      }
      case 'linear_per_unit': {
        const unitSize = (config.unit_size as number) || 1;
        const ptsPerUnit = (config.points_per_unit as number) || 1;
        const cap = (config.daily_cap as number) || 100;
        const val = task.input_type === 'duration' ? durationValue : numericValue;
        const pts = Math.min((val / unitSize) * ptsPerUnit, cap);
        const prog = Math.min((pts / cap) * 100, 100);
        return { progress: prog, points: pts, isComplete: pts >= cap };
      }
      case 'threshold': {
        const threshold = (config.threshold as number) || 0;
        const ptsForThreshold = (config.points_for_threshold as number) || 10;
        const val = task.input_type === 'duration' ? durationValue : numericValue;
        const met = val >= threshold;
        return { progress: met ? 100 : (val / threshold) * 100, points: met ? ptsForThreshold : 0, isComplete: met };
      }
      case 'time_before': {
        if (!timeValue) return { progress: 0, points: 0, isComplete: false };
        const targetTime = (config.target_time as string) || '23:00';
        const ptsForSuccess = (config.points_for_success as number) || 10;
        const [valH, valM] = timeValue.split(':').map(Number);
        const [tarH, tarM] = targetTime.split(':').map(Number);
        const met = valH * 60 + valM <= tarH * 60 + tarM;
        return { progress: met ? 100 : 50, points: met ? ptsForSuccess : 0, isComplete: met };
      }
      case 'time_after': {
        if (!timeValue) return { progress: 0, points: 0, isComplete: false };
        const targetTime = (config.target_time as string) || '06:00';
        const ptsForSuccess = (config.points_for_success as number) || 10;
        const [valH, valM] = timeValue.split(':').map(Number);
        const [tarH, tarM] = targetTime.split(':').map(Number);
        const met = valH * 60 + valM >= tarH * 60 + tarM;
        return { progress: met ? 100 : 50, points: met ? ptsForSuccess : 0, isComplete: met };
      }
      case 'tiered': {
        const tiers = (config.tiers as Array<{ min: number; max: number | null; points: number }>) || [];
        const val = numericValue;
        let pts = 0;
        for (const tier of tiers) {
          if (val >= tier.min && (tier.max === null || val < tier.max)) {
            pts = tier.points;
            break;
          }
        }
        return { progress: pts > 0 ? 100 : (val > 0 ? 50 : 0), points: pts, isComplete: pts > 0 };
      }
      default:
        return { progress: 0, points: 0, isComplete: false };
    }
  };

  const { progress, points, isComplete } = calculateProgress();
  const icon = template?.icon ? TASK_ICONS[template.icon] || '📊' : '📊';
  const unitLabel = template?.unit === 'boolean' ? '' : template?.unit || '';

  const handleValueChange = (setter: React.Dispatch<React.SetStateAction<any>>) => (value: any) => {
    setter(value);
    setHasChanges(true);
  };

  const renderInput = () => {
    switch (task.input_type) {
      case 'binary':
        return (
          <BinaryCheckinInput
            value={binaryValue}
            onChange={handleValueChange(setBinaryValue)}
            disabled={submitCheckin.isPending}
          />
        );
      case 'numeric':
        return (
          <NumericCheckinInput
            value={numericValue}
            onChange={handleValueChange(setNumericValue)}
            disabled={submitCheckin.isPending}
            min={template?.min_value ?? 0}
            max={template?.max_value ?? 100000}
            step={(config.unit_size as number) || 1}
            unit={unitLabel}
          />
        );
      case 'time':
        return (
          <TimeCheckinInput
            value={timeValue}
            onChange={handleValueChange(setTimeValue)}
            disabled={submitCheckin.isPending}
            label={task.task_name}
            targetTime={config.target_time as string}
            isBefore={task.scoring_type === 'time_before'}
          />
        );
      case 'duration':
        // Use TimerCheckinInput for timer-based verification (meditation, journaling)
        if (isTimerBased) {
          return (
            <TimerCheckinInput
              value={durationValue}
              onChange={handleTimerComplete}
              disabled={submitCheckin.isPending}
              threshold={config.threshold as number}
              minDurationSeconds={verificationConfig?.min_duration_seconds || 60}
              taskName={task.task_name}
            />
          );
        }
        // Fall back to standard duration input
        return (
          <DurationCheckinInput
            value={durationValue}
            onChange={handleValueChange(setDurationValue)}
            disabled={submitCheckin.isPending}
            threshold={config.threshold as number}
          />
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'task-card relative',
        isComplete && 'ring-1 ring-primary/50'
      )}
    >
      {/* Saving indicator */}
      {submitCheckin.isPending && (
        <div className="absolute top-2 right-2">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}

      <div className="flex items-start gap-3 mb-4">
        {/* Icon & Streak */}
        <div className="relative">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center text-2xl',
            isComplete ? 'bg-primary/20' : 'bg-muted'
          )}>
            {icon}
          </div>
          {streakDays > 0 && (
            <div className="absolute -top-1 -right-1 streak-badge px-1.5 py-0.5 text-[10px]">
              <Flame className="w-3 h-3" />
              {streakDays}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">{task.task_name}</h3>
            {isComplete && (
              <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-primary-foreground" />
              </div>
            )}
            <VerificationBadge
              verificationConfig={verificationConfig}
              metadata={existingMetadata}
              isVerified={!!existingMetadata?.confirmed}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {template?.description || 'Complete this task to earn points'}
          </p>
        </div>

        {/* Points */}
        <div className="text-right">
          <span className={cn(
            'score-text text-lg',
            isComplete ? 'text-primary' : 'text-muted-foreground'
          )}>
            +{Math.round(points)}
          </span>
          <span className="text-xs text-muted-foreground block">pts</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <Progress 
          value={progress} 
          className="h-1.5"
        />
      </div>

      {/* Input component based on type */}
      {renderInput()}
    </motion.div>
  );
}
