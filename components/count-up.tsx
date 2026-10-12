"use client";
// Counts a key number up from zero once, on first view. The final value is rendered on the server,
// so the number is correct without JavaScript, and nothing moves for reduced-motion users.
import { useEffect, useRef, useState } from "react";

export function CountUp({ value, suffix = "", duration = 700 }: { value: number; suffix?: string; duration?: number }) {
  const [shown, setShown] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || value === 0) return;
    started.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic: fast start, gentle landing
      setShown(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    // No reset to zero up front: if the browser never paints this tab (background tab, print,
    // screenshot), the true number simply stays. The timer guarantees we always land on it.
    frame = requestAnimationFrame(tick);
    const settle = setTimeout(() => {
      cancelAnimationFrame(frame);
      setShown(value);
    }, duration + 400);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
  }, [value, duration]);

  return (
    <span className="tabular">
      <span aria-hidden="true">
        {shown}
        {suffix}
      </span>
      <span className="sr-only">
        {value}
        {suffix}
      </span>
    </span>
  );
}
