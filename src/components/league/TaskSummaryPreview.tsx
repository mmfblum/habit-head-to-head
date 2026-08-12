import { Check, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TaskTemplate } from '@/hooks/useTaskTemplates';
import { TaskConfigOverrides } from './TaskConfigurationPanel';
import { getConfiguredTaskName } from '@/lib/taskNaming';

interface TaskSummaryPreviewProps {
  templates: TaskTemplate[];
  configs: Map<string, TaskConfigOverrides>;
}

export function TaskSummaryPreview({ templates, configs }: TaskSummaryPreviewProps) {
  if (configs.size === 0) return null;

  const selectedTemplates = templates.filter(t => configs.has(t.id));

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Check className="w-4 h-4 text-primary" />
          Task Summary ({configs.size} selected)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {selectedTemplates.map((template) => {
          const config = configs.get(template.id);
          if (!config) return null;

          const displayName = getConfiguredTaskName(template, config);
          const isBinary = config.scoring_mode === 'binary';

          return (
            <div
              key={template.id}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-background/50 border border-border/50"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                <span className="text-sm font-medium truncate">{displayName}</span>
              </div>

              <Badge variant="outline" className="text-xs shrink-0">
                {isBinary ? (
                  <><Check className="w-3 h-3 mr-1" />Yes/No</>
                ) : (
                  <><Target className="w-3 h-3 mr-1" />Detailed</>
                )}
              </Badge>
            </div>
          );
        })}

        <p className="pt-2 mt-2 border-t border-border/50 text-xs text-muted-foreground">
          Points are calculated from each task’s configured scoring rule, not a flat per-task value.
        </p>
      </CardContent>
    </Card>
  );
}
