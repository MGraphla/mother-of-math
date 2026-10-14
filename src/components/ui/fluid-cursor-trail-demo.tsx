import { FluidCursorTrail, BRAND_CURSOR_COLOR } from "@/components/ui/fluid-cursor-trail";

export default function FluidCursorTrailDemo() {
  return (
    <div className="relative flex h-[420px] w-full items-center justify-center overflow-hidden rounded-xl border bg-neutral-950 text-neutral-100">
      <FluidCursorTrail bound color={BRAND_CURSOR_COLOR} particleCount={4} />
      <div className="pointer-events-none z-10 flex flex-col items-center gap-2 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Move your cursor</h2>
        <p className="text-sm text-neutral-400">
          A fluid particle trail follows the pointer.
        </p>
      </div>
    </div>
  );
}
