import { cn } from "@/lib/utils";

// The bracket-corner device (A.5): four short L-shaped corner marks that frame
// whatever the intelligence is focused on — the hero, the Chat, a focused card.
// `live` tints the corners green; `focusIn` plays the settle animation on mount.
// Built with logical positioning so it mirrors automatically in RTL.

type BracketProps = {
  className?: string;
  live?: boolean;
  focusIn?: boolean;
  size?: number; // corner arm length in px
  inset?: number; // distance from the edge in px
};

export function Bracket({
  className,
  live = false,
  focusIn = false,
  size = 14,
  inset = 0,
}: BracketProps) {
  const color = live ? "var(--color-sv-green-line)" : "var(--color-sv-line-strong)";
  const corner = (style: React.CSSProperties): React.CSSProperties => ({
    position: "absolute",
    width: size,
    height: size,
    ...style,
  });

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-10",
        focusIn && "sv-bracket-focus",
        className,
      )}
    >
      {/* top-left */}
      <span
        style={corner({
          insetBlockStart: inset,
          insetInlineStart: inset,
          borderInlineStart: `1px solid ${color}`,
          borderBlockStart: `1px solid ${color}`,
        })}
      />
      {/* top-right */}
      <span
        style={corner({
          insetBlockStart: inset,
          insetInlineEnd: inset,
          borderInlineEnd: `1px solid ${color}`,
          borderBlockStart: `1px solid ${color}`,
        })}
      />
      {/* bottom-left */}
      <span
        style={corner({
          insetBlockEnd: inset,
          insetInlineStart: inset,
          borderInlineStart: `1px solid ${color}`,
          borderBlockEnd: `1px solid ${color}`,
        })}
      />
      {/* bottom-right */}
      <span
        style={corner({
          insetBlockEnd: inset,
          insetInlineEnd: inset,
          borderInlineEnd: `1px solid ${color}`,
          borderBlockEnd: `1px solid ${color}`,
        })}
      />
    </div>
  );
}
