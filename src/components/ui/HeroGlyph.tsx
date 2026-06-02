// A deterministic, on-brand hero figure: a seeded constellation of nodes joined
// by hairlines, framed by focus arcs, with a single green live signal. Pure and
// server-rendered (no client JS), so it prerenders and stays SSG. Distinct per
// page because the geometry is derived from a string seed — atmosphere with
// identity, never spectacle (Spec A.6: motion/visuals serve atmosphere).

type Pt = { x: number; y: number };

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function HeroGlyph({
  seed,
  className,
}: {
  seed: string;
  className?: string;
}) {
  const rng = mulberry32(hashString(seed) || 1);
  const SIZE = 400;
  const pad = 56;
  const span = SIZE - pad * 2;

  // Loose jittered grid so nodes never collide but never look mechanical.
  const cols = 3;
  const rows = 4;
  const cells: Pt[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ x: c, y: r });
    }
  }
  // Shuffle and take a seeded subset for variety per page.
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const count = 8 + Math.floor(rng() * 3); // 8–10 nodes
  const nodes: Pt[] = cells.slice(0, count).map((cell) => ({
    x: pad + ((cell.x + 0.5 + (rng() - 0.5) * 0.7) / cols) * span,
    y: pad + ((cell.y + 0.5 + (rng() - 0.5) * 0.7) / rows) * span,
  }));

  // The live node — the one the green signal flows to.
  const liveIdx = Math.floor(rng() * nodes.length);

  // Connect each node to its nearest neighbour (dedup undirected pairs).
  const edges: [number, number][] = [];
  const seen = new Set<string>();
  nodes.forEach((n, i) => {
    let best = -1;
    let bestD = Infinity;
    nodes.forEach((m, j) => {
      if (i === j) return;
      const d = (n.x - m.x) ** 2 + (n.y - m.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    });
    if (best >= 0) {
      const key = i < best ? `${i}-${best}` : `${best}-${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([i, best]);
      }
    }
  });

  const live = nodes[liveIdx];

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={className}
      role="presentation"
      aria-hidden="true"
      fill="none"
    >
      {/* Focus arcs around the live node */}
      {[64, 104].map((r, i) => (
        <circle
          key={r}
          cx={live.x}
          cy={live.y}
          r={r}
          stroke="var(--color-sv-line-strong)"
          strokeWidth="1"
          strokeDasharray={i === 0 ? "2 7" : "1 10"}
          opacity={0.7}
        />
      ))}

      {/* Hairline links */}
      {edges.map(([a, b], i) => {
        const touchesLive = a === liveIdx || b === liveIdx;
        return (
          <line
            key={i}
            x1={nodes[a].x}
            y1={nodes[a].y}
            x2={nodes[b].x}
            y2={nodes[b].y}
            stroke={touchesLive ? "var(--color-sv-green-line)" : "var(--color-sv-line-strong)"}
            strokeWidth={touchesLive ? 1.25 : 1}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((n, i) => {
        if (i === liveIdx) return null;
        return <circle key={i} cx={n.x} cy={n.y} r={2.5} fill="var(--color-sv-line-strong)" />;
      })}

      {/* The live signal — gently pulsing, with a soft glow */}
      <circle
        cx={live.x}
        cy={live.y}
        r={12}
        stroke="var(--color-sv-green-line)"
        strokeWidth="1"
        className="sv-pulse-node"
      />
      <circle
        cx={live.x}
        cy={live.y}
        r={5}
        fill="var(--color-sv-green)"
        style={{ filter: "drop-shadow(0 0 6px var(--color-sv-green-soft))" }}
      />
    </svg>
  );
}
