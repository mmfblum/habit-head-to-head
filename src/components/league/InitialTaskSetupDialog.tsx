import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTaskTemplatesByCategory, TaskTemplate } from '@/hooks/useTaskTemplates';
import { useConfigureSeasonTasks } from '@/hooks/useLeagues';
import { useStartSeason } from '@/hooks/useSeasonActions';
import { TaskSelectionGrid } from './TaskSelectionGrid';
import { TaskConfigOverrides, getInitialConfig } from './TaskConfigurationPanel';
import { DifficultyQuickStart, QuickStartDifficulty, DIFFICULTY_PRESETS } from './DifficultyQuickStart';
import { TaskSummaryPreview } from './TaskSummaryPreview';
import { toast } from 'sonner';

const RECOMMENDED_TASK_NAMES = [
  'Steps',
  'Workout',
  'Reading',
  'Journaling',
  'Wake Time',
];

const POINTS_PER_TASK = 10;

interface InitialTaskSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seasonId: string;
  onComplete?: () => void;
}

export function InitialTaskSetupDialog({
  open,
  onOpenChange,
  seasonId,
  onComplete,
}: InitialTaskSetupDialogProps) {
  const [taskConfigs, setTaskConfigs] = useState<Map<string, TaskConfigOverrides>>(new Map());

  const { groupedTemplates, isLoading: templatesLoading } = useTaskTemplatesByCategory();
  const configureTasks = useConfigureSeasonTasks();
  const startSeason = useStartSeason();

  const handleToggleTask = (taskId: string, template: TaskTemplate) => {
    setTaskConfigs((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(taskId)) {
        newMap.delete(taskId);
      } else {
        newMap.set(taskId, getInitialConfig(template));
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

  const handleClearAll = () => {
    setTaskConfigs(new Map());
    setTaskConfigs(new Map());
  };

  const handleQuickStart = (difficulty: QuickStartDifficulty) => {
    if (!groupedTemplates) return;
    
    const allTemplates = Object.values(groupedTemplates).flat();
    const preset = DIFFICULTY_PRESETS[difficulty];
    const newConfigs = new Map<string, TaskConfigOverrides>();
    
    RECOMMENDED_TASK_NAMES.forEach((taskName) => {
      const template = allTemplates.find(t => t.name.includes(taskName));
      if (template) {
        const baseConfig = getInitialConfig(template);
        const presetValues = preset.values[taskName as keyof typeof preset.values];
        newConfigs.set(template.id, { ...baseConfig, ...presetValues });
      }
    });
    
    setTaskConfigs(newConfigs);
    toast.success(`Selected ${newConfigs.size} tasks with ${preset.label} settings!`);
  };

  const handleStartSeason = async () => {
    if (taskConfigs.size < 3) {
      toast.error('Please select at least 3 tasks');
      return;
    }

    try {
      // Configure tasks
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
          ...(config.max_tiers && { max_tiers: config.max_tiers }),
        },
      }));

      await configureTasks.mutateAsync({
        seasonId,
        taskConfigs: taskConfigArray,
      });

      // Start the season
      await startSeason.mutateAsync(seasonId);

      toast.success('Season started! Time to grind.');
      onOpenChange(false);
      onComplete?.();
    } catch (error) {
      toast.error('Failed to start season. Please try again.');
    }
  };

  const isProcessing = configureTasks.isPending || startSeason.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-secondary" />
            Configure Your League Tasks
          </DialogTitle>
          <DialogDescription>
            Select at least 3 tasks for your league members to track daily. You can customize settings after selection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
                : `${taskConfigs.size * POINTS_PER_TASK} pts total`}
            </span>
          </div>

          {/* Difficulty Quick Start */}
          <DifficultyQuickStart onSelect={handleQuickStart} />

          {/* Task Grid */}
          {templatesLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading tasks...
            </div>
          ) : (
            <TaskSelectionGrid
              groupedTemplates={groupedTemplates || {}}
              selectedTasks={taskConfigs}
              onToggleTask={handleToggleTask}
              onUpdateConfig={handleUpdateConfig}
              onClearAll={handleClearAll}
              minRequired={3}
            />
          )}

          {/* Task Summary Preview */}
          {taskConfigs.size >= 3 && groupedTemplates && (
            <TaskSummaryPreview
              templates={Object.values(groupedTemplates).flat()}
              configs={taskConfigs}
              totalPoints={taskConfigs.size * POINTS_PER_TASK}
            />
          )}
        </div>

        {/* Action Button */}
        <div className="sticky bottom-0 pt-4 bg-background border-t">
          <Button
            onClick={handleStartSeason}
            className="w-full"
            size="lg"
            disabled={taskConfigs.size < 3 || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting Season...
              </>
            ) : (
              <>
                Configure & Start Season
                <Zap className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
          {taskConfigs.size < 3 && (
            <p className="text-center text-sm text-muted-foreground mt-2">
              Select at least 3 tasks to start the season
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
