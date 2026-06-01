import { cn } from "@/lib/utils";

// The S-mark: an isometric interlocking-S rendered inside camera focus
// brackets — the brand's signature device (Spec §9). Kept as crisp geometry
// so it holds at any size.
export function StryviaMark({
  className,
  size = 28,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {/* focus brackets */}
      <path d="M3 8V3h5" stroke="currentColor" strokeWidth="1.5" className="text-sv-text-3" />
      <path d="M24 3h5v5" stroke="currentColor" strokeWidth="1.5" className="text-sv-text-3" />
      <path d="M29 24v5h-5" stroke="currentColor" strokeWidth="1.5" className="text-sv-text-3" />
      <path d="M8 29H3v-5" stroke="currentColor" strokeWidth="1.5" className="text-sv-text-3" />
      {/* interlocking S, two offset strokes converging */}
      <path
        d="M22 11.5c-1.2-1.8-3.4-2.8-6-2.8-3.6 0-6 1.9-6 4.4 0 2.4 2 3.5 5.6 4.2"
        stroke="#C0FA20"
        strokeWidth="2.4"
        strokeLinecap="square"
      />
      <path
        d="M10 20.5c1.2 1.8 3.4 2.8 6 2.8 3.6 0 6-1.9 6-4.4 0-2.4-2-3.5-5.6-4.2"
        stroke="#F4F6F4"
        strokeWidth="2.4"
        strokeLinecap="square"
      />
    </svg>
  );
}

// Horizontal lockup for the navigation: mark left of the wordmark. The notched
// T carries a small green tab (Spec §9). Wordmark runs clean, no descriptor.
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <StryviaMark size={26} />
      <span
        className="font-display text-[1.15rem] font-semibold leading-none tracking-[0.22em] text-sv-text"
        aria-hidden="true"
      >
        S
        <span className="relative inline-block">
          T{/* the notched T carries a small green tab */}
          <span className="absolute -top-px end-0 h-1 w-1 bg-sv-green" />
        </span>
        RYVIA
      </span>
      <span className="sr-only">Stryvia</span>
    </span>
  );
}
