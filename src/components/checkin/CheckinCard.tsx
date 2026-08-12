import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Flag, Shield, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useSubmitCheckin } from '@/hooks/useTasksWithCheckins';
import { TASK_ICONS } from '@/types/checkin';
import type { CheckinValue, TaskWithTemplate } from '@/types/checkin';
import { BinaryCheckinInput } from './BinaryCheckinInput';
import { NumericCheckinInput } from './NumericCheckinInput';
import { TimeCheckinInput } from './TimeCheckinInput';
import { DurationCheckinInput } from './DurationCheckinInput';
import { TimerCheckinInput } from './TimerCheckinInput';
import { ConfirmationButton } from './ConfirmationButton';
import { VerificationBadge } from './VerificationBadge';
import {
  buildVerifiedMetadata,
  createTimeCaptureMetadata,
  getVerificationConfig,
  getVerificationStatus,
  isCheckinVerified,
  validateCheckinValue,
} from '@/lib/verification';
import type { VerificationConfig, VerificationMetadata } from '@/lib/verification';
import { triggerConfetti } from '@/lib/confetti';
import { useToast } from '@/hooks/use-toast';

interface CheckinCardProps {
  task: TaskWithTemplate;
  date?: Date;
}

const FALLBACK_VERIFICATION: VerificationConfig = {
  method: 'manual_action',
  allowed_sources: ['manual'],
  requires_confirmation: false,
  manual_requires_flag: false,
  confirmation_action: null,
  description: '',
};

export function CheckinCard({ task, date }: CheckinCardProps) {
  const submitCheckin = useSubmitCheckin();
  const { toast } = useToast();

  const configuredVerification = getVerificationConfig(task.config as Record<string, unknown> | null);
  const verificationConfig = configuredVerification ?? FALLBACK_VERIFICATION;
  const existingMetadata = (task.todayCheckin?.metadata || {}) as VerificationMetadata;
  const verificationStatus = getVerificationStatus(task.todayCheckin?.metadata as Record<string, unknown> | null);
  const isVerified = isCheckinVerified(
    task.todayCheckin?.metadata as Record<string, unknown> | null,
    configuredVerification
  );

  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [value, setValue] = useState<CheckinValue>(() => ({
    boolean_value: task.todayCheckin?.boolean_value ?? false,
    numeric_value: task.todayCheckin?.numeric_value ?? 0,
    time_value: task.todayCheckin?.time_value ?? '',
    duration_minutes: task.todayCheckin?.duration_minutes ?? 0,
  }));

  useEffect(() => {
    setValue({
      boolean_value: task.todayCheckin?.boolean_value ?? false,
      numeric_value: task.todayCheckin?.numeric_value ?? 0,
      time_value: task.todayCheckin?.time_value ?? '',
      duration_minutes: task.todayCheckin?.duration_minutes ?? 0,
    });
    setNeedsConfirmation(false);
  }, [task.todayCheckin]);

  const icon = TASK_ICONS[task.template?.icon ?? 'activity'] ?? '📋';
  const isCompleted = !!task.todayCheckin;
  const isPending = submitCheckin.isPending;
  const config = (task.config || {}) as Record<string, unknown>;
  const minValue = task.template?.min_value ?? undefined;
  const maxValue = task.template?.max_value ?? undefined;

  const handleValueChange = useCallback((newValue: CheckinValue) => {
    setValue(prev => ({ ...prev, ...newValue }));
    if (verificationConfig.requires_confirmation && verificationConfig.method === 'manual_action') {
      setNeedsConfirmation(true);
    }
  }, [verificationConfig.requires_confirmation, verificationConfig.method]);

  const handleSubmit = async (
    checkinValue: CheckinValue,
    source: VerificationMetadata['source'] = 'manual',
    confirmed = false,
    metadataPatch?: VerificationMetadata
  ) => {
    const metadata = {
      ...buildVerifiedMetadata(source, confirmed, existingMetadata),
      ...(metadataPatch || {}),
    };

    try {
      await submitCheckin.mutateAsync({
        taskInstanceId: task.id,
        value: { ...checkinValue, metadata },
        date,
      });
      triggerConfetti();
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
      minValue,
      maxValue
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
    const actionType = verificationConfig.confirmation_action === 'going_to_bed' ? 'bedtime' : 'wake';
    const metadata = createTimeCaptureMetadata(actionType, existingMetadata);
    await handleSubmit({ time_value: timeString }, 'manual', true, metadata);
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
            value={value.boolean_value ?? false}
            onChange={handleBinaryChange}
            disabled={isPending}
          />
        );
      case 'numeric':
        return (
          <NumericCheckinInput
            value={value.numeric_value ?? 0}
            onChange={handleNumericSubmit}
            unit={task.template?.unit ?? 'count'}
            min={minValue}
            max={maxValue}
            step={typeof config.unit_size === 'number' ? config.unit_size : 1}
            disabled={isPending}
          />
        );
      case 'time':
        return (
          <TimeCheckinInput
            value={value.time_value ?? ''}
            onChange={handleTimeSubmit}
            disabled={isPending}
            label={task.task_name}
            targetTime={typeof config.target_time === 'string' ? config.target_time : undefined}
            isBefore={task.scoring_type === 'time_before'}
          />
        );
      case 'duration':
        if (verificationConfig.method === 'timer_based') {
          return (
            <TimerCheckinInput
              value={value.duration_minutes ?? 0}
              onChange={(minutes, metadata) => {
                setValue(prev => ({ ...prev, duration_minutes: minutes }));
                handleSubmit(
                  { duration_minutes: minutes },
                  'timer',
                  true,
                  metadata as VerificationMetadata
                );
              }}
              threshold={typeof config.threshold === 'number' ? config.threshold : undefined}
              minDurationSeconds={verificationConfig.min_duration_seconds}
              taskName={task.task_name}
              disabled={isPending}
            />
          );
        }
        return (
          <DurationCheckinInput
            value={value.duration_minutes ?? 0}
            onChange={handleDurationSubmit}
            disabled={isPending}
            threshold={typeof config.threshold === 'number' ? config.threshold : undefined}
          />
        );
      default:
        return null;
    }
  };

  const showTimestampButton = verificationConfig.captures_timestamp && task.input_type === 'time';
  const confirmationAction = verificationConfig.confirmation_action || 'confirm';

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
              verificationConfig={configuredVerification}
              metadata={task.todayCheckin?.metadata as VerificationMetadata | null}
              isVerified={isVerified}
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
            <ConfirmationButton
              confirmationAction={confirmationAction}
              isConfirmed={isCompleted && isVerified}
              onConfirm={handleTimestampAction}
              disabled={isPending}
              capturesTimestamp
            />
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
                      confirmationAction={confirmationAction}
                      isConfirmed={false}
                      onConfirm={handleConfirmation}
                      disabled={isPending}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {configuredVerification && verificationStatus === 'flagged' && (
            <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-pending/10 text-pending text-xs">
              <Flag className="w-3.5 h-3.5" />
              <span>Manual entry flagged for review.</span>
            </div>
          )}

          {configuredVerification && verificationStatus === 'verified' && isCompleted && (
            <div className="mt-3 flex items-center gap-2 text-primary text-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified check-in</span>
            </div>
          )}

          {configuredVerification && verificationStatus === 'unverified' && isCompleted && (
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
