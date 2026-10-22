import { useEffect, useRef } from "react";
import { SheepShape } from "./Sheep";

const TILE_W = 148;
const TILE_H = 128;

const placements = [
  { x: 14, y: 18, r: -5, o: 1 },
  { x: 88, y: 82, r: 4, o: 0.7 },
];

/** Full-page repeating sheep background with parallax on scroll. */
const SheepPattern = () => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    /** Updates the pattern vertical offset from scroll position. */
    const update = () => {
      frame = 0;
      const shift = (window.scrollY * 0.12) % TILE_H;
      ref.current?.style.setProperty("--pattern-shift", `${-shift}px`);
    };
    /** Schedules a single animation frame update per scroll burst. */
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="sheep-pattern" ref={ref} aria-hidden="true">
      <svg width="100%" height="100%">
        <defs>
          <pattern
            id="yba-sheep"
            width={TILE_W}
            height={TILE_H}
            patternUnits="userSpaceOnUse"
          >
            {placements.map((p, i) => (
              <g
                key={i}
                opacity={p.o}
                transform={`translate(${p.x} ${p.y}) rotate(${p.r} 20 14) scale(0.62)`}
              >
                <SheepShape wool="var(--pattern-wool)" face="var(--pattern-face)" />
              </g>
            ))}
            <circle cx="118" cy="30" r="1.4" style={{ fill: "var(--pattern-face)" }} opacity="0.5" />
            <circle cx="50" cy="100" r="1.4" style={{ fill: "var(--pattern-face)" }} opacity="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#yba-sheep)" />
      </svg>
    </div>
  );
};

export default SheepPattern;
