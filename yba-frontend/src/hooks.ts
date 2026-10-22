import { RefObject, useEffect, useLayoutEffect, useState } from "react";

/** Positions a sliding highlight under the child marked with `[data-active="true"]`. */
export function useSlidingIndicator(
  containerRef: RefObject<HTMLElement>,
  activeKey: unknown
) {
  const [style, setStyle] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const active = container?.querySelector<HTMLElement>(
        '[data-active="true"]'
      );
      if (!container || !active) {
        setStyle(null);
        return;
      }
      setStyle({
        left: active.offsetLeft,
        top: active.offsetTop,
        width: active.offsetWidth,
        height: active.offsetHeight,
      });
    };
    measure();
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure);
    return () => window.removeEventListener("resize", measure);
  }, [containerRef, activeKey]);

  return style;
}

/** Calls `onOutside` on pointer events outside `ref` while `active`, or on Escape. */
export function useClickOutside(
  ref: RefObject<HTMLElement>,
  active: boolean,
  onOutside: () => void
) {
  useEffect(() => {
    if (!active) return;
    const handlePointer = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key == "Escape") onOutside();
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [ref, active, onOutside]);
}

/** Animate a number from zero to `target` (respects reduced-motion). */
export function useCountUp(target: number | undefined, duration = 800) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target == undefined || Number.isNaN(target)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
