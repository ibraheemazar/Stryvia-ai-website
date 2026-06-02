"use client";

import { useChat } from "@/components/chat/ChatProvider";
import { Bracket } from "@/components/ui/Bracket";

export type SeedTile = {
  title: string;
  subtitle?: string;
  meta?: string;
  seed: string;
  pageContext?: string;
};

// A grid of tiles that each open the Chat seeded with a real problem
// (Spec §6.6 / §6.14). The click is the conversion mechanism.
export function SeedTiles({
  tiles,
  action,
  columns = 3,
}: {
  tiles: SeedTile[];
  action?: string;
  columns?: 2 | 3;
}) {
  const { open, send } = useChat();

  function start(tile: SeedTile) {
    void send(tile.seed);
    open({ pageContext: tile.pageContext });
  }

  return (
    <div
      className={`grid gap-4 ${
        columns === 2 ? "md:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"
      }`}
    >
      {tiles.map((tile, i) => (
        <button
          key={i}
          type="button"
          onClick={() => start(tile)}
          style={{ ["--i" as string]: i } as React.CSSProperties}
          className="sv-card sv-rise-strong group relative flex h-full flex-col overflow-hidden rounded-sv-md border border-sv-line bg-sv-surface-2 p-6 text-start"
        >
          <span className="sv-scan-line" aria-hidden />
          <Bracket />
          {tile.meta && <p className="sv-label-sm sv-label">{tile.meta}</p>}
          <p className="mt-3 flex-1 font-display text-sv-h3 text-sv-text">{tile.title}</p>
          {tile.subtitle && (
            <p className="mt-2 text-sv-small text-sv-text-2">{tile.subtitle}</p>
          )}
          {action && (
            <span className="mt-5 font-mono text-sv-label uppercase tracking-[0.14em] text-sv-text-3 transition-colors group-hover:text-sv-green">
              {action} →
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
