import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

// A.8 buttons. Primary green is reserved for Start and the in-Chat
// "Let's build this together" — do not scatter it.
type Variant = "primary" | "secondary" | "ghost";

const base =
  "relative inline-flex items-center justify-center gap-2 rounded-sv-sm " +
  "font-medium transition-all duration-200 ease-sv " +
  "min-h-11 px-5 py-2.5 text-sv-body select-none " +
  "focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary:
    "sv-btn-glow bg-sv-green text-sv-ink hover:-translate-y-px " +
    "active:translate-y-0 active:bg-sv-green-press disabled:bg-sv-surface-3 disabled:text-sv-text-3 disabled:shadow-none",
  secondary:
    "border border-sv-line-strong text-sv-text hover:border-sv-green-line hover:text-sv-green " +
    "active:bg-sv-surface-3 overflow-hidden group",
  ghost: "text-sv-text hover:text-sv-green px-1 min-h-0 py-1 group",
};

type CommonProps = {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
  arrow?: boolean;
};

type ButtonAsButton = CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type ButtonAsLink = CommonProps & {
  href: string;
  prefetch?: boolean;
};

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant = "secondary", className, children, arrow } = props;
  const classes = cn(base, variants[variant], className);

  const inner = (
    <>
      {variant === "secondary" && <span className="sv-scan-line" aria-hidden />}
      <span className="relative z-[1] inline-flex items-center gap-2">
        {children}
        {arrow && (
          <span className="font-mono transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5">
            →
          </span>
        )}
      </span>
    </>
  );

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} prefetch={props.prefetch} className={classes}>
        {inner}
      </Link>
    );
  }

  const { variant: _v, className: _c, children: _ch, arrow: _a, href: _h, ...rest } =
    props as ButtonAsButton & { href?: undefined };
  void _v;
  void _c;
  void _ch;
  void _a;
  void _h;

  return (
    <button className={classes} {...rest}>
      {inner}
    </button>
  );
}
