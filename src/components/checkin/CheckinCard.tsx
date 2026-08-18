import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ChevronDown, ChevronUp, Flag, Shield, ShieldCheck, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { ScoreCelebration } from './ScoreCelebration';
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
import { getManualGoalCheckinValue } from '@/lib/taskProgress';
import { useToast } from '@/hooks/use-toast';

interface CheckinCardProps {
  task: TaskWithTemplate;
  date?: Date;
  powerPlayAvailable?: boolean;
  powerPlayArmed?: boolean;
  powerPlayPending?: boolean;
  onArmPowerPlay?: () => void;
}

interface CelebrationState {
  points: number;
  powerPlay: boolean;
  isUpdate: boolean;
}

const FALLBACK_VERIFICATION: VerificationConfig = {
  method: 'manual_action',
  allowed_sources: ['manual'],
  requires_confirmation: false,
  manual_requires_flag: false,
  confirmation_action: null,
  description: '',
};

function numberFrom(record: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

export function CheckinCard({
  task,
  date,
  powerPlayAvailable = false,
  powerPlayArmed = false,
  powerPlayPending = false,
  onArmPowerPlay,
}: CheckinCardProps) {
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
  const [showExactEntry, setShowExactEntry] = useState(false);
  const [confirmPowerPlay, setConfirmPowerPlay] = useState(false);
  const [celebration, setCelebration] = useState<CelebrationState | null>(null);
  const [value, setValue] = useState<CheckinValue>(() => ({
    boolean_value: task.todayCheckin?.boolean_value ?? undefined,
    numeric_value: task.todayCheckin?.numeric_value ?? 0,
    time_value: task.todayCheckin?.time_value ?? '',
    duration_minutes: task.todayCheckin?.duration_minutes ?? 0,
  }));

  useEffect(() => {
    setValue({
      boolean_value: task.todayCheckin?.boolean_value ?? undefined,
      numeric_value: task.todayCheckin?.numeric_value ?? 0,
      time_value: task.todayCheckin?.time_value ?? '',
      duration_minutes: task.todayCheckin?.duration_minutes ?? 0,
    });
    setNeedsConfirmation(false);
  }, [task.todayCheckin]);

  useEffect(() => {
    if (powerPlayArmed) setConfirmPowerPlay(false);
  }, [powerPlayArmed]);

  const dismissCelebration = useCallback(() => setCelebration(null), []);
  const icon = TASK_ICONS[task.template?.icon ?? 'activity'] ?? '📋';
  const isCompleted = !!task.todayCheckin;
  const isPending = submitCheckin.isPending;
  const config = (task.config || {}) as Record<string, unknown>;
  const templateDefaults = (task.template?.default_config || {}) as Record<string, unknown>;
  const minValue = task.template?.min_value ?? undefined;
  const maxValue = task.template?.max_value ?? undefined;
  const customDescription = typeof config.custom_description === 'string' ? config.custom_description : undefined;
  const description = customDescription || task.template?.description;
  const scoringMode = typeof config.scoring_mode === 'string' ? config.scoring_mode : 'detailed';
  const goalPoints = numberFrom(config, 'binary_points', 'points') ?? 3;
  const goalTarget = numberFrom(config, 'daily_limit_minutes', 'target', 'threshold')
    ?? numberFrom(templateDefaults, 'daily_limit_minutes', 'target', 'threshold');
  const canQuickScoreGoal = scoringMode === 'binary'
    && (task.input_type === 'numeric' || task.input_type === 'duration')
    && verificationConfig.method !== 'timer_based'
    && goalTarget !== undefined;

  const handleValueChange = useCallback((newValue: CheckinValue) => {
    setValue((previous) => ({ ...previous, ...newValue }));
    setNeedsConfirmation(true);
  }, []);

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
      const wasExisting = !!task.todayCheckin;
      const result = await submitCheckin.mutateAsync({
        taskInstanceId: task.id,
        value: { ...checkinValue, metadata },
        date,
      });
      const points = Number(result.scoringEvent?.points_awarded ?? 0);
      const powerPlay = result.scoringEvent?.powerup_applied != null;

      setNeedsConfirmation(false);

      if (points > 0) {
        triggerConfetti();
        setCelebration({ points, powerPlay, isUpdate: wasExisting });
      } else {
        toast({ title: 'Result logged', description: 'No points were awarded for this result.' });
      }
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
    const validation = validateCheckinValue(task.input_type, value, minValue, maxValue);
    if (!validation.valid) {
      toast({ title: 'Invalid value', description: validation.error, variant: 'destructive' });
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
    setValue((previous) => ({ ...previous, ...checkinValue }));
    if (!verificationConfig.requires_confirmation) await handleSubmit(checkinValue, 'manual', true);
    else setNeedsConfirmation(true);
  };

  const handleQuickGoal = async (hitGoal: boolean) => {
    const checkinValue = getManualGoalCheckinValue(task, hitGoal);
    if (!checkinValue) return;
    setValue((previous) => ({ ...previous, ...checkinValue }));
    await handleSubmit(checkinValue, 'manual', true, { manual_fallback: true });
  };

  const handleNumericChange = (newValue: number) => handleValueChange({ numeric_value: newValue });
  const handleTimeChange = (newValue: string) => handleValueChange({ time_value: newValue });
  const handleDurationChange = (minutes: number) => handleValueChange({ duration_minutes: minutes });

  const renderInput = () => {
    switch (task.input_type) {
      case 'binary':
        return <BinaryCheckinInput value={value.boolean_value} onChange={handleBinaryChange} disabled={isPending} />;
      case 'numeric':
        return <NumericCheckinInput value={value.numeric_value ?? 0} onChange={handleNumericChange} unit={task.template?.unit ?? 'count'} min={minValue} max={maxValue} step={typeof config.unit_size === 'number' ? config.unit_size : 1} disabled={isPending} />;
      case 'time':
        return <TimeCheckinInput value={value.time_value ?? ''} onChange={handleTimeChange} disabled={isPending} label={task.task_name} targetTime={typeof config.target_time === 'string' ? config.target_time : undefined} isBefore={task.scoring_type === 'time_before'} />;
      case 'duration':
        if (verificationConfig.method === 'timer_based') {
          return <TimerCheckinInput value={value.duration_minutes ?? 0} onChange={(minutes, timerMetadata) => { setValue((previous) => ({ ...previous, duration_minutes: minutes })); handleSubmit({ duration_minutes: minutes }, 'timer', true, timerMetadata as VerificationMetadata); }} threshold={typeof config.threshold === 'number' ? config.threshold : undefined} minDurationSeconds={verificationConfig.min_duration_seconds} taskName={task.task_name} disabled={isPending} />;
        }
        return <DurationCheckinInput value={value.duration_minutes ?? 0} onChange={handleDurationChange} disabled={isPending} threshold={typeof config.threshold === 'number' ? config.threshold : undefined} />;
      default:
        return null;
    }
  };

  const showTimestampButton = verificationConfig.captures_timestamp && task.input_type === 'time';
  const needsScoreButton = needsConfirmation && task.input_type !== 'binary' && !showTimestampButton;
  const needsBinaryConfirmation = needsConfirmation && task.input_type === 'binary' && verificationConfig.requires_confirmation;
  const confirmationAction = needsScoreButton ? 'log_score' : verificationConfig.confirmation_action || 'confirm';

  return (
    <>
      <Card className={`p-4 transition-all ${isCompleted ? 'border-primary/30 bg-primary/5' : ''} ${powerPlayArmed ? 'ring-1 ring-secondary/50 border-secondary/50' : ''}`}>
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${isCompleted ? 'bg-primary/20' : 'bg-muted'}`}>{icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="font-semibold text-sm truncate">{task.task_name}</h3>
              <VerificationBadge verificationConfig={configuredVerification} metadata={task.todayCheckin?.metadata as VerificationMetadata | null} isVerified={isVerified} />
            </div>
            {description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{description}</p>}

            {powerPlayArmed && !isCompleted && (
              <div className="mb-3 rounded-lg border border-secondary/40 bg-secondary/10 px-3 py-2 flex items-center gap-2">
                <Zap className="w-4 h-4 text-secondary fill-secondary" />
                <div className="flex-1"><p className="text-xs font-bold text-secondary">2× POWER PLAY ARMED</p><p className="text-[11px] text-muted-foreground">Your next positive score on this task is doubled.</p></div>
              </div>
            )}

            {powerPlayAvailable && !isCompleted && onArmPowerPlay && !confirmPowerPlay && (
              <button type="button" onClick={() => setConfirmPowerPlay(true)} className="mb-3 w-full rounded-lg border border-secondary/25 bg-secondary/5 px-3 py-2 flex items-center justify-between text-left hover:bg-secondary/10 transition-colors">
                <span className="flex items-center gap-2"><Zap className="w-4 h-4 text-secondary" /><span className="text-xs font-semibold">Use 2× on {task.task_name}</span></span>
                <span className="text-[10px] text-muted-foreground">1/week</span>
              </button>
            )}

            <AnimatePresence initial={false}>
              {confirmPowerPlay && powerPlayAvailable && onArmPowerPlay && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="mb-3 rounded-xl border border-secondary/35 bg-secondary/10 p-3">
                    <p className="text-sm font-semibold flex items-center gap-2"><Zap className="w-4 h-4 text-secondary" />Double this task?</p>
                    <p className="text-xs text-muted-foreground mt-1">Your next positive {task.task_name} score is worth 2×. You only get one Power Play this week.</p>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <Button variant="outline" size="sm" onClick={() => setConfirmPowerPlay(false)} disabled={powerPlayPending}>Cancel</Button>
                      <Button size="sm" onClick={() => { onArmPowerPlay(); setConfirmPowerPlay(false); }} disabled={powerPlayPending} className="gap-1"><Zap className="w-3.5 h-3.5" />{powerPlayPending ? 'Arming...' : 'Arm 2×'}</Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {verificationConfig.auto_import_only ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground"><Shield className="w-4 h-4" /><span>This score syncs from your connected device source.</span></div>
            ) : showTimestampButton ? (
              <ConfirmationButton confirmationAction={verificationConfig.confirmation_action || 'confirm'} isConfirmed={isCompleted && isVerified} onConfirm={handleTimestampAction} disabled={isPending} capturesTimestamp />
            ) : canQuickScoreGoal ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2"><Button variant="outline" className="h-11" onClick={() => handleQuickGoal(false)} disabled={isPending}>Missed</Button><Button className="h-11 font-bold" onClick={() => handleQuickGoal(true)} disabled={isPending}>{powerPlayArmed ? `Done +${goalPoints * 2} ⚡` : `Done +${goalPoints}`}</Button></div>
                {task.template?.supports_integration && <p className="text-[11px] text-center text-muted-foreground">Manual check-off works now. Exact or device data can replace it later.</p>}
                <button type="button" onClick={() => setShowExactEntry((current) => !current)} className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">{showExactEntry ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}{showExactEntry ? 'Hide exact amount' : 'Log exact amount'}</button>
                <AnimatePresence initial={false}>{showExactEntry && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden"><div className="pt-1">{renderInput()}{needsScoreButton && <div className="mt-3"><ConfirmationButton confirmationAction="log_score" isConfirmed={false} onConfirm={handleConfirmation} disabled={isPending} /></div>}</div></motion.div>}</AnimatePresence>
              </div>
            ) : (
              <>{renderInput()}<AnimatePresence>{(needsScoreButton || needsBinaryConfirmation) && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3"><ConfirmationButton confirmationAction={confirmationAction} isConfirmed={false} onConfirm={handleConfirmation} disabled={isPending} /></motion.div>}</AnimatePresence></>
            )}

            {configuredVerification && verificationStatus === 'flagged' && <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-pending/10 text-pending text-xs"><Flag className="w-3.5 h-3.5" /><span>Manual entry flagged for review.</span></div>}
            {configuredVerification && verificationStatus === 'verified' && isCompleted && <div className="mt-3 flex items-center gap-2 text-primary text-xs"><ShieldCheck className="w-3.5 h-3.5" /><span>Verified score</span></div>}
            {configuredVerification && verificationStatus === 'unverified' && isCompleted && <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-loss/10 text-loss text-xs"><AlertCircle className="w-3.5 h-3.5" /><span>Not verified — no points awarded.</span></div>}
          </div>
        </div>
      </Card>

      <AnimatePresence>{celebration && <ScoreCelebration points={celebration.points} taskName={task.task_name} powerPlay={celebration.powerPlay} isUpdate={celebration.isUpdate} onDone={dismissCelebration} />}</AnimatePresence>
    </>
  );
}
