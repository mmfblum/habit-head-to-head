import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Copy, Share2, Trophy, Users, Zap, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useCreateLeague, useCreateSeason, useConfigureSeasonTasks } from '@/hooks/useLeagues';
import { useStartSeason } from '@/hooks/useSeasonActions';
import { useTaskTemplatesByCategory, TaskTemplate } from '@/hooks/useTaskTemplates';
import { toast } from 'sonner';
import { TaskSelectionGrid } from './TaskSelectionGrid';
import { TaskConfigOverrides, getInitialConfig } from './TaskConfigurationPanel';
import { DifficultyPresets, DifficultyLevel, applyDifficultyToConfig, difficultyConfigs } from './DifficultyPresets';

type WizardStep = 'details' | 'tasks' | 'invite';

const RECOMMENDED_TASK_NAMES = [
  'Steps',
  'Workout',
  'Reading',
  'Journaling',
  'Wake Time',
];

interface LeagueFormData {
  name: string;
  description: string;
  weeksCount: number;
}

export function CreateLeagueWizard({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>('details');
  const [formData, setFormData] = useState<LeagueFormData>({
    name: '',
    description: '',
    weeksCount: 4,
  });
  // Map of taskId -> config overrides
  const [taskConfigs, setTaskConfigs] = useState<Map<string, TaskConfigOverrides>>(new Map());
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(null);
  const [createdLeague, setCreatedLeague] = useState<{ id: string; invite_code: string | null } | null>(null);
  const [createdSeason, setCreatedSeason] = useState<{ id: string } | null>(null);

  const { groupedTemplates, isLoading: tasksLoading } = useTaskTemplatesByCategory();
  const createLeague = useCreateLeague();
  const createSeason = useCreateSeason();
  const configureTasks = useConfigureSeasonTasks();
  const startSeason = useStartSeason();

  const handleDetailsSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a league name');
      return;
    }

    try {
      const league = await createLeague.mutateAsync({
        name: formData.name,
        description: formData.description,
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
    } catch (error) {
      toast.error('Failed to create league');
    }
  };

  const handleToggleTask = (taskId: string, template: TaskTemplate) => {
    setTaskConfigs((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(taskId)) {
        newMap.delete(taskId);
      } else {
        // Apply difficulty preset if one is selected
        const baseConfig = getInitialConfig(template);
        if (difficulty) {
          const difficultyOverrides = applyDifficultyToConfig(
            template.scoring_type,
            template.default_config as Record<string, any>,
            difficulty
          );
          newMap.set(taskId, { ...baseConfig, ...difficultyOverrides });
        } else {
          newMap.set(taskId, baseConfig);
        }
      }
      return newMap;
    });
  };

  const handleUpdateConfig = (taskId: string, config: TaskConfigOverrides) => {
    setTaskConfigs((prev) => {
      const newMap = new Map(prev);
      newMap.set(taskId, config);
      return newMap;
    });
  };

  // When difficulty changes, update all selected tasks
  const handleDifficultyChange = (level: DifficultyLevel) => {
    setDifficulty(level);
    
    if (!level || !groupedTemplates) return;
    
    // Get all templates as a flat array
    const allTemplates = Object.values(groupedTemplates).flat();
    
    setTaskConfigs((prev) => {
      const newMap = new Map(prev);
      
      // Update each selected task with the new difficulty
      prev.forEach((config, taskId) => {
        const template = allTemplates.find((t) => t.id === taskId);
        if (template) {
          const baseConfig = getInitialConfig(template);
          const difficultyOverrides = applyDifficultyToConfig(
            template.scoring_type,
            template.default_config as Record<string, any>,
            level
          );
          newMap.set(taskId, { ...baseConfig, ...difficultyOverrides });
        }
      });
      
      return newMap;
    });
    
    toast.success(`Applied ${difficultyConfigs[level].label} preset to all tasks`);
  };

  const handleTasksSubmit = async () => {
    if (taskConfigs.size < 3) {
      toast.error('Please select at least 3 tasks');
      return;
    }

    if (!createdSeason) return;

    try {
      const taskConfigArray = Array.from(taskConfigs.entries()).map(([taskId, config], index) => ({
        task_template_id: taskId,
        display_order: index,
        config_overrides: {
          scoring_mode: config.scoring_mode,
          ...(config.target_time && { target_time: config.target_time }),
          ...(config.threshold && { threshold: config.threshold }),
          ...(config.target && { target: config.target }),
          ...(config.points && { points: config.points }),
          ...(config.binary_points && { binary_points: config.binary_points }),
        },
      }));

      await configureTasks.mutateAsync({
        seasonId: createdSeason.id,
        taskConfigs: taskConfigArray,
      });

      // Activate the season to trigger task instance generation
      await startSeason.mutateAsync(createdSeason.id);

      setStep('invite');
      toast.success('Tasks configured and season started!');
    } catch (error) {
      toast.error('Failed to configure tasks');
    }
  };

  const copyInviteCode = () => {
    if (createdLeague?.invite_code) {
      navigator.clipboard.writeText(createdLeague.invite_code);
      toast.success('Invite code copied!');
    }
  };

  const shareInvite = async () => {
    if (createdLeague?.invite_code && navigator.share) {
      try {
        await navigator.share({
          title: `Join ${formData.name} on ProGrind`,
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
    { id: 'details', label: 'Details', icon: Trophy },
    { id: 'tasks', label: 'Tasks', icon: Zap },
    { id: 'invite', label: 'Invite', icon: Users },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === step);

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-auto">
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur border-b border-border z-10">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={step === 'details' ? onClose : () => setStep(steps[currentStepIndex - 1].id as WizardStep)}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {step === 'details' ? 'Cancel' : 'Back'}
              </Button>
              <h2 className="font-display font-bold text-lg">Create League</h2>
              <div className="w-16" />
            </div>

            {/* Progress */}
            <div className="flex items-center justify-center gap-2">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      i <= currentStepIndex
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {i < currentStepIndex ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={`w-12 h-0.5 mx-1 ${
                        i < currentStepIndex ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">
          <AnimatePresence mode="wait">
            {step === 'details' && (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <Trophy className="w-12 h-12 text-primary mx-auto mb-3" />
                  <h3 className="text-xl font-display font-bold">Name Your League</h3>
                  <p className="text-muted-foreground">Create a league for you and your friends to compete</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">League Name</Label>
                    <Input
                      id="name"
                      placeholder="The Productivity Pros"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="A league for serious grinders..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="months">Season Length</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3, 4, 5, 6].map((months) => {
                        const weeks = months * 4;
                        return (
                          <Button
                            key={months}
                            type="button"
                            variant={formData.weeksCount === weeks ? 'default' : 'outline'}
                            className="h-auto py-2 flex-col"
                            onClick={() => setFormData({ ...formData, weeksCount: weeks })}
                          >
                            <span>{months} month{months > 1 ? 's' : ''}</span>
                            <span className="text-xs opacity-70">({weeks} weeks)</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleDetailsSubmit}
                  className="w-full"
                  size="lg"
                  disabled={createLeague.isPending || createSeason.isPending}
                >
                  {createLeague.isPending || createSeason.isPending ? 'Creating...' : 'Continue'}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>
            )}

            {step === 'tasks' && (
              <motion.div
                key="tasks"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-4">
                  <Zap className="w-12 h-12 text-secondary mx-auto mb-3" />
                  <h3 className="text-xl font-display font-bold">Select & Configure Tasks</h3>
                  <p className="text-muted-foreground">
                    Choose at least 3 tasks for your league members to track daily
                  </p>
                </div>

                {/* Selection Counter */}
                <div className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${
                  taskConfigs.size >= 3 
                    ? 'bg-primary/10 border-primary/30' 
                    : 'bg-muted/50 border-border'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Selected: {taskConfigs.size}</span>
                    {taskConfigs.size >= 3 && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {taskConfigs.size < 3 
                      ? `Need ${3 - taskConfigs.size} more` 
                      : '✓ Ready to continue'}
                  </span>
                </div>

                {/* Quick Select Option */}
                <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-8 h-8 text-primary" />
                        <div>
                          <p className="font-medium">Quick Start</p>
                          <p className="text-sm text-muted-foreground">Select 5 recommended tasks instantly</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (!groupedTemplates) return;
                          const allTemplates = Object.values(groupedTemplates).flat();
                          const recommended = allTemplates.filter(t => 
                            RECOMMENDED_TASK_NAMES.some(name => t.name.includes(name))
                          );
                          
                          const newConfigs = new Map(taskConfigs);
                          recommended.forEach(template => {
                            if (!newConfigs.has(template.id)) {
                              const baseConfig = getInitialConfig(template);
                              if (difficulty) {
                                const difficultyOverrides = applyDifficultyToConfig(
                                  template.scoring_type,
                                  template.default_config as Record<string, any>,
                                  difficulty
                                );
                                newConfigs.set(template.id, { ...baseConfig, ...difficultyOverrides });
                              } else {
                                newConfigs.set(template.id, baseConfig);
                              }
                            }
                          });
                          setTaskConfigs(newConfigs);
                          toast.success(`Selected ${recommended.length} recommended tasks!`);
                        }}
                        className="shrink-0"
                      >
                        Use Recommended
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <DifficultyPresets selected={difficulty} onSelect={handleDifficultyChange} />

                {tasksLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading tasks...</div>
                ) : (
                  <TaskSelectionGrid
                    groupedTemplates={groupedTemplates || {}}
                    selectedTasks={taskConfigs}
                    onToggleTask={handleToggleTask}
                    onUpdateConfig={handleUpdateConfig}
                    minRequired={3}
                  />
                )}

                <div className="sticky bottom-4 pt-4 bg-gradient-to-t from-background via-background to-transparent">
                  <Button
                    onClick={handleTasksSubmit}
                    className="w-full"
                    size="lg"
                    disabled={taskConfigs.size < 3 || configureTasks.isPending || startSeason.isPending}
                  >
                    {configureTasks.isPending || startSeason.isPending ? 'Setting up...' : `Continue with ${taskConfigs.size} tasks`}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                  {taskConfigs.size < 3 && (
                    <p className="text-center text-sm text-muted-foreground mt-2">
                      Select at least 3 tasks to continue
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {step === 'invite' && (
              <motion.div
                key="invite"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-display font-bold">League Created!</h3>
                  <p className="text-muted-foreground">Share this code with friends to invite them</p>
                </div>

                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-2">Invite Code</p>
                      <p className="text-3xl font-display font-bold tracking-wider text-primary uppercase">
                        {createdLeague?.invite_code || '...'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={copyInviteCode}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Code
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={shareInvite}
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  <Users className="w-4 h-4 inline mr-1" />
                  Need at least 4 members to start the season
                </div>

                <Button onClick={finishSetup} className="w-full" size="lg">
                  Go to League
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
