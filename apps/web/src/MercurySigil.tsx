import { useEffect, useRef } from "react";

// Reads a CSS custom property from :root, falling back to a supplied default.
function readVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

const N = 96; // blob perimeter samples

export function MercurySigil({ size = 80, accent = false }: { size?: number; accent?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? Math.max(1, window.devicePixelRatio || 1) : 1;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size / 2;
    const cy = size / 2;
    const amp = size * 0.045; // low amplitude keeps motion gentle
    const baseR = size * 0.34;

    // Resolve palette once; neutral chrome greys with an optional restrained accent.
    const chrome1 = readVar("--chrome-1", "#3a3f47");
    const chrome2 = readVar("--chrome-2", "#7d828b");
    const chrome3 = readVar("--chrome-3", "#c3c7cd");
    const accentCol = readVar("--accent", "#c9b6ff");

    function draw(t: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, size, size);

      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const theta = (i / N) * Math.PI * 2;
        const r = baseR + Math.sin(theta * 3 + t) * amp + Math.sin(theta * 7 - t * 0.7) * amp * 0.4;
        const x = cx + Math.cos(theta) * r;
        const y = cy + Math.sin(theta) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      // Subtle radial body reads as liquid metal without a background gradient.
      const body = ctx.createRadialGradient(
        cx - baseR * 0.3,
        cy - baseR * 0.3,
        baseR * 0.1,
        cx,
        cy,
        baseR * 1.5,
      );
      body.addColorStop(0, chrome3);
      body.addColorStop(0.55, chrome2);
      body.addColorStop(1, chrome1);
      ctx.fillStyle = body;
      ctx.fill();

      if (accent) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = accentCol;
        ctx.lineWidth = Math.max(1, size * 0.012);
        ctx.stroke();
        ctx.restore();
      }
    }

    const reduce =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      draw(0); // single still frame, no animation loop
      return;
    }

    let raf = 0;
    let t = 0;
    const loop = () => {
      t += 0.008; // slow, continuous drift
      draw(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(raf);
  }, [size, accent]);

  return <canvas ref={canvasRef} aria-hidden="true" />;
}
