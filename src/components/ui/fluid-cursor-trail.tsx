import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** App primary — matches `--primary: 144 100% 31%` in `src/index.css` */
export const BRAND_CURSOR_COLOR = "#009e3f";

interface FluidCursorTrailProps {
  className?: string;
  color?: string;
  particleCount?: number;
  particleSize?: number;
  velocity?: number;
  gravity?: number;
  fadeSpeed?: number;
  zIndex?: number;
  bound?: boolean;
}

export function FluidCursorTrail({
  className,
  color = BRAND_CURSOR_COLOR,
  particleCount = 5,
  particleSize = 6,
  velocity = 5,
  gravity = 0.15,
  fadeSpeed = 0.015,
  zIndex = 50,
  bound = false,
}: FluidCursorTrailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<
    { x: number; y: number; vx: number; vy: number; life: number }[]
  >([]);
  const [reduceMotion, setReduceMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;

    const canvas = canvasRef.current;
    const container = bound ? containerRef.current : null;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (bound && container) {
        const rect = container.getBoundingClientRect();
        const w = Math.max(1, Math.floor(rect.width));
        const h = Math.max(1, Math.floor(rect.height));
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else {
        const w = window.innerWidth;
        const h = window.innerHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };
    resize();
    window.addEventListener("resize", resize);

    let resizeObs: ResizeObserver | undefined;
    if (bound && container) {
      resizeObs = new ResizeObserver(resize);
      resizeObs.observe(container);
    }

    const spawnAt = (clientX: number, clientY: number) => {
      let x: number;
      let y: number;
      if (bound && container) {
        const rect = container.getBoundingClientRect();
        if (
          clientX < rect.left ||
          clientX > rect.right ||
          clientY < rect.top ||
          clientY > rect.bottom
        ) {
          return;
        }
        x = clientX - rect.left;
        y = clientY - rect.top;
      } else {
        x = clientX;
        y = clientY;
      }
      for (let i = 0; i < particleCount; i++) {
        particlesRef.current.push({
          life: 1,
          vx: (Math.random() - 0.5) * velocity,
          vy: (Math.random() - 0.5) * velocity,
          x,
          y,
        });
      }
    };

    const handleMouse = (e: MouseEvent) => spawnAt(e.clientX, e.clientY);
    const handlePointer = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      spawnAt(e.clientX, e.clientY);
    };

    window.addEventListener("mousemove", handleMouse);
    window.addEventListener("pointermove", handlePointer);

    let raf = 0;
    const animate = () => {
      const cssW = bound && container
        ? container.getBoundingClientRect().width
        : window.innerWidth;
      const cssH = bound && container
        ? container.getBoundingClientRect().height
        : window.innerHeight;
      ctx.clearRect(0, 0, cssW, cssH);

      const next: typeof particlesRef.current = [];
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= fadeSpeed;
        p.vy += gravity;
        if (p.life > 0) {
          next.push(p);
          ctx.globalAlpha = Math.min(1, p.life);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, particleSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      particlesRef.current = next;
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      resizeObs?.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouse);
      window.removeEventListener("pointermove", handlePointer);
      cancelAnimationFrame(raf);
      particlesRef.current = [];
    };
  }, [
    bound,
    color,
    particleCount,
    particleSize,
    velocity,
    gravity,
    fadeSpeed,
    reduceMotion,
  ]);

  if (reduceMotion) return null;

  const canvas = (
    <canvas
      ref={canvasRef}
      className={cn(
        "pointer-events-none",
        bound ? "absolute inset-0 size-full" : "fixed inset-0",
        !bound && className,
      )}
      style={{ pointerEvents: "none", zIndex }}
      aria-hidden
    />
  );

  if (bound) {
    return (
      <div
        ref={containerRef}
        className={cn("absolute inset-0 overflow-hidden", className)}
        aria-hidden
      >
        {canvas}
      </div>
    );
  }

  return canvas;
}

export default FluidCursorTrail;
