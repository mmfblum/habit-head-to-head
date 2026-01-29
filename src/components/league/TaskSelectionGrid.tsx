import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Activity, Brain, Moon, BookOpen, Dumbbell, Heart, Users, Sparkles } from 'lucide-react';
import { TaskTemplate } from '@/hooks/useTaskTemplates';
import { Badge } from '@/components/ui/badge';
import { TaskConfigurationPanel, TaskConfigOverrides, getInitialConfig } from './TaskConfigurationPanel';

interface TaskSelectionGridProps {
  groupedTemplates: Record<string, TaskTemplate[]>;
  selectedTasks: Map<string, TaskConfigOverrides>;
  onToggleTask: (taskId: string, template: TaskTemplate) => void;
  onUpdateConfig: (taskId: string, config: TaskConfigOverrides) => void;
  minRequired?: number;
}

const categoryIcons: Record<string, React.ElementType> = {
  fitness: Dumbbell,
  wellness: Heart,
  learning: BookOpen,
  productivity: Activity,
  sleep: Moon,
  nutrition: Sparkles,
  mindfulness: Brain,
  social: Users,
  custom: Sparkles,
};

const categoryColors: Record<string, string> = {
  fitness: 'bg-primary/20 text-primary',
  wellness: 'bg-pink-500/20 text-pink-400',
  learning: 'bg-blue-500/20 text-blue-400',
  productivity: 'bg-secondary/20 text-secondary',
  sleep: 'bg-indigo-500/20 text-indigo-400',
  nutrition: 'bg-green-500/20 text-green-400',
  mindfulness: 'bg-purple-500/20 text-purple-400',
  social: 'bg-orange-500/20 text-orange-400',
  custom: 'bg-accent/20 text-accent',
};

const scoringTypeLabels: Record<string, string> = {
  binary_yesno: 'Yes/No',
  linear_per_unit: 'Per Unit',
  threshold: 'Goal',
  time_before: 'Before Time',
  time_after: 'After Time',
  tiered: 'Tiered',
  diminishing: 'Diminishing',
};

export function TaskSelectionGrid({
  groupedTemplates,
  selectedTasks,
  onToggleTask,
  onUpdateConfig,
  minRequired = 0,
}: TaskSelectionGridProps) {
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const categories = Object.keys(groupedTemplates);
  const needsMore = minRequired > 0 && selectedTasks.size < minRequired;

  return (
    <div className="space-y-6">
      {categories.map((category) => {
        const Icon = categoryIcons[category] || Activity;
        const tasks = groupedTemplates[category];

        return (
          <div key={category}>
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`w-4 h-4 ${categoryColors[category]?.split(' ')[1] || 'text-muted-foreground'}`} />
              <h4 className="font-medium capitalize">{category}</h4>
              <span className="text-xs text-muted-foreground">({tasks.length})</span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {tasks.map((task) => {
                const isSelected = selectedTasks.has(task.id);
                const config = selectedTasks.get(task.id);
                const isExpanded = expandedTask === task.id;

                return (
                  <motion.div
                    key={task.id}
                    className={`relative p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : needsMore 
                          ? 'border-border bg-card hover:border-primary/50 animate-pulse-subtle'
                          : 'border-border bg-card hover:border-muted-foreground/30'
                    }`}
                    layout
                  >
                    <button
                      type="button"
                      onClick={() => onToggleTask(task.id, task)}
                      className="w-full text-left"
                    >
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                        >
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </motion.div>
                      )}

                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${categoryColors[category] || 'bg-muted'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate pr-6">{task.name}</p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {config?.scoring_mode === 'binary' 
                                ? 'Yes/No' 
                                : scoringTypeLabels[task.scoring_type] || task.scoring_type}
                            </Badge>
                            {config?.scoring_mode === 'detailed' && (
                              <>
                                {config?.target_time && (
                                  <Badge variant="secondary" className="text-xs">
                                    {config.target_time}
                                  </Badge>
                                )}
                                {config?.threshold && (
                                  <Badge variant="secondary" className="text-xs">
                                    {config.threshold} min
                                  </Badge>
                                )}
                                {config?.target && !config?.threshold && (
                                  <Badge variant="secondary" className="text-xs">
                                    {config.target.toLocaleString()} goal
                                  </Badge>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>

                    {isSelected && config && (
                      <TaskConfigurationPanel
                        template={task}
                        config={config}
                        onChange={(newConfig) => onUpdateConfig(task.id, newConfig)}
                        isExpanded={isExpanded}
                        onToggleExpand={() => setExpandedTask(isExpanded ? null : task.id)}
                      />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
