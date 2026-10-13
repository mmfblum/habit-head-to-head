import { Calculator, Check } from 'lucide-react';
import type { TaskTemplate } from '@/hooks/useTaskTemplates';
import type { TaskConfigOverrides } from '../TaskConfigurationPanel';
import { getConfiguredTaskName } from '@/lib/taskNaming';

interface ScoringPreviewProps {
  task: TaskTemplate;
  config: TaskConfigOverrides;
}

export function ScoringPreview({ task, config }: ScoringPreviewProps) {
  const title = getConfiguredTaskName(task, config);

  return (
    <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
      <div className="flex items-center gap-1.5 mb-2 text-[10px] text-muted-foreground uppercase tracking-wider">
        <Calculator className="w-3 h-3" />
        Daily scoring
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate">{title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Missed = 0</p>
        </div>
        <div className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary">
          <Check className="w-3 h-3" />
          +1
        </div>
      </div>
    </div>
  );
}
