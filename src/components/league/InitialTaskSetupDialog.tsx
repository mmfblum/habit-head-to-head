import { useEffect, useMemo, useState } from 'react';
import { Check, Zap, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTaskTemplatesByCategory, type TaskTemplate } from '@/hooks/useTaskTemplates';
import { useConfigureSeasonTasks } from '@/hooks/useLeagues';
import { TaskSelectionGrid } from './TaskSelectionGrid';
import { type TaskConfigOverrides, getInitialConfig } from './TaskConfigurationPanel';
import { DifficultyQuickStart, type StarterPackId, STARTER_PACKS } from './DifficultyQuickStart';
import { TaskSummaryPreview } from './TaskSummaryPreview';
import { CustomChallengeBuilder, type CustomChallengeValue } from './CustomChallengeBuilder';
import { toast } from 'sonner';

const CUSTOM_CHALLENGE_PREFIX = 'Custom Challenge —';

interface InitialTaskSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seasonId: string;
  onComplete?: () => void;
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

export function InitialTaskSetupDialog({ open, onOpenChange, seasonId, onComplete }: InitialTaskSetupDialogProps) {
  const [taskConfigs, setTaskConfigs] = useState<Map<string, TaskConfigOverrides>>(new Map());
  const [defaultPackLoaded, setDefaultPackLoaded] = useState(false);
  const { groupedTemplates, isLoading: templatesLoading } = useTaskTemplatesByCategory();
  const configureTasks = useConfigureSeasonTasks();

  const allTemplates = useMemo(() => Object.values(groupedTemplates || {}).flat(), [groupedTemplates]);
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
      if (visible.length) result[category] = visible;
    });
    return result;
  }, [groupedTemplates, customTemplateIds]);
  const customChallengeValue = useMemo<CustomChallengeValue | undefined>(() => {
    const entry = Array.from(taskConfigs.entries()).find(([taskId]) => customTemplateIds.has(taskId));
    return entry ? { templateId: entry[0], config: entry[1] } : undefined;
  }, [taskConfigs, customTemplateIds]);

  const buildStarterPack = (packId: StarterPackId) => {
    const pack = STARTER_PACKS[packId];
    const next = new Map<string, TaskConfigOverrides>();

    pack.tasks.forEach((taskName) => {
      const template = allTemplates.find(
        (candidate) => !customTemplateIds.has(candidate.id) && candidate.name === taskName
      );
      if (!template) return;
      const baseConfig = getInitialConfig(template);
      const overrides = pack.overrides?.[taskName] || {};
      next.set(template.id, { ...baseConfig, ...overrides, scoring_mode: 'binary' });
    });

    return next;
  };

  useEffect(() => {
    if (!open || defaultPackLoaded || templatesLoading || allTemplates.length === 0 || taskConfigs.size > 0) return;
    const classic = buildStarterPack('classic');
    if (classic.size >= 3) {
      setTaskConfigs(classic);
      setDefaultPackLoaded(true);
    }
  }, [open, defaultPackLoaded, templatesLoading, allTemplates, taskConfigs.size]);

  const handleToggleTask = (taskId: string, template: TaskTemplate) => {
    setTaskConfigs((previous) => {
      const next = new Map(previous);
      if (next.has(taskId)) next.delete(taskId);
      else next.set(taskId, getInitialConfig(template));
      return next;
    });
  };

  const handleUpdateConfig = (taskId: string, config: TaskConfigOverrides) => {
    setTaskConfigs((previous) => new Map(previous).set(taskId, config));
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

  const handleQuickStart = (packId: StarterPackId) => {
    if (!groupedTemplates) return;
    const next = buildStarterPack(packId);
    if (customChallengeValue) next.set(customChallengeValue.templateId, customChallengeValue.config);
    setTaskConfigs(next);
    setDefaultPackLoaded(true);
    toast.success(`${STARTER_PACKS[packId].label} loaded with ${next.size} scoring chances.`);
  };

  const handleSaveRules = async () => {
    if (taskConfigs.size < 3) {
      toast.error('Choose at least 3 daily scoring tasks');
      return;
    }
    if (customChallengeValue && !customChallengeValue.config.custom_name?.trim()) {
      toast.error('Give your custom challenge a name');
      return;
    }

    try {
      const taskConfigArray = Array.from(taskConfigs.entries()).map(([taskId, config], index) => ({
        task_template_id: taskId,
        display_order: index,
        config_overrides: serializeConfig(config),
      }));

      await configureTasks.mutateAsync({ seasonId, taskConfigs: taskConfigArray });
      toast.success('League rules saved.');
      onOpenChange(false);
      onComplete?.();
    } catch {
      toast.error('Failed to save league rules. Please try again.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-secondary" />
            Build the Daily Game
          </DialogTitle>
          <DialogDescription>
            Classic Zrizin is loaded for you. Keep it, choose another starter pack, or personalize anything below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${
            taskConfigs.size >= 3 ? 'bg-primary/10 border-primary/30' : 'bg-muted/50 border-border'
          }`}>
            <div className="flex items-center gap-2">
              <span className="font-medium">Scoring chances: {taskConfigs.size}</span>
              {taskConfigs.size >= 3 && <Check className="w-4 h-4 text-primary" />}
            </div>
            <span className="text-sm text-muted-foreground">
              {taskConfigs.size < 3 ? `Pick ${3 - taskConfigs.size} more` : 'Game ready'}
            </span>
          </div>

          <DifficultyQuickStart onSelect={handleQuickStart} />

          <CustomChallengeBuilder
            templates={customChallengeTemplates}
            value={customChallengeValue}
            onChange={handleCustomChallenge}
          />

          {templatesLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading tasks...
            </div>
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

          {taskConfigs.size >= 3 && (
            <TaskSummaryPreview templates={allTemplates} configs={taskConfigs} />
          )}
        </div>

        <div className="sticky bottom-0 pt-4 bg-background border-t">
          <Button onClick={handleSaveRules} className="w-full" size="lg" disabled={taskConfigs.size < 3 || configureTasks.isPending}>
            {configureTasks.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving Game...</>
            ) : (
              <>Use This Scorecard<Check className="w-4 h-4 ml-2" /></>
            )}
          </Button>
          {taskConfigs.size < 3 && <p className="text-center text-sm text-muted-foreground mt-2">Choose at least 3 scoring tasks to continue</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
