import { motion } from 'framer-motion';
import { Zap, Flame, Skull } from 'lucide-react';

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | null;

interface DifficultyPresetsProps {
  selected: DifficultyLevel;
  onSelect: (level: DifficultyLevel) => void;
}

export const difficultyConfigs = {
  easy: {
    label: 'Easy',
    description: 'Relaxed targets for beginners',
    icon: Zap,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500',
    // Scoring overrides
    pointsMultiplier: 0.6,
    timeAdjustment: 30, // +30 min grace for wake/sleep
    thresholdMultiplier: 0.7, // 70% of default threshold
  },
  medium: {
    label: 'Medium',
    description: 'Balanced challenge',
    icon: Flame,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500',
    pointsMultiplier: 1.0,
    timeAdjustment: 0,
    thresholdMultiplier: 1.0,
  },
  hard: {
    label: 'Hard',
    description: 'For serious grinders only',
    icon: Skull,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500',
    pointsMultiplier: 1.5,
    timeAdjustment: -15, // -15 min stricter for wake/sleep
    thresholdMultiplier: 1.3, // 130% of default threshold
  },
} as const;

export function DifficultyPresets({ selected, onSelect }: DifficultyPresetsProps) {
  const levels = Object.entries(difficultyConfigs) as [DifficultyLevel, typeof difficultyConfigs.easy][];

  return (
    <div className="mb-6">
      <p className="text-sm font-medium text-muted-foreground mb-3 text-center">
        Quick Setup (Optional)
      </p>
      <div className="grid grid-cols-3 gap-3">
        {levels.map(([level, config]) => {
          const Icon = config.icon;
          const isSelected = selected === level;

          return (
            <motion.button
              key={level}
              type="button"
              onClick={() => onSelect(isSelected ? null : level)}
              className={`relative p-3 rounded-xl border-2 transition-all ${
                isSelected
                  ? `${config.borderColor} ${config.bgColor}`
                  : 'border-border bg-card hover:border-muted-foreground/30'
              }`}
              whileTap={{ scale: 0.97 }}
            >
              <Icon className={`w-6 h-6 mx-auto mb-1 ${config.color}`} />
              <p className={`font-semibold text-sm ${isSelected ? config.color : ''}`}>
                {config.label}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                {config.description}
              </p>
            </motion.button>
          );
        })}
      </div>
      {selected && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-center text-muted-foreground mt-2"
        >
          {selected === 'easy' && '🌱 Forgiving wake times, lower thresholds'}
          {selected === 'medium' && '⚡ Standard targets for most people'}
          {selected === 'hard' && '🔥 Early wake times, higher goals, max points'}
        </motion.p>
      )}
    </div>
  );
}

// Helper to apply difficulty preset to a task config
export function applyDifficultyToConfig(
  scoringType: string,
  defaultConfig: Record<string, any>,
  difficulty: DifficultyLevel
): Record<string, any> {
  if (!difficulty) return {};

  const preset = difficultyConfigs[difficulty];
  const result: Record<string, any> = {};

  // Adjust points
  if (defaultConfig.points_on_time) {
    result.points = Math.round(defaultConfig.points_on_time * preset.pointsMultiplier);
  } else if (defaultConfig.points_at_threshold) {
    result.points = Math.round(defaultConfig.points_at_threshold * preset.pointsMultiplier);
  } else if (defaultConfig.max_points) {
    result.points = Math.round(defaultConfig.max_points * preset.pointsMultiplier);
  } else if (defaultConfig.binary_points) {
    result.binary_points = Math.round(defaultConfig.binary_points * preset.pointsMultiplier);
  }

  // Adjust time-based tasks
  if (scoringType === 'time_after' && defaultConfig.target_time) {
    // Wake time: later = easier
    result.target_time = adjustTime(defaultConfig.target_time, preset.timeAdjustment);
  } else if (scoringType === 'time_before' && defaultConfig.target_time) {
    // Bedtime: earlier = easier (negative adjustment makes it easier)
    result.target_time = adjustTime(defaultConfig.target_time, -preset.timeAdjustment);
  }

  // Adjust threshold tasks
  if (defaultConfig.threshold) {
    result.threshold = Math.round(defaultConfig.threshold * preset.thresholdMultiplier);
  }

  // Adjust target tasks
  if (defaultConfig.target) {
    result.target = Math.round(defaultConfig.target * preset.thresholdMultiplier);
  }

  return result;
}

function adjustTime(time: string, minutesOffset: number): string {
  const [hours, minutes] = time.split(':').map(Number);
  let totalMinutes = hours * 60 + minutes + minutesOffset;
  
  // Clamp to valid range
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  if (totalMinutes >= 24 * 60) totalMinutes -= 24 * 60;
  
  const newHours = Math.floor(totalMinutes / 60);
  const newMinutes = totalMinutes % 60;
  
  return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
}
