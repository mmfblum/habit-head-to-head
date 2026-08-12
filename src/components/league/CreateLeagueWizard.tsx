import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Copy, Gamepad2, ListOrdered, Share2, Swords, Trophy, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateLeague, useCreateSeason, useConfigureSeasonTasks } from '@/hooks/useLeagues';
import type { LeagueGameFormat } from '@/hooks/useLeagues';
import { useTaskTemplatesByCategory, type TaskTemplate } from '@/hooks/useTaskTemplates';
import { toast } from 'sonner';
import { TaskSelectionGrid } from './TaskSelectionGrid';
import { type TaskConfigOverrides, getInitialConfig } from './TaskConfigurationPanel';
import { DifficultyQuickStart, type QuickStartDifficulty, DIFFICULTY_PRESETS } from './DifficultyQuickStart';
import { TaskSummaryPreview } from './TaskSummaryPreview';
import { CustomChallengeBuilder, type CustomChallengeValue } from './CustomChallengeBuilder';

type WizardStep = 'details' | 'tasks' | 'invite';

const RECOMMENDED_TASK_NAMES = ['Steps', 'Workout', 'Reading', 'Journaling', 'Wake Time'];
const CUSTOM_CHALLENGE_PREFIX = 'Custom Challenge —';

interface LeagueFormData {
  name: string;
  description: string;
  weeksCount: number;
  gameFormat: LeagueGameFormat;
}

function serializeConfig(config: TaskConfigOverrides) {
  return {
    scoring_mode: config.scoring_mode,
    ...(config.target_time && { target_time: config.target_time }),
    ...(config.threshold !== undefined && { threshold: config.threshold }),
    ...(config.target !== undefined && { target: config.target }),
    ...(config.points !== undefined && { points: config.points }),
    ...(config.binary_points !== undefined && { binary_points: config.binary_points }),
    ...(config.max_tiers !== undefined && { max_tiers: config.max_tiers }),
    ...(config.daily_limit_minutes !== undefined && { daily_limit_minutes: config.daily_limit_minutes }),
    ...(config.custom_name?.trim() && { custom_name: config.custom_name.trim() }),
    ...(config.custom_description?.trim() && { custom_description: config.custom_description.trim() }),
  };
}

export function CreateLeagueWizard({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>('details');
  const [formData, setFormData] = useState<LeagueFormData>({
    name: '',
    description: '',
    weeksCount: 4,
    gameFormat: 'head_to_head',
  });
  const [taskConfigs, setTaskConfigs] = useState<Map<string, TaskConfigOverrides>>(new Map());
  const [createdLeague, setCreatedLeague] = useState<{ id: string; invite_code: string | null } | null>(null);
  const [createdSeason, setCreatedSeason] = useState<{ id: string } | null>(null);

  const createLeague = useCreateLeague();
  const createSeason = useCreateSeason();
  const configureTasks = useConfigureSeasonTasks();
  const { groupedTemplates, isLoading: tasksLoading } = useTaskTemplatesByCategory();

  const allTemplates = useMemo(
    () => Object.values(groupedTemplates || {}).flat(),
    [groupedTemplates]
  );

  const customChallengeTemplates = useMemo(
    () => allTemplates.filter((template) => template.name.startsWith(CUSTOM_CHALLENGE_PREFIX)),
    [allTemplates]
  );

  const customTemplateIds = useMemo(
    () => new Set(customChallengeTemplates.map((template) => template.id)),
    [customChallengeTemplates]
  );

  const standardGroupedTemplates = useMemo(() => {
    const result: Record<string, TaskTemplate[]> = {};
    Object.entries(groupedTemplates || {}).forEach(([category, templates]) => {
      const visible = templates.filter((template) => !customTemplateIds.has(template.id));
      if (visible.length > 0) result[category] = visible;
    });
    return result;
  }, [groupedTemplates, customTemplateIds]);

  const customChallengeValue = useMemo<CustomChallengeValue | undefined>(() => {
    const entry = Array.from(taskConfigs.entries()).find(([taskId]) => customTemplateIds.has(taskId));
    return entry ? { templateId: entry[0], config: entry[1] } : undefined;
  }, [taskConfigs, customTemplateIds]);

  const handleDetailsSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a league name');
      return;
    }

    try {
      const league = await createLeague.mutateAsync({
        name: formData.name,
        description: formData.description,
        gameFormat: formData.gameFormat,
      });

      const season = await createSeason.mutateAsync({
        leagueId: league.id,
        name: 'Season 1',
        weeksCount: formData.weeksCount,
        startDate: new Date(),
      });

      setCreatedLeague(league);
      setCreatedSeason(season);
      setStep('tasks');
    } catch {
      toast.error('Failed to create league');
    }
  };

  const handleToggleTask = (taskId: string, template: TaskTemplate) => {
    setTaskConfigs((previous) => {
      const next = new Map(previous);
      if (next.has(taskId)) next.delete(taskId);
      else next.set(taskId, getInitialConfig(template));
      return next;
    });
  };

  const handleUpdateConfig = (taskId: string, config: TaskConfigOverrides) => {
    setTaskConfigs((previous) => {
      const next = new Map(previous);
      next.set(taskId, config);
      return next;
    });
  };

  const handleCustomChallenge = (value: CustomChallengeValue | undefined) => {
    setTaskConfigs((previous) => {
      const next = new Map(previous);
      customTemplateIds.forEach((templateId) => next.delete(templateId));
      if (value) next.set(value.templateId, value.config);
      return next;
    });
  };

  const handleClearAll = () => setTaskConfigs(new Map());

  const handleQuickStart = (difficulty: QuickStartDifficulty) => {
    if (!groupedTemplates) return;

    const preset = DIFFICULTY_PRESETS[difficulty];
    const next = new Map<string, TaskConfigOverrides>();

    RECOMMENDED_TASK_NAMES.forEach((taskName) => {
      const template = allTemplates.find(
        (candidate) => !customTemplateIds.has(candidate.id) && candidate.name.includes(taskName)
      );
      if (!template) return;

      const baseConfig = getInitialConfig(template);
      const presetValues = preset.values[taskName as keyof typeof preset.values];
      next.set(template.id, { ...baseConfig, ...presetValues });
    });

    if (customChallengeValue) {
      next.set(customChallengeValue.templateId, customChallengeValue.config);
    }

    setTaskConfigs(next);
    toast.success(`Game ready: ${next.size} daily scoring opportunities.`);
  };

  const handleTasksSubmit = async () => {
    if (taskConfigs.size < 3) {
      toast.error('Choose at least 3 daily scoring tasks');
      return;
    }

    if (customChallengeValue && !customChallengeValue.config.custom_name?.trim()) {
      toast.error('Give your custom challenge a name');
      return;
    }

    if (!createdSeason) return;

    try {
      const taskConfigArray = Array.from(taskConfigs.entries()).map(([taskId, config], index) => ({
        task_template_id: taskId,
        display_order: index,
        config_overrides: serializeConfig(config),
      }));

      await configureTasks.mutateAsync({
        seasonId: createdSeason.id,
        taskConfigs: taskConfigArray,
      });

      setStep('invite');
      toast.success('Your game is set. Now bring in the competition.');
    } catch {
      toast.error('Failed to save league rules');
    }
  };

  const copyInviteCode = () => {
    if (!createdLeague?.invite_code) return;
    navigator.clipboard.writeText(createdLeague.invite_code);
    toast.success('Invite code copied!');
  };

  const shareInvite = async () => {
    if (createdLeague?.invite_code && navigator.share) {
      try {
        await navigator.share({
          title: `Join ${formData.name} on Zrizin`,
          text: `Use invite code: ${createdLeague.invite_code}`,
          url: window.location.origin,
        });
      } catch {
        copyInviteCode();
      }
    } else {
      copyInviteCode();
    }
  };

  const finishSetup = () => {
    onClose();
    navigate('/league');
  };

  const steps = [
    { id: 'details', label: 'League', icon: Trophy },
    { id: 'tasks', label: 'Game', icon: Gamepad2 },
    { id: 'invite', label: 'Friends', icon: Users },
  ];
  const currentStepIndex = steps.findIndex((item) => item.id === step);
  const isLeaderboard = formData.gameFormat === 'leaderboard';

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-auto">
      <div className="min-h-screen flex flex-col">
        <div className="sticky top-0 bg-background/95 backdrop-blur border-b border-border z-10">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              {step === 'details' ? (
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              ) : (
                <div className="w-16" />
              )}
              <h2 className="font-display font-bold text-lg">Create League</h2>
              <div className="w-16" />
            </div>

            <div className="flex items-center justify-center gap-2">
              {steps.map((item, index) => (
                <div key={item.id} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    index <= currentStepIndex ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {index < currentStepIndex ? <Check className="w-4 h-4" /> : index + 1}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-12 h-0.5 mx-1 ${index < currentStepIndex ? 'bg-primary' : 'bg-muted'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">
          <AnimatePresence mode="wait">
            {step === 'details' && (
              <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="text-center mb-8">
                  <Trophy className="w-12 h-12 text-primary mx-auto mb-3" />
                  <h3 className="text-xl font-display font-bold">Build Your League</h3>
                  <p className="text-muted-foreground">Choose how your group competes, then build the daily scorecard.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">League Name</Label>
                    <Input id="name" placeholder="The Morning League" value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">League motto (optional)</Label>
                    <Textarea id="description" placeholder="No excuses. Win the week." value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} rows={3} />
                  </div>

                  <div className="space-y-2">
                    <Label>How should your league compete?</Label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, gameFormat: 'head_to_head' })}
                        className={`rounded-2xl border-2 p-4 text-left transition-all ${
                          formData.gameFormat === 'head_to_head'
                            ? 'border-primary bg-primary/10 shadow-sm'
                            : 'border-border bg-card hover:border-primary/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="w-10 h-10 rounded-xl bg-secondary/15 flex items-center justify-center">
                            <Swords className="w-5 h-5 text-secondary" />
                          </div>
                          {formData.gameFormat === 'head_to_head' && <Check className="w-5 h-5 text-primary" />}
                        </div>
                        <p className="font-display font-bold mt-3">Head-to-Head</p>
                        <p className="text-xs text-muted-foreground mt-1">Face one opponent each week. Win the matchup and build a W-L record.</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, gameFormat: 'leaderboard' })}
                        className={`rounded-2xl border-2 p-4 text-left transition-all ${
                          formData.gameFormat === 'leaderboard'
                            ? 'border-primary bg-primary/10 shadow-sm'
                            : 'border-border bg-card hover:border-primary/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="w-10 h-10 rounded-xl bg-pending/15 flex items-center justify-center">
                            <ListOrdered className="w-5 h-5 text-pending" />
                          </div>
                          {formData.gameFormat === 'leaderboard' && <Check className="w-5 h-5 text-primary" />}
                        </div>
                        <p className="font-display font-bold mt-3">Leaderboard</p>
                        <p className="text-xs text-muted-foreground mt-1">Everyone plays the same scorecard. Score the most points and finish #1.</p>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Season Length</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3, 4, 5, 6].map((months) => {
                        const weeks = months * 4;
                        return (
                          <Button key={months} type="button" variant={formData.weeksCount === weeks ? 'default' : 'outline'} className="h-auto py-2 flex-col" onClick={() => setFormData({ ...formData, weeksCount: weeks })}>
                            <span>{months} month{months > 1 ? 's' : ''}</span>
                            <span className="text-xs opacity-70">{weeks} {isLeaderboard ? 'scoring weeks' : 'matchups'}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <Button onClick={handleDetailsSubmit} className="w-full" size="lg" disabled={createLeague.isPending || createSeason.isPending}>
                  {createLeague.isPending || createSeason.isPending ? 'Creating...' : 'Build the Daily Game'}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>
            )}

            {step === 'tasks' && (
              <motion.div key="tasks" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="text-center mb-4">
                  <Zap className="w-12 h-12 text-secondary mx-auto mb-3" />
                  <h3 className="text-xl font-display font-bold">What Scores Each Day?</h3>
                  <p className="text-muted-foreground">Pick the things your league wants to compete on. Players will see these as their daily scoring chances.</p>
                </div>

                <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
                  <p className="font-semibold text-sm">Scoring is simple by default</p>
                  <div className="grid grid-cols-3 gap-3 mt-3 text-center">
                    <div>
                      <div className="w-7 h-7 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center mx-auto">1</div>
                      <p className="text-xs mt-2">Set a daily goal</p>
                    </div>
                    <div>
                      <div className="w-7 h-7 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center mx-auto">2</div>
                      <p className="text-xs mt-2">Hit it for +3</p>
                    </div>
                    <div>
                      <div className="w-7 h-7 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center mx-auto">3</div>
                      <p className="text-xs mt-2">{isLeaderboard ? 'Climb the board' : 'Weekly total wins'}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">Want extra steps or minutes to matter? Open “Goal & scoring” on any task and switch it to Performance.</p>
                </div>

                <div className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${
                  taskConfigs.size >= 3 ? 'bg-primary/10 border-primary/30' : 'bg-muted/50 border-border'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Daily scoring chances: {taskConfigs.size}</span>
                    {taskConfigs.size >= 3 && <Check className="w-4 h-4 text-primary" />}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {taskConfigs.size < 3 ? `Pick ${3 - taskConfigs.size} more` : 'Game ready'}
                  </span>
                </div>

                <DifficultyQuickStart onSelect={handleQuickStart} />

                <section className="space-y-3">
                  <div>
                    <h4 className="font-display font-semibold">Your league’s signature challenge</h4>
                    <p className="text-xs text-muted-foreground mt-1">Optional, but this is where a league starts to feel like your league.</p>
                  </div>
                  <CustomChallengeBuilder
                    templates={customChallengeTemplates}
                    value={customChallengeValue}
                    onChange={handleCustomChallenge}
                  />
                </section>

                <section className="space-y-3">
                  <div>
                    <h4 className="font-display font-semibold">Choose the core tasks</h4>
                    <p className="text-xs text-muted-foreground mt-1">Tap a task to add it. Open “Goal & scoring” only if you want to change the default.</p>
                  </div>
                  {tasksLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading tasks...</div>
                  ) : (
                    <TaskSelectionGrid
                      groupedTemplates={standardGroupedTemplates}
                      selectedTasks={taskConfigs}
                      onToggleTask={handleToggleTask}
                      onUpdateConfig={handleUpdateConfig}
                      onClearAll={handleClearAll}
                      minRequired={3}
                    />
                  )}
                </section>

                {taskConfigs.size >= 3 && (
                  <TaskSummaryPreview templates={allTemplates} configs={taskConfigs} />
                )}

                <div className="sticky bottom-4 pt-4 bg-gradient-to-t from-background via-background to-transparent">
                  <Button onClick={handleTasksSubmit} className="w-full" size="lg" disabled={taskConfigs.size < 3 || configureTasks.isPending}>
                    {configureTasks.isPending ? 'Saving game...' : 'Lock Rules & Invite Friends'}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                  {taskConfigs.size < 3 && <p className="text-center text-sm text-muted-foreground mt-2">Choose at least 3 scoring tasks to continue</p>}
                </div>
              </motion.div>
            )}

            {step === 'invite' && (
              <motion.div key="invite" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-display font-bold">Bring in the Competition</h3>
                  <p className="text-muted-foreground">Your rules are set. Invite friends, then start Week 1 from the League tab.</p>
                </div>

                {createdLeague?.invite_code && (
                  <div className="bg-card border border-border rounded-xl p-6 text-center">
                    <p className="text-sm text-muted-foreground mb-2">Invite Code</p>
                    <p className="text-3xl font-mono font-bold tracking-wider text-primary">{createdLeague.invite_code}</p>
                    <div className="flex gap-2 mt-4 justify-center">
                      <Button variant="outline" onClick={copyInviteCode}><Copy className="w-4 h-4 mr-2" />Copy</Button>
                      <Button variant="outline" onClick={shareInvite}><Share2 className="w-4 h-4 mr-2" />Share</Button>
                    </div>
                  </div>
                )}

                <div className="rounded-xl bg-muted/50 p-4 text-sm">
                  <p className="font-semibold">What happens next?</p>
                  <p className="text-muted-foreground mt-1">
                    {isLeaderboard
                      ? 'Once at least one other player joins, start the season. Every player scores the same tasks and the leaderboard resets for a fresh race each Sunday.'
                      : 'Once at least one opponent joins, the commissioner schedules Week 1. Matchups kick off Sunday and run through Saturday.'}
                  </p>
                </div>

                <Button onClick={finishSetup} className="w-full" size="lg">
                  Go to League
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
