import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles, Zap, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTaskTemplatesByCategory, TaskTemplate } from '@/hooks/useTaskTemplates';
import { useConfigureSeasonTasks } from '@/hooks/useLeagues';
import { useStartSeason } from '@/hooks/useSeasonActions';
import { TaskSelectionGrid } from './TaskSelectionGrid';
import { TaskConfigOverrides, getInitialConfig } from './TaskConfigurationPanel';
import { toast } from 'sonner';

const RECOMMENDED_TASK_NAMES = [
  'Steps',
  'Workout',
  'Reading',
  'Journaling',
  'Wake Time',
];

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

  const handleQuickSelect = () => {
    if (!groupedTemplates) return;
    const allTemplates = Object.values(groupedTemplates).flat();
    const recommended = allTemplates.filter(t => 
      RECOMMENDED_TASK_NAMES.some(name => t.name.includes(name))
    );
    
    const newConfigs = new Map(taskConfigs);
    recommended.forEach(template => {
      if (!newConfigs.has(template.id)) {
        newConfigs.set(template.id, getInitialConfig(template));
      }
    });
    setTaskConfigs(newConfigs);
    toast.success(`Selected ${recommended.length} recommended tasks!`);
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
                : '✓ Ready to start'}
            </span>
          </div>

          {/* Quick Select */}
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
                  onClick={handleQuickSelect}
                  className="shrink-0"
                >
                  Use Recommended
                </Button>
              </div>
            </CardContent>
          </Card>

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
              minRequired={3}
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
