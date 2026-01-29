import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TaskTemplate } from '@/hooks/useTaskTemplates';

interface TaskValueInputProps {
  template: TaskTemplate;
  value: number | undefined;
  onChange: (value: number) => void;
}

function getUnitLabel(template: TaskTemplate): string {
  switch (template.unit) {
    case 'minutes':
      return 'minutes';
    case 'steps':
      return 'steps';
    case 'count':
      return template.name.toLowerCase().includes('meal') ? 'meals' : 'times';
    case 'hours':
      return 'hours';
    case 'pages':
      return 'pages';
    case 'words':
      return 'words';
    case 'miles':
      return 'miles';
    case 'calories':
      return 'calories';
    default:
      return 'units';
  }
}

function getPlaceholder(template: TaskTemplate): string {
  switch (template.unit) {
    case 'minutes':
      return '30';
    case 'steps':
      return '10000';
    case 'pages':
      return '20';
    case 'hours':
      return '1';
    case 'count':
      return '3';
    case 'words':
      return '500';
    case 'miles':
      return '3';
    case 'calories':
      return '2000';
    default:
      return '10';
  }
}

export function TaskValueInput({ template, value, onChange }: TaskValueInputProps) {
  const unit = getUnitLabel(template);
  const placeholder = getPlaceholder(template);

  // Time-based tasks don't need a value input here (they use time picker)
  if (template.unit === 'bedtime_time' || template.unit === 'waketime_time') {
    return null;
  }

  // Binary-only tasks don't need value input
  if (template.scoring_type === 'binary_yesno' && template.unit === 'boolean') {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm">
        How much do you commit to daily?
      </Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          placeholder={placeholder}
          value={value || ''}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          className="w-24"
          min={1}
        />
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        This value will appear in your task name
      </p>
    </div>
  );
}
