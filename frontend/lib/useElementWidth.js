"use client";

import { useEffect, useState } from "react";

/**
 * Track the rendered content width of an element.
 *
 * Returns a callback ref plus the current width in CSS pixels (0 until the
 * first measurement). A callback ref is used instead of useRef so the observer
 * attaches even when the element mounts after the first render (charts render
 * nothing until their data arrives).
 *
 * Charts draw their SVG in real pixels from this width, so labels never get
 * stretched or squashed by viewBox scaling.
 */
export function useElementWidth() {
  const [node, setNode] = useState(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!node) return;

    if (typeof ResizeObserver === "undefined") {
      const measure = () => setWidth(Math.round(node.clientWidth));
      const frame = requestAnimationFrame(measure);
      window.addEventListener("resize", measure);
      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", measure);
      };
    }

    // ResizeObserver reports the initial size right after observe(), so no
    // synchronous measurement is needed here.
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [setNode, width];
}
