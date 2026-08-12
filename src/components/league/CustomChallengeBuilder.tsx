import { CheckCircle2, Hash, Sparkles, Timer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TaskTemplate } from '@/hooks/useTaskTemplates';
import { getInitialConfig, type TaskConfigOverrides } from './TaskConfigurationPanel';
import { getTaskScoringSentence } from '@/lib/taskNaming';

export interface CustomChallengeValue {
  templateId: string;
  config: TaskConfigOverrides;
}

interface CustomChallengeBuilderProps {
  templates: TaskTemplate[];
  value?: CustomChallengeValue;
  onChange: (value: CustomChallengeValue | undefined) => void;
}

type ChallengeMode = 'checkoff' | 'minutes' | 'count';

const MODES: Array<{ id: ChallengeMode; label: string; helper: string; icon: typeof CheckCircle2 }> = [
  { id: 'checkoff', label: 'Did it', helper: 'A simple daily yes/no', icon: CheckCircle2 },
  { id: 'minutes', label: 'Minutes', helper: 'Study, practice, meditate…', icon: Timer },
  { id: 'count', label: 'Count', helper: 'Pages, reps, lessons…', icon: Hash },
];

function getMode(template: TaskTemplate): ChallengeMode {
  if (template.input_type === 'duration') return 'minutes';
  if (template.input_type === 'numeric') return 'count';
  return 'checkoff';
}

function templateForMode(templates: TaskTemplate[], mode: ChallengeMode) {
  return templates.find((template) => getMode(template) === mode);
}

export function CustomChallengeBuilder({ templates, value, onChange }: CustomChallengeBuilderProps) {
  const selectedTemplate = value ? templates.find((template) => template.id === value.templateId) : undefined;
  const config = value?.config;
  const selectedMode = selectedTemplate ? getMode(selectedTemplate) : 'checkoff';

  const startChallenge = () => {
    const template = templateForMode(templates, 'checkoff') ?? templates[0];
    if (!template) return;
    onChange({
      templateId: template.id,
      config: {
        ...getInitialConfig(template),
        custom_name: '',
        custom_description: '',
        scoring_mode: 'binary',
        binary_points: 3,
      },
    });
  };

  const setMode = (mode: ChallengeMode) => {
    const template = templateForMode(templates, mode);
    if (!template) return;
    const currentName = config?.custom_name ?? '';
    const currentDescription = config?.custom_description ?? '';
    const next = getInitialConfig(template);
    onChange({
      templateId: template.id,
      config: {
        ...next,
        custom_name: currentName,
        custom_description: currentDescription,
        scoring_mode: 'binary',
        binary_points: 3,
      },
    });
  };

  const update = (patch: Partial<TaskConfigOverrides>) => {
    if (!value) return;
    onChange({ templateId: value.templateId, config: { ...value.config, ...patch } });
  };

  if (!value || !selectedTemplate || !config) {
    return (
      <div className="rounded-2xl border border-dashed border-secondary/40 bg-secondary/5 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Make it yours</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add one shared challenge that fits your group—religious study, language practice, no dessert, anything you care about.
            </p>
            <div className="flex flex-wrap gap-2 mt-3 text-xs text-muted-foreground">
              <span className="rounded-full bg-background px-2 py-1">Religious study</span>
              <span className="rounded-full bg-background px-2 py-1">Spanish practice</span>
              <span className="rounded-full bg-background px-2 py-1">No junk food</span>
            </div>
          </div>
        </div>
        <Button type="button" variant="secondary" className="w-full mt-4" onClick={startChallenge} disabled={templates.length === 0}>
          <Sparkles className="w-4 h-4 mr-2" />
          Add a custom challenge
        </Button>
        {templates.length === 0 && (
          <p className="text-xs text-muted-foreground mt-2 text-center">Custom challenge templates are not installed in this database yet.</p>
        )}
      </div>
    );
  }

  const target = selectedMode === 'minutes'
    ? Number(config.threshold ?? 20)
    : Number(config.threshold ?? config.target ?? 1);

  return (
    <div className="rounded-2xl border border-secondary/40 bg-secondary/5 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-secondary" />
            <p className="font-semibold">League Challenge</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Everyone competes on this same custom goal.</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => onChange(undefined)} className="h-8 w-8">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="custom-challenge-name">What should players see?</Label>
        <Input
          id="custom-challenge-name"
          value={config.custom_name ?? ''}
          onChange={(event) => update({ custom_name: event.target.value })}
          placeholder="e.g. Daily Torah Study"
          maxLength={50}
        />
      </div>

      <div className="space-y-2">
        <Label>What counts as completing it?</Label>
        <div className="grid grid-cols-3 gap-2">
          {MODES.map((mode) => {
            const Icon = mode.icon;
            const available = !!templateForMode(templates, mode.id);
            return (
              <button
                key={mode.id}
                type="button"
                disabled={!available}
                onClick={() => setMode(mode.id)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  selectedMode === mode.id
                    ? 'border-secondary bg-secondary/15'
                    : 'border-border bg-background/50 hover:border-secondary/40'
                } disabled:opacity-40`}
              >
                <Icon className={`w-4 h-4 mb-2 ${selectedMode === mode.id ? 'text-secondary' : 'text-muted-foreground'}`} />
                <p className="text-sm font-semibold">{mode.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{mode.helper}</p>
              </button>
            );
          })}
        </div>
      </div>

      {selectedMode !== 'checkoff' && (
        <div className="space-y-2">
          <Label htmlFor="custom-challenge-target">Daily goal</Label>
          <div className="flex items-center gap-2">
            <Input
              id="custom-challenge-target"
              type="number"
              min={1}
              value={target}
              onChange={(event) => update({ threshold: Math.max(1, Number(event.target.value) || 1) })}
            />
            <span className="text-sm text-muted-foreground w-20">{selectedMode === 'minutes' ? 'minutes' : 'times'}</span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="custom-challenge-description">Short note (optional)</Label>
        <Input
          id="custom-challenge-description"
          value={config.custom_description ?? ''}
          onChange={(event) => update({ custom_description: event.target.value })}
          placeholder="What exactly should everyone do?"
          maxLength={100}
        />
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Players will understand it as</p>
        <p className="text-sm font-medium">{getTaskScoringSentence(selectedTemplate, config)}</p>
      </div>
    </div>
  );
}
