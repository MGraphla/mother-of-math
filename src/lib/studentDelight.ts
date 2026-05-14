import confetti from "canvas-confetti";

/** Match app primary green (#047857 ≈ hsl 144 100% 31%) + warm accent */
const BRAND_COLORS = ["#047857", "#059669", "#10b981", "#34d399", "#fbbf24", "#fef3c7"];

/**
 * Short celebratory burst (assignment submitted, milestone, etc.).
 * Respects `prefers-reduced-motion` via canvas-confetti.
 */
export function celebrateSuccess(options?: { particles?: number; originY?: number }) {
  const particleCount = options?.particles ?? 52;
  const originY = options?.originY ?? 0.68;

  void confetti({
    particleCount,
    spread: 58,
    startVelocity: 32,
    gravity: 1.05,
    ticks: 110,
    scalar: 0.9,
    origin: { x: 0.5, y: originY },
    colors: BRAND_COLORS,
    zIndex: 10000,
    disableForReducedMotion: true,
  });
}

/** Tiny “spark” from the side — nice after refresh or small wins */
export function celebrateSparkle() {
  void confetti({
    particleCount: 18,
    spread: 36,
    startVelocity: 18,
    gravity: 1.2,
    origin: { x: 0.15, y: 0.55 },
    colors: BRAND_COLORS,
    zIndex: 10000,
    disableForReducedMotion: true,
  });
}
