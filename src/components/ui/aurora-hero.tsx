"use client";

import React, { useId } from "react";
import { cn } from "@/lib/utils";

export interface AuroraHeroProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The main title text to display with the glass displacement effect. */
  title?: string;
  /** Whether to show the toggle switch for background modes. */
  showSwitch?: boolean;
}

export function AuroraHero({
  title = "An awesome title",
  showSwitch: _showSwitch,
  className,
  children,
  ...props
}: AuroraHeroProps) {
  const uid = useId().replace(/:/g, "");
  const filterId = `fluted-${uid}`;
  const scope = `aurora-hero-${uid}`;

  const filterImageHref =
    "data:image/svg+xml," +
    encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1' color-interpolation-filters='sRGB'>
      <g>
        <rect width='1' height='1' fill='black' />
        <rect width='1' height='1' fill='url(#red)' style='mix-blend-mode:screen' />
        <rect width='1' height='1' fill='url(#green)' style='mix-blend-mode:screen' />
        <rect width='1' height='1' fill='url(#yellow)' style='mix-blend-mode:screen' />
      </g>
      <defs>
        <radialGradient id='yellow' cx='0' cy='0' r='1' >
          <stop stop-color='yellow' />
          <stop stop-color='yellow' offset='1' stop-opacity='0' />
        </radialGradient>
        <radialGradient id='green' cx='1' cy='0' r='1' >
          <stop stop-color='green' />
          <stop stop-color='green' offset='1' stop-opacity='0' />
        </radialGradient>
        <radialGradient id='red' cx='0' cy='1' r='1' >
          <stop stop-color='red' />
          <stop stop-color='red' offset='1' stop-opacity='0' />
        </radialGradient>
      </defs>
    </svg>
  `);

  return (
    <section
      className={cn(
        scope,
        "relative w-full overflow-hidden",
        children ? "min-h-screen" : "min-h-[400px] h-[500px] sm:h-[600px]",
        className,
      )}
      {...props}
    >
      <style>{`
        .${scope} {
          --stripe-color: #000;
          background-color: #050816;
          font-family: Inter, sans-serif;
        }
        :is(.dark) .${scope} {
          --stripe-color: #fff;
        }
        @keyframes aurora-shift-${uid} {
          from { background-position: 50% 50%, 50% 50%; }
          to { background-position: 350% 50%, 350% 50%; }
        }
        .${scope} .aurora-hero-bg {
          pointer-events: none;
          position: absolute;
          inset: -15%;
          --stripes: repeating-linear-gradient(
            100deg,
            #fff 0%,
            #fff 7%,
            transparent 10%,
            transparent 12%,
            #fff 16%
          );
          --rainbow: repeating-linear-gradient(
            100deg,
            #60a5fa 10%,
            #e879f9 15%,
            #34d399 20%,
            #5eead4 25%,
            #60a5fa 30%
          );
          background-image: var(--stripes), var(--rainbow);
          background-size: 300% 200%, 200% 100%;
          background-position: 50% 50%, 50% 50%;
          filter: blur(18px) saturate(160%);
          opacity: 0.7;
          mask-image: radial-gradient(ellipse at 80% -10%, #000 30%, transparent 75%);
          -webkit-mask-image: radial-gradient(ellipse at 80% -10%, #000 30%, transparent 75%);
          animation: aurora-shift-${uid} 60s linear infinite;
        }
        .${scope} .aurora-hero-bg::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image: var(--stripes), var(--rainbow);
          background-size: 200% 100%, 150% 100%;
          animation: aurora-shift-${uid} 60s linear infinite;
          mix-blend-mode: difference;
        }
        @media (prefers-reduced-motion: reduce) {
          .${scope} .aurora-hero-bg,
          .${scope} .aurora-hero-bg::after {
            animation: none;
          }
        }
        .${scope} .aurora-content {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: flex;
          place-content: center;
          place-items: center;
          flex-flow: column;
          gap: 4.5%;
          text-align: center;
          color: #fff;
          backdrop-filter: contrast(0.9) blur(7px) url(#${filterId});
          -webkit-backdrop-filter: contrast(0.9) blur(7px) url(#${filterId});
          mix-blend-mode: difference;
          filter: invert(1);
        }
        .${scope} .h1-scalingSize {
          font-size: calc(1rem + 5vw);
          position: relative;
          isolation: isolate;
          font-weight: 700;
        }
        .${scope} .h1-scalingSize::first-letter {
          font-size: 300%;
        }
        .${scope} .h1-scalingSize::before {
          content: attr(data-text);
          position: absolute;
          inset: 0;
          background: white;
          text-shadow: 0 0 1px #ffffff;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          background-color: white;
          backdrop-filter: blur(19px) brightness(12.5);
          -webkit-text-stroke: 1px white;
          display: flex;
          margin: auto;
          z-index: 1;
          pointer-events: none;
        }
      `}</style>

      <div className="aurora-hero-bg" aria-hidden />

      {children ? (
        <div className="relative z-10">{children}</div>
      ) : (
        <div className="aurora-content">
          <h1 className="h1-scalingSize" data-text={title}>
            {title}
          </h1>
        </div>
      )}

      <svg
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        colorInterpolationFilters="sRGB"
        style={{
          position: "absolute",
          opacity: 0,
          height: 0,
          width: 0,
          pointerEvents: "none",
        }}
        aria-hidden="true"
        focusable="false"
      >
        <filter id={filterId} primitiveUnits="objectBoundingBox">
          <feImage
            x="0"
            y="0"
            result="image_0"
            crossOrigin="anonymous"
            href={filterImageHref}
            preserveAspectRatio="none meet"
            width=".03"
            height="1"
          />
          <feTile in="image_0" result="tile_0" />
          <feGaussianBlur
            stdDeviation=".0001"
            edgeMode="none"
            in="tile_0"
            result="bar_smoothness"
            x="0"
            y="0"
          />
          <feDisplacementMap
            scale=".08"
            xChannelSelector="R"
            yChannelSelector="G"
            in="SourceGraphic"
            in2="bar_smoothness"
            result="displacement_0"
          />
        </filter>
      </svg>
    </section>
  );
}

export default AuroraHero;
