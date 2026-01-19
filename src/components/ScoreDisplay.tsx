import { motion } from 'framer-motion';

interface ScoreDisplayProps {
  score: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'primary' | 'gold';
}

export function ScoreDisplay({ score, label, size = 'md', variant = 'default' }: ScoreDisplayProps) {
  const sizeClasses = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-6xl',
  };

  const variantClasses = {
    default: '',
    primary: 'gradient-text',
    gold: 'gradient-text-gold',
  };

  return (
    <div className="text-center">
      <motion.p
        key={score}
        initial={{ scale: 1.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`score-text ${sizeClasses[size]} ${variantClasses[variant]}`}
      >
        {score.toLocaleString()}
      </motion.p>
      {label && (
        <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
          {label}
        </p>
      )}
    </div>
  );
}
