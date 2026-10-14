import confetti from "canvas-confetti";

function fire(originX = 0.5, particleCount = 85) {
  confetti({
    particleCount,
    spread: 72,
    startVelocity: 46,
    gravity: 0.9,
    scalar: 1.05,
    origin: { x: originX, y: 0.72 },
  });
}

export function burstConfetti(powerPlay = false) {
  try {
    if (!powerPlay) {
      fire();
      return;
    }

    // Power Play should be unmistakably bigger than a normal score: two
    // separate explosions rather than a longer version of the same burst.
    fire(0.34, 105);
    window.setTimeout(() => fire(0.66, 120), 240);
  } catch {
    // no-op if confetti isn't available (SSR or blocked env)
  }
}

export const triggerConfetti = burstConfetti;

export function triggerScoreHaptic(powerPlay = false) {
  try {
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
    navigator.vibrate(powerPlay ? [70, 170, 120] : 65);
  } catch {
    // Haptics are enhancement-only and must never block a check-in.
  }
}
