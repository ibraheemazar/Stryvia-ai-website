// A single shared scroll engine: one passive listener + one rAF loop drives
// every scroll-linked effect on the page (parallax, scroll-scenes, progress
// rail). Each subscriber gets a 0→1 progress for its element's travel through
// the viewport. Cheap, and it never thrashes layout more than once a frame.

export type ProgressFn = (progress: number, rect: DOMRect) => void;

type Sub = { el: HTMLElement; cb: ProgressFn };

const subs = new Set<Sub>();
let frame = 0;
let listening = false;

export function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

// Travel progress: 0 when the element's top sits at the viewport bottom,
// 1 when its bottom passes the viewport top. 0.5 ≈ centered.
function progressFor(rect: DOMRect, vh: number): number {
  const total = vh + rect.height;
  const travelled = vh - rect.top;
  return Math.min(1, Math.max(0, travelled / total));
}

function tick() {
  frame = 0;
  const vh = window.innerHeight || document.documentElement.clientHeight;
  for (const s of subs) {
    const rect = s.el.getBoundingClientRect();
    s.cb(progressFor(rect, vh), rect);
  }
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(tick);
}

function ensureListening() {
  if (listening) return;
  listening = true;
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
}

export function onScrollProgress(el: HTMLElement, cb: ProgressFn): () => void {
  const sub: Sub = { el, cb };
  subs.add(sub);
  ensureListening();
  // Prime immediately so first paint is correct.
  schedule();
  return () => {
    subs.delete(sub);
    if (subs.size === 0) {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      listening = false;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}
