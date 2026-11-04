import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { usePowerUps, POWERUP_TYPES, PowerUpType, PowerUp } from '@/hooks/usePowerUps';
import { Zap, Sparkles, Check, Target } from 'lucide-react';

interface PowerUpSelectorProps {
  weekId?: string;
  onClose?: () => void;
}

const COLOR_STYLES = {
  secondary: {
    card: 'bg-secondary/10 border-secondary/30 hover:bg-secondary/20 hover:border-secondary/50',
    text: 'text-secondary',
    badge: 'bg-secondary text-secondary-foreground',
  },
  primary: {
    card: 'bg-primary/10 border-primary/30 hover:bg-primary/20 hover:border-primary/50',
    text: 'text-primary',
    badge: 'bg-primary text-primary-foreground',
  },
  streak: {
    card: 'bg-streak/10 border-streak/30 hover:bg-streak/20 hover:border-streak/50',
    text: 'text-streak',
    badge: 'bg-streak text-streak-foreground',
  },
} as const;

function PowerUpCard({
  type,
  powerups,
  onActivate,
  isActivating,
}: {
  type: PowerUpType;
  powerups: PowerUp[];
  onActivate: (powerup: PowerUp) => void;
  isActivating: boolean;
}) {
  const meta = POWERUP_TYPES[type];
  const styles = COLOR_STYLES[meta.color];
  const count = powerups.length;

  if (count === 0) return null;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`relative p-4 rounded-xl cursor-pointer transition-all border ${styles.card} ${
        isActivating ? 'animate-pulse pointer-events-none' : ''
      }`}
      onClick={() => !isActivating && onActivate(powerups[0])}
    >
      {count > 1 && (
        <span className={`absolute -top-2 -right-2 w-6 h-6 rounded-full ${styles.badge} flex items-center justify-center text-xs font-bold`}>
          {count}
        </span>
      )}

      <motion.div
        animate={
          meta.effect === 'pulse'
            ? { scale: [1, 1.1, 1] }
            : meta.effect === 'glow'
              ? { opacity: [1, 0.7, 1] }
              : { y: [0, -5, 0] }
        }
        transition={{ repeat: Infinity, duration: 2 }}
        className="text-4xl text-center mb-2"
      >
        {meta.icon}
      </motion.div>

      <h3 className="font-semibold text-sm text-center mb-1">{meta.name}</h3>
      <p className="text-[10px] text-muted-foreground text-center leading-tight">{meta.description}</p>
      <div className={`mt-2 text-center text-xs font-bold ${styles.text}`}>
        {type === 'multiplier' ? `${powerups[0].modifier_value}x` : `+${powerups[0].modifier_value}`}
      </div>
    </motion.button>
  );
}

export function PowerUpSelector({ weekId, onClose }: PowerUpSelectorProps) {
  const {
    groupedPowerups,
    activatePowerUp,
    availableCount,
    armedPowerups,
    usedCount,
    isLoading,
  } = usePowerUps(weekId);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const handleActivate = async (powerup: PowerUp) => {
    setActivatingId(powerup.id);
    try {
      await activatePowerUp.mutateAsync({ powerup });
      setActivatingId(null);
      onClose?.();
    } catch {
      setActivatingId(null);
    }
  };

  const powerupTypes = Object.keys(POWERUP_TYPES) as PowerUpType[];
  const availableTypes = powerupTypes.filter(type => (groupedPowerups[type]?.length || 0) > 0);
  const armed = armedPowerups[0];
  const armedMeta = armed ? POWERUP_TYPES[armed.powerup_type as PowerUpType] : null;

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2].map(i => <div key={i} className="h-32 bg-muted/50 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {armed && armedMeta && (
            <div className="rounded-xl border border-secondary/30 bg-secondary/10 p-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-secondary/20 flex items-center justify-center text-2xl">
                  {armedMeta.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-secondary" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-secondary">Armed</p>
                  </div>
                  <p className="font-semibold text-sm">{armedMeta.name}</p>
                  <p className="text-xs text-muted-foreground">Triggers automatically on your next eligible scoring action.</p>
                </div>
              </div>
            </div>
          )}

          {availableCount > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <AnimatePresence>
                  {availableTypes.map(type => (
                    <PowerUpCard
                      key={type}
                      type={type}
                      powerups={groupedPowerups[type] || []}
                      onActivate={handleActivate}
                      isActivating={activatingId === groupedPowerups[type]?.[0]?.id}
                    />
                  ))}
                </AnimatePresence>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                Tap to arm it. Arming does not spend the Power Play.
              </p>
            </>
          )}

          {availableCount === 0 && armedPowerups.length === 0 && (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
                <Check className="w-6 h-6 text-primary" />
              </div>
              <p className="font-medium text-sm">Power Play used</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {usedCount > 0 ? 'Your weekly boost has already hit the scoreboard.' : 'No Power Play is available for this week.'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface PowerUpButtonProps {
  weekId?: string;
  compact?: boolean;
}

export function PowerUpButton({ weekId, compact = false }: PowerUpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { availableCount, armedCount, usedCount, isLoading } = usePowerUps(weekId);
  const isArmed = armedCount > 0;

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(true)}
        className={`relative p-4 rounded-xl flex items-center justify-center gap-2 border transition-colors ${
          isArmed
            ? 'bg-secondary/25 border-secondary/50'
            : availableCount > 0
              ? 'bg-secondary/20 border-secondary/30 hover:bg-secondary/30'
              : 'bg-muted border-border'
        } ${compact ? 'p-3' : ''}`}
      >
        {isArmed || availableCount > 0 ? (
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            <Zap className="w-5 h-5 text-secondary" />
          </motion.div>
        ) : (
          <Zap className="w-5 h-5 text-muted-foreground" />
        )}

        {!compact && (
          <span className={`font-semibold text-sm ${availableCount === 0 && !isArmed ? 'text-muted-foreground' : ''}`}>
            {isArmed ? 'Power Play Armed' : availableCount > 0 ? 'Power Play' : usedCount > 0 ? 'Power Play Used' : 'Power Play'}
          </span>
        )}

        {availableCount > 0 && !isLoading && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold flex items-center justify-center"
          >
            {availableCount}
          </motion.span>
        )}
      </motion.button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-secondary" />
              Power Play
            </DialogTitle>
            <DialogDescription>
              Each player gets one 2x play per week. Arm it before the scoring action you want to double.
            </DialogDescription>
          </DialogHeader>
          <PowerUpSelector weekId={weekId} onClose={() => setIsOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
