import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check, AlertCircle, Flag, Shield, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useSubmitCheckin } from '@/hooks/useTasksWithCheckins';
import { useAuth } from '@/hooks/useAuth';
import { TASK_ICONS, CheckinValue, TaskWithTemplate } from '@/types/checkin';
import { BinaryCheckinInput } from './BinaryCheckinInput';
import { NumericCheckinInput } from './NumericCheckinInput';
import { TimeCheckinInput } from './TimeCheckinInput';
import { DurationCheckinInput } from './DurationCheckinInput';
import { TimerCheckinInput } from './TimerCheckinInput';
import { ConfirmationButton } from './ConfirmationButton';
import { VerificationBadge } from './VerificationBadge';
import {
  getVerificationConfig,
  buildVerifiedMetadata,
  validateCheckinValue,
  getVerificationStatus,
  DEFAULT_CONFIRMATION_LABELS,
  VerificationMetadata,
} from '@/lib/verification';
import { triggerConfetti } from '@/lib/confetti';
import { useToast } from '@/hooks/use-toast';

interface CheckinCardProps {
  task: TaskWithTemplate;
  date?: Date;
}

export function CheckinCard({ task, date }: CheckinCardProps) {
  const { user } = useAuth();
  const submitCheckin = useSubmitCheckin();
  const { toast } = useToast();

  const verificationConfig = getVerificationConfig(task.config);
  const verificationStatus = getVerificationStatus(task.todayCheckin?.metadata);
  const existingMetadata = (task.todayCheckin?.metadata || {}) as VerificationMetadata;

  const [isEditing, setIsEditing] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [value, setValue] = useState<CheckinValue>(() => ({
    boolean_value: task.todayCheckin?.boolean_value ?? undefined,
    numeric_value: task.todayCheckin?.numeric_value ?? undefined,
    time_value: task.todayCheckin?.time_value ?? undefined,
    duration_minutes: task.todayCheckin?.duration_minutes ?? undefined,
  }));

  useEffect(() => {
    setValue({
      boolean_value: task.todayCheckin?.boolean_value ?? undefined,
      numeric_value: task.todayCheckin?.numeric_value ?? undefined,
      time_value: task.todayCheckin?.time_value ?? undefined,
      duration_minutes: task.todayCheckin?.duration_minutes ?? undefined,
    });
    setNeedsConfirmation(false);
  }, [task.todayCheckin]);

  const icon = TASK_ICONS[task.template?.icon ?? 'activity'] ?? '📋';
  const isCompleted = !!task.todayCheckin;
  const isPending = submitCheckin.isPending;

  const handleValueChange = useCallback((newValue: CheckinValue) => {
    setValue(prev => ({ ...prev, ...newValue }));
    if (verificationConfig.requires_confirmation && verificationConfig.method === 'manual_action') {
      setNeedsConfirmation(true);
    }
  }, [verificationConfig.requires_confirmation, verificationConfig.method]);

  const handleSubmit = async (
    checkinValue: CheckinValue,
    source: VerificationMetadata['source'] = 'manual',
    confirmed = false
  ) => {
    const metadata = buildVerifiedMetadata(source, confirmed, existingMetadata);

    try {
      await submitCheckin.mutateAsync({
        taskInstanceId: task.id,
        value: { ...checkinValue, metadata },
        date,
      });
      triggerConfetti();
      setIsEditing(false);
      setNeedsConfirmation(false);
    } catch (error) {
      console.error('Checkin error:', error);
      toast({
        title: 'Check-in failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleConfirmation = async () => {
    const validation = validateCheckinValue(
      task.input_type,
      value,
      task.min_value,
      task.max_value
    );

    if (!validation.valid) {
      toast({
        title: 'Invalid value',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    await handleSubmit(value, 'manual', true);
  };

  const handleTimestampAction = async () => {
    const now = new Date();
    const timeString = now.toTimeString().slice(0, 5);
    await handleSubmit(
      { time_value: timeString },
      'manual',
      true
    );
  };

  const handleBinaryChange = async (newValue: boolean) => {
    const checkinValue: CheckinValue = { boolean_value: newValue };
    setValue(checkinValue);

    if (!verificationConfig.requires_confirmation) {
      await handleSubmit(checkinValue, 'manual', true);
    } else {
      setNeedsConfirmation(true);
    }
  };

  const handleNumericSubmit = async (newValue: number) => {
    const checkinValue: CheckinValue = { numeric_value: newValue };
    setValue(checkinValue);
    if (!verificationConfig.requires_confirmation) {
      await handleSubmit(checkinValue, 'manual', true);
    } else {
      setNeedsConfirmation(true);
    }
  };

  const handleTimeSubmit = async (newValue: string) => {
    const checkinValue: CheckinValue = { time_value: newValue };
    setValue(checkinValue);
    if (!verificationConfig.requires_confirmation) {
      await handleSubmit(checkinValue, 'manual', true);
    } else {
      setNeedsConfirmation(true);
    }
  };

  const handleDurationSubmit = async (minutes: number) => {
    const checkinValue: CheckinValue = { duration_minutes: minutes };
    setValue(checkinValue);
    if (!verificationConfig.requires_confirmation) {
      await handleSubmit(checkinValue, 'manual', true);
    } else {
      setNeedsConfirmation(true);
    }
  };

  const renderInput = () => {
    switch (task.input_type) {
      case 'binary':
        return (
          <BinaryCheckinInput
            value={value.boolean_value ?? null}
            onChange={handleBinaryChange}
            disabled={isPending}
          />
        );
      case 'numeric':
        return (
          <NumericCheckinInput
            value={value.numeric_value}
            onChange={handleNumericSubmit}
            unit={task.template?.unit ?? 'count'}
            minValue={task.min_value}
            maxValue={task.max_value}
            disabled={isPending}
          />
        );
      case 'time':
        return (
          <TimeCheckinInput
            value={value.time_value}
            onChange={handleTimeSubmit}
            disabled={isPending}
          />
        );
      case 'duration':
        if (verificationConfig.method === 'timer_based') {
          return (
            <TimerCheckinInput
              value={value.duration_minutes}
              onChange={(minutes, source) => {
                handleValueChange({ duration_minutes: minutes });
                if (source === 'timer') {
                  handleSubmit(
                    { duration_minutes: minutes },
                    'timer',
                    true
                  );
                }
              }}
              minDurationSeconds={verificationConfig.min_duration_seconds}
              disabled={isPending}
            />
          );
        }
        return (
          <DurationCheckinInput
            value={value.duration_minutes}
            onChange={handleDurationSubmit}
            disabled={isPending}
          />
        );
      default:
        return null;
    }
  };

  const showTimestampButton = verificationConfig.captures_timestamp && task.input_type === 'time';
  const confirmationLabel = verificationConfig.confirmation_action
    ? DEFAULT_CONFIRMATION_LABELS[verificationConfig.confirmation_action] || 'Confirm'
    : 'Confirm';

  return (
    <Card className={`p-4 transition-all ${isCompleted ? 'border-primary/30 bg-primary/5' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
          isCompleted ? 'bg-primary/20' : 'bg-muted'
        }`}>
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="font-semibold text-sm truncate">{task.task_name}</h3>
            <VerificationBadge
              status={verificationStatus}
              method={verificationConfig.method}
              source={existingMetadata.source}
            />
          </div>

          {task.template?.description && (
            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
              {task.template.description}
            </p>
          )}

          {verificationConfig.auto_import_only ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <Shield className="w-4 h-4" />
              <span>This task syncs automatically from your connected data source.</span>
            </div>
          ) : showTimestampButton ? (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleTimestampAction}
              disabled={isPending}
              className="w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {confirmationLabel}
            </motion.button>
          ) : (
            <>
              {renderInput()}

              <AnimatePresence>
                {needsConfirmation && verificationConfig.requires_confirmation && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3"
                  >
                    <ConfirmationButton
                      label={confirmationLabel}
                      onConfirm={handleConfirmation}
                      disabled={isPending}
                      isLoading={isPending}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {verificationStatus === 'flagged' && (
            <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-pending/10 text-pending text-xs">
              <Flag className="w-3.5 h-3.5" />
              <span>Manual entry flagged for review.</span>
            </div>
          )}

          {verificationStatus === 'verified' && isCompleted && (
            <div className="mt-3 flex items-center gap-2 text-primary text-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified check-in</span>
            </div>
          )}

          {verificationStatus === 'unverified' && isCompleted && (
            <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-loss/10 text-loss text-xs">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Not verified — no points awarded.</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
