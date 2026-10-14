import { GradientShimmer } from "@/components/ui/gradient-shimmer";

const settings = {
  gradient: "sunrise" as const,
  easing: "smooth" as const,
  duration: 1.45,
  spread: 3,
  angle: 105,
  pauseBetween: 1000,
};

export default function GradientShimmerDemo(props: Partial<typeof settings>) {
  const s = { ...settings, ...props };
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <GradientShimmer
        gradient={s.gradient}
        easing={s.easing}
        duration={s.duration}
        spread={s.spread}
        angle={s.angle}
        pauseBetween={s.pauseBetween}
        className="text-5xl font-semibold tracking-tight sm:text-7xl"
      >
        Mother of Mathematics
      </GradientShimmer>
    </div>
  );
}
