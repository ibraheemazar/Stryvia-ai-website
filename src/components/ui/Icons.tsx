// Clean line icons for the feature bento and capability cards. Stroke uses
// currentColor so they tint with the chip color.
type P = { className?: string; size?: number };
const base = (size = 22) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const IconProduct = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M12 2 3 7v10l9 5 9-5V7z" /><path d="M3 7l9 5 9-5M12 12v10" /></svg>
);
export const IconVenture = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M5 15c-2 2-2 5-2 5s3 0 5-2m0-3a16 16 0 0 1 9-9c3 0 3 0 3 0s0 0 0 3a16 16 0 0 1-9 9z" /><circle cx="15" cy="9" r="1.4" /></svg>
);
export const IconCreative = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /></svg>
);
export const IconMarketing = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M3 11v2l13 5V6L3 11z" /><path d="M16 8a4 4 0 0 1 0 8M7 13v5h3" /></svg>
);
export const IconOperations = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></svg>
);
export const IconFinance = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
);
export const IconStrategy = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="12" r="9" /><path d="M16 8l-5 2-1 6 5-2z" /></svg>
);
export const IconBolt = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M13 2 4 14h6l-1 8 9-12h-6z" /></svg>
);
export const IconInfinity = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M7 9a3 3 0 1 0 0 6c2 0 3-3 5-3s3 3 5 3a3 3 0 1 0 0-6c-2 0-3 3-5 3s-3-3-5-3z" /></svg>
);
