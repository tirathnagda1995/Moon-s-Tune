"use client";
import { useEffect, useRef } from "react";
export default function Moon({
  angle = 150,
  size = 330,
}: {
  angle?: number;
  size?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const n = 480;
    canvas.width = n;
    canvas.height = n;
    const pixels = ctx.createImageData(n, n);
    const radians = (angle * Math.PI) / 180;
    const lx = Math.sin(radians),
      lz = -Math.cos(radians);
    let seed = 42;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const craters = Array.from({ length: 52 }, () => ({
      x: random() * 1.8 - 0.9,
      y: random() * 1.8 - 0.9,
      r: random() * 0.075 + 0.008,
    }));
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const xx = (x - n / 2) / (n * 0.47),
          yy = (y - n / 2) / (n * 0.47),
          rr = xx * xx + yy * yy;
        if (rr > 1) continue;
        const z = Math.sqrt(1 - rr);
        const light = Math.max(0, xx * lx + z * lz);
        const terrain =
          Math.sin(xx * 18 + Math.sin(yy * 13) * 2) *
            Math.cos(yy * 19 + xx * 3) *
            0.09 +
          Math.sin(xx * 47) * Math.cos(yy * 53) * 0.025;
        let surface = 0.79 + terrain + (random() - 0.5) * 0.1;
        for (const c of craters) {
          const d = Math.hypot(xx - c.x, yy - c.y) / c.r;
          if (d < 1.25) surface += d < 0.8 ? -0.13 : 0.09;
        }
        const shade = (0.07 + Math.pow(light, 0.65) * 0.93) * surface;
        const i = (y * n + x) * 4;
        pixels.data[i] = Math.min(255, shade * 248);
        pixels.data[i + 1] = Math.min(255, shade * 245);
        pixels.data[i + 2] = Math.min(255, shade * 222);
        pixels.data[i + 3] = Math.min(255, (1 - rr) * 14000);
      }
    ctx.putImageData(pixels, 0, 0);
  }, [angle]);
  return (
    <canvas
      ref={ref}
      className="moon-canvas"
      style={{ width: size, maxWidth: "100%", height: "auto" }}
      aria-hidden="true"
    />
  );
}
