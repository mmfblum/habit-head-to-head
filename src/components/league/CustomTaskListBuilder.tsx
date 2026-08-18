import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TaskTemplate } from '@/hooks/useTaskTemplates';
import {
  CustomChallengeBuilder,
  createDefaultCustomChallenge,
  type CustomChallengeValue,
} from './CustomChallengeBuilder';

export interface CustomTaskEntry {
  id: string;
  value: CustomChallengeValue;
}

interface CustomTaskListBuilderProps {
  templates: TaskTemplate[];
  values: CustomTaskEntry[];
  onChange: (values: CustomTaskEntry[]) => void;
}

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function CustomTaskListBuilder({ templates, values, onChange }: CustomTaskListBuilderProps) {
  const addCustomTask = () => {
    const value = createDefaultCustomChallenge(templates);
    if (!value) return;
    onChange([...values, { id: makeId(), value }]);
  };

  const updateEntry = (id: string, value: CustomChallengeValue | undefined) => {
    if (!value) {
      onChange(values.filter((entry) => entry.id !== id));
      return;
    }
    onChange(values.map((entry) => entry.id === id ? { ...entry, value } : entry));
  };

  return (
    <div className="space-y-3">
      {values.map((entry, index) => (
        <div key={entry.id} className="space-y-3">
          <CustomChallengeBuilder
            templates={templates}
            value={entry.value}
            onChange={(value) => updateEntry(entry.id, value)}
            idPrefix={`custom-task-${entry.id}`}
          />
          {index === values.length - 1 && (
            <Button
              type="button"
              variant="outline"
              className="w-full border-dashed border-secondary/50 text-secondary hover:bg-secondary/10"
              onClick={addCustomTask}
              disabled={templates.length === 0}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Custom Task
            </Button>
          )}
        </div>
      ))}

      {values.length === 0 && (
        <Button
          type="button"
          variant="outline"
          className="w-full h-12 border-dashed border-secondary/50 text-secondary hover:bg-secondary/10"
          onClick={addCustomTask}
          disabled={templates.length === 0}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Custom Task
        </Button>
      )}

      {templates.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">Custom task templates are not available in this database yet.</p>
      )}
    </div>
  );
}
