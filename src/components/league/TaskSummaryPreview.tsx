import { Check, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { TaskTemplate } from '@/hooks/useTaskTemplates';
import type { TaskConfigOverrides } from './TaskConfigurationPanel';
import type { CustomTaskEntry } from './CustomTaskListBuilder';
import { getConfiguredTaskName, getTaskScoringSentence } from '@/lib/taskNaming';

interface TaskSummaryPreviewProps {
  templates: TaskTemplate[];
  configs: Map<string, TaskConfigOverrides>;
  customTasks?: CustomTaskEntry[];
}

export function TaskSummaryPreview({ templates, configs, customTasks = [] }: TaskSummaryPreviewProps) {
  if (configs.size === 0 && customTasks.length === 0) return null;

  const rows = [
    ...templates
      .filter((template) => configs.has(template.id))
      .map((template) => ({
        key: template.id,
        template,
        config: configs.get(template.id)!,
      })),
    ...customTasks.flatMap((entry) => {
      const template = templates.find((candidate) => candidate.id === entry.value.templateId);
      return template ? [{ key: entry.id, template, config: entry.value.config }] : [];
    }),
  ];

  return (
    <Card className="border-primary/20 bg-primary/5 overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          The Daily Scorecard
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          This is what will actually appear on the daily card.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map(({ key, template, config }) => {
          const displayName = getConfiguredTaskName(template, config);
          const isGoalScoring = config.scoring_mode === 'binary';

          return (
            <div key={key} className="py-3 px-3 rounded-xl bg-background/60 border border-border/50">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-6 h-6 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-semibold truncate">{displayName}</span>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {isGoalScoring ? 'Goal' : 'Performance'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2 pl-8">
                {getTaskScoringSentence(template, config)}
              </p>
            </div>
          );
        })}

        <div className="pt-3 mt-2 border-t border-border/50 flex items-start gap-2">
          <Target className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Goal scoring keeps tasks equally weighted; Performance scoring lets extra effort add more.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
