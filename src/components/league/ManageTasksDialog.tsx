import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Settings2, Trash2, AlertCircle, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTaskTemplates, TaskTemplate } from '@/hooks/useTaskTemplates';
import {
  useLeagueTaskConfigs,
  useUpdateTaskConfig,
  useRemoveTaskConfig,
  useAddTaskConfig,
  LeagueTaskConfig,
} from '@/hooks/useLeagueTaskConfigs';
import { TaskConfigurationPanel, TaskConfigOverrides, getInitialConfig } from './TaskConfigurationPanel';
import { toast } from 'sonner';

interface ManageTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seasonId: string;
  nextWeekStart?: string;
}

export function ManageTasksDialog({ open, onOpenChange, seasonId, nextWeekStart }: ManageTasksDialogProps) {
  const { data: configs, isLoading: configsLoading } = useLeagueTaskConfigs(seasonId);
  const { data: templates } = useTaskTemplates();
  const updateConfig = useUpdateTaskConfig();
  const removeConfig = useRemoveTaskConfig();
  const addConfig = useAddTaskConfig();

  const [expandedConfigId, setExpandedConfigId] = useState<string | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);

  // Get enabled configs only
  const enabledConfigs = configs?.filter((c) => c.is_enabled) || [];

  // Get templates not yet added
  const addedTemplateIds = new Set(enabledConfigs.map((c) => c.task_template_id));
  const availableTemplates = templates?.filter((t) => !addedTemplateIds.has(t.id)) || [];

  const handleUpdateConfig = async (configId: string, overrides: TaskConfigOverrides) => {
    try {
      await updateConfig.mutateAsync({
        configId,
        updates: { config_overrides: overrides },
      });
      toast.success('Task configuration updated', {
        description: nextWeekStart ? `Changes take effect ${nextWeekStart}` : 'Changes saved',
      });
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const handleRemoveTask = async (configId: string, taskName: string) => {
    try {
      await removeConfig.mutateAsync(configId);
      toast.success(`${taskName} removed`, {
        description: nextWeekStart ? `Takes effect ${nextWeekStart}` : 'Task removed',
      });
    } catch (error) {
      toast.error('Failed to remove task');
    }
  };

  const handleAddTask = async (template: TaskTemplate) => {
    try {
      const initialConfig = getInitialConfig(template);
      await addConfig.mutateAsync({
        seasonId,
        taskTemplateId: template.id,
        configOverrides: initialConfig,
      });
      setShowAddTask(false);
      toast.success(`${template.name} added`, {
        description: nextWeekStart ? `Takes effect ${nextWeekStart}` : 'Task added',
      });
    } catch (error) {
      toast.error('Failed to add task');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Manage League Tasks
          </DialogTitle>
        </DialogHeader>

        {/* Notice about timing */}
        {nextWeekStart && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Clock className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-500">
              Changes take effect at the start of next week ({nextWeekStart})
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {configsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading tasks...</div>
          ) : enabledConfigs.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No tasks configured yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {enabledConfigs.map((config) => (
                <TaskConfigCard
                  key={config.id}
                  config={config}
                  isExpanded={expandedConfigId === config.id}
                  onToggleExpand={() =>
                    setExpandedConfigId(expandedConfigId === config.id ? null : config.id)
                  }
                  onUpdate={(overrides) => handleUpdateConfig(config.id, overrides)}
                  onRemove={() => handleRemoveTask(config.id, config.task_template.name)}
                  isUpdating={updateConfig.isPending}
                  isRemoving={removeConfig.isPending}
                />
              ))}
            </div>
          )}

          {/* Add Task Section */}
          <AnimatePresence>
            {showAddTask && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="border border-dashed border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Add New Task</h4>
                    <Button variant="ghost" size="icon" onClick={() => setShowAddTask(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  {availableTemplates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">All available tasks have been added.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {availableTemplates.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => handleAddTask(template)}
                          disabled={addConfig.isPending}
                          className="p-3 rounded-lg border border-border bg-card hover:bg-accent/50 text-left transition-colors disabled:opacity-50"
                        >
                          <p className="font-medium text-sm truncate">{template.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{template.category}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-2 pt-4 border-t border-border">
          {!showAddTask && availableTemplates.length > 0 && (
            <Button variant="outline" onClick={() => setShowAddTask(true)} className="flex-1">
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </Button>
          )}
          <Button variant="default" onClick={() => onOpenChange(false)} className="flex-1">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Subcomponent for individual task config cards
interface TaskConfigCardProps {
  config: LeagueTaskConfig;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (overrides: TaskConfigOverrides) => void;
  onRemove: () => void;
  isUpdating: boolean;
  isRemoving: boolean;
}

function TaskConfigCard({
  config,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onRemove,
  isUpdating,
  isRemoving,
}: TaskConfigCardProps) {
  const template = config.task_template;
  const currentOverrides = (config.config_overrides || {}) as unknown as TaskConfigOverrides;

  return (
    <motion.div layout className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{template.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs capitalize">
              {template.category}
            </Badge>
            {currentOverrides?.scoring_mode === 'binary' && (
              <Badge variant="secondary" className="text-xs">
                Yes/No
              </Badge>
            )}
            {currentOverrides?.target_time && (
              <Badge variant="secondary" className="text-xs">
                {currentOverrides.target_time}
              </Badge>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={isRemoving}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <TaskConfigurationPanel
        template={template}
        config={currentOverrides || getInitialConfig(template)}
        onChange={onUpdate}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
      />
    </motion.div>
  );
}
