import { cn } from "@/lib/utils";

// Content max-width 1320px with generous outer margins (A.4).
export function Container({
  className,
  children,
  as: As = "div",
}: {
  className?: string;
  children: React.ReactNode;
  as?: React.ElementType;
}) {
  return (
    <As
      className={cn(
        "mx-auto w-full max-w-[1320px] px-6 sm:px-8 lg:px-12",
        className,
      )}
    >
      {children}
    </As>
  );
}

// Major section vertical rhythm: clamp(96px, 12vw, 200px) top and bottom (A.4).
export function Section({
  className,
  children,
  id,
  surface,
}: {
  className?: string;
  children: React.ReactNode;
  id?: string;
  surface?: "base" | "surface-1" | "paper";
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative py-[clamp(96px,12vw,200px)]",
        surface === "surface-1" && "bg-sv-surface-1",
        surface === "paper" && "bg-sv-paper text-sv-ink",
        className,
      )}
    >
      {children}
    </section>
  );
}

// The mono instrument voice — a section opener with an optional index code.
export function Eyebrow({
  children,
  live,
  className,
  code,
}: {
  children: React.ReactNode;
  live?: boolean;
  className?: string;
  code?: string;
}) {
  return (
    <p className={cn("sv-label flex items-center gap-3", live && "sv-label--live", className)}>
      {code && <span className="text-sv-text-3">{code}</span>}
      <span className={cn(live && "text-sv-green")}>{children}</span>
    </p>
  );
}
