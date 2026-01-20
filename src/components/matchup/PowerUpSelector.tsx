import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePowerUps, POWERUP_TYPES, PowerUpType, PowerUp } from '@/hooks/usePowerUps';
import { Zap, Sparkles } from 'lucide-react';

interface PowerUpSelectorProps {
  weekId?: string;
  onClose?: () => void;
}

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
  const count = powerups.length;

  if (count === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`
        relative p-4 rounded-xl cursor-pointer transition-all
        bg-${meta.color}/10 border border-${meta.color}/30
        hover:bg-${meta.color}/20 hover:border-${meta.color}/50
        ${isActivating ? 'animate-pulse pointer-events-none' : ''}
      `}
      onClick={() => !isActivating && onActivate(powerups[0])}
    >
      {/* Quantity badge */}
      {count > 1 && (
        <span className={`
          absolute -top-2 -right-2 w-6 h-6 rounded-full
          bg-${meta.color} text-${meta.color}-foreground
          flex items-center justify-center text-xs font-bold
        `}>
          {count}
        </span>
      )}

      {/* Icon with effect */}
      <motion.div
        animate={
          meta.effect === 'pulse' 
            ? { scale: [1, 1.1, 1] }
            : meta.effect === 'glow'
            ? { opacity: [1, 0.7, 1] }
            : meta.effect === 'float'
            ? { y: [0, -5, 0] }
            : {}
        }
        transition={{ repeat: Infinity, duration: 2 }}
        className="text-4xl text-center mb-2"
      >
        {meta.icon}
      </motion.div>

      {/* Info */}
      <h3 className="font-semibold text-sm text-center mb-1">{meta.name}</h3>
      <p className="text-[10px] text-muted-foreground text-center leading-tight">
        {meta.description}
      </p>

      {/* Modifier value */}
      <div className={`
        mt-2 text-center text-xs font-bold text-${meta.color}
      `}>
        {type === 'multiplier' ? `${powerups[0].modifier_value}x` : `+${powerups[0].modifier_value}`}
      </div>
    </motion.div>
  );
}

export function PowerUpSelector({ weekId, onClose }: PowerUpSelectorProps) {
  const { groupedPowerups, usePowerUp, availableCount, isLoading } = usePowerUps(weekId);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const handleActivate = async (powerup: PowerUp) => {
    setActivatingId(powerup.id);
    try {
      await usePowerUp.mutateAsync({ powerupId: powerup.id });
      // Small delay for visual feedback
      setTimeout(() => {
        setActivatingId(null);
        onClose?.();
      }, 500);
    } catch {
      setActivatingId(null);
    }
  };

  const powerupTypes = Object.keys(POWERUP_TYPES) as PowerUpType[];
  const availableTypes = powerupTypes.filter(type => (groupedPowerups[type]?.length || 0) > 0);

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : availableCount === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">🎯</div>
          <p className="text-muted-foreground text-sm">No power-ups available</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Earn more by winning matchups!
          </p>
        </div>
      ) : (
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
            Tap a power-up to activate it for this week
          </p>
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
  const { availableCount, isLoading } = usePowerUps(weekId);

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(true)}
        className={`
          relative p-4 rounded-xl flex items-center justify-center gap-2
          bg-secondary/20 border border-secondary/30
          hover:bg-secondary/30 transition-colors
          ${compact ? 'p-3' : ''}
        `}
      >
        {/* Animated icon when powerups available */}
        {availableCount > 0 ? (
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            <Zap className="w-5 h-5 text-secondary" />
          </motion.div>
        ) : (
          <Zap className="w-5 h-5 text-secondary/50" />
        )}
        
        {!compact && (
          <span className={`font-semibold text-sm ${availableCount === 0 ? 'text-muted-foreground' : ''}`}>
            Power-Ups
          </span>
        )}

        {/* Count badge */}
        {availableCount > 0 && !isLoading && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold flex items-center justify-center"
          >
            {availableCount}
          </motion.span>
        )}

        {/* Glow effect when available */}
        {availableCount > 0 && (
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute inset-0 rounded-xl bg-secondary/20 -z-10"
          />
        )}
      </motion.button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-secondary" />
              Power-Ups
            </DialogTitle>
            <DialogDescription>
              Activate a power-up to gain an advantage this week
            </DialogDescription>
          </DialogHeader>
          <PowerUpSelector weekId={weekId} onClose={() => setIsOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
