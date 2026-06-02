"use client";

import { useEffect, useRef } from "react";

// A living intelligence network: drifting nodes that connect as they near each
// other, with the occasional green signal pulse — the "many models working as
// one" made visual. Performant (capped DPR, pauses off-screen) and gated by
// prefers-reduced-motion (renders a calm static field instead).
export function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0,
      h = 0,
      raf = 0,
      running = true;

    type Node = { x: number; y: number; vx: number; vy: number; green: boolean };
    let nodes: Node[] = [];

    // Colors follow the active accent + light/dark mode (read from CSS vars),
    // and re-read when the theme picker dispatches a change.
    let GREEN = "192,250,32";
    let WHITE = "244,246,244";
    function readColors() {
      const cs = getComputedStyle(document.documentElement);
      const accent = cs.getPropertyValue("--sv-accent-rgb").trim();
      if (accent) GREEN = accent.replace(/\s+/g, ",");
      WHITE =
        document.documentElement.dataset.theme === "light"
          ? "18,21,15"
          : "244,246,244";
    }
    readColors();

    // Pointer in canvas-local coords; -1 means "no pointer" (idle).
    const mouse = { x: -1, y: -1 };
    const MOUSE_R = 180;

    function resize() {
      const parent = canvas!.parentElement!;
      w = parent.clientWidth;
      h = parent.clientHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(70, Math.floor((w * h) / 16000));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        green: Math.random() < 0.12,
      }));
    }

    function render() {
      ctx!.clearRect(0, 0, w, h);

      // connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i],
            b = nodes[j];
          const dx = a.x - b.x,
            dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 130) {
            const alpha = (1 - dist / 130) * 0.5;
            const isGreen = a.green || b.green;
            ctx!.strokeStyle = `rgba(${isGreen ? GREEN : WHITE},${alpha * (isGreen ? 0.9 : 0.18)})`;
            ctx!.lineWidth = isGreen ? 1 : 0.6;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }

      // cursor web — a bright accent net the intelligence weaves toward the
      // pointer, plus a soft glow at the cursor itself.
      if (mouse.x >= 0) {
        for (const n of nodes) {
          const dx = n.x - mouse.x,
            dy = n.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < MOUSE_R) {
            const alpha = (1 - dist / MOUSE_R) * 0.85;
            ctx!.strokeStyle = `rgba(${GREEN},${alpha})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(mouse.x, mouse.y);
            ctx!.lineTo(n.x, n.y);
            ctx!.stroke();
          }
        }
        const g = ctx!.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 60);
        g.addColorStop(0, `rgba(${GREEN},0.18)`);
        g.addColorStop(1, `rgba(${GREEN},0)`);
        ctx!.fillStyle = g;
        ctx!.fillRect(mouse.x - 60, mouse.y - 60, 120, 120);
      }

      // nodes
      for (const n of nodes) {
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.green ? 2.4 : 1.4, 0, Math.PI * 2);
        ctx!.fillStyle = n.green ? `rgba(${GREEN},0.95)` : `rgba(${WHITE},0.5)`;
        if (n.green) {
          ctx!.shadowColor = `rgba(${GREEN},0.9)`;
          ctx!.shadowBlur = 10;
        } else {
          ctx!.shadowBlur = 0;
        }
        ctx!.fill();
      }
      ctx!.shadowBlur = 0;
    }

    function loop() {
      if (!running) return;
      for (const n of nodes) {
        // Gentle pull toward the cursor (the field leans in to "listen").
        if (mouse.x >= 0) {
          const dx = mouse.x - n.x,
            dy = mouse.y - n.y;
          const dist = Math.hypot(dx, dy);
          if (dist < MOUSE_R && dist > 0.5) {
            const f = (1 - dist / MOUSE_R) * 0.035;
            n.vx += (dx / dist) * f;
            n.vy += (dy / dist) * f;
          }
        }
        // Friction keeps the pull from accumulating into chaos.
        n.vx *= 0.985;
        n.vy *= 0.985;
        // Keep a baseline drift so the field never stalls.
        const sp = Math.hypot(n.vx, n.vy);
        if (sp < 0.12) {
          n.vx += (Math.random() - 0.5) * 0.05;
          n.vy += (Math.random() - 0.5) * 0.05;
        }
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }
      render();
      raf = requestAnimationFrame(loop);
    }

    resize();
    if (reduce) {
      render(); // calm, static field
    } else {
      running = true;
      loop();
    }

    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    const onTheme = () => {
      readColors();
      if (reduce) render();
    };
    window.addEventListener("sv:themechange", onTheme);

    // Pointer interaction (hover-capable devices only; canvas-local coords).
    const hoverable =
      !reduce && window.matchMedia("(hover: hover)").matches;
    const onPointerMove = (e: PointerEvent) => {
      const r = canvas!.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const onPointerLeave = () => {
      mouse.x = -1;
      mouse.y = -1;
    };
    if (hoverable) {
      const host = canvas!.parentElement!;
      host.addEventListener("pointermove", onPointerMove);
      host.addEventListener("pointerleave", onPointerLeave);
    }
    const io = new IntersectionObserver((e) => {
      if (reduce) return;
      const wasRunning = running;
      running = e[0].isIntersecting;
      if (running && !wasRunning) loop();
    });
    io.observe(canvas);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("sv:themechange", onTheme);
      if (hoverable) {
        const host = canvas!.parentElement!;
        host.removeEventListener("pointermove", onPointerMove);
        host.removeEventListener("pointerleave", onPointerLeave);
      }
      io.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{
        maskImage: "radial-gradient(130% 100% at 50% 30%, #000 35%, transparent 80%)",
        WebkitMaskImage: "radial-gradient(130% 100% at 50% 30%, #000 35%, transparent 80%)",
      }}
    />
  );
}
