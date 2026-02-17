import confetti from "canvas-confetti";

export function burstConfetti() {
  try {
    const end = Date.now() + 250;
    const frame = () => {
      confetti({ particleCount: 30, spread: 55, startVelocity: 35, origin: { y: 0.75 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  } catch {
    // no-op if confetti isn't available (SSR or blocked env)
  }
}
