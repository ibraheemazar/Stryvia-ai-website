import { Fragment } from "react";

// Small, dependency-free markdown renderer tuned for the Chat. It handles
// paragraphs, bold, bullet lists, and — the point — it elevates a line that is
// only a bold label (the four scope labels the model emits) into a green mono
// label, so the assistant's reply reads like the structured scope panel from A.8
// without brittle parsing.

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  parts.forEach((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      nodes.push(
        <strong key={`${keyBase}-b${i}`} className="font-semibold text-sv-text">
          {part.slice(2, -2)}
        </strong>,
      );
    } else if (part) {
      nodes.push(<Fragment key={`${keyBase}-t${i}`}>{part}</Fragment>);
    }
  });
  return nodes;
}

const BOLD_ONLY = /^\*\*(.+)\*\*[:：]?\s*$/;

export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);

  return (
    <div className="space-y-3 leading-relaxed">
      {blocks.map((block, bi) => {
        const lines = block.split("\n");

        // A block that is a single bold-only line → scope label.
        if (lines.length === 1) {
          const m = lines[0].match(BOLD_ONLY);
          if (m) {
            return (
              <p key={bi} className="sv-label sv-label--live pt-1">
                {m[1]}
              </p>
            );
          }
        }

        // Bullet list.
        if (lines.every((l) => /^\s*[-*]\s+/.test(l)) && lines.length > 0) {
          return (
            <ul key={bi} className="space-y-1.5 ps-1">
              {lines.map((l, li) => (
                <li key={li} className="flex gap-2 text-sv-text-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sv-green" />
                  <span>{renderInline(l.replace(/^\s*[-*]\s+/, ""), `${bi}-${li}`)}</span>
                </li>
              ))}
            </ul>
          );
        }

        // Mixed block: render each line, promoting bold-only lines to labels.
        return (
          <div key={bi} className="space-y-1.5">
            {lines.map((l, li) => {
              const m = l.match(BOLD_ONLY);
              if (m) {
                return (
                  <p key={li} className="sv-label sv-label--live pt-1">
                    {m[1]}
                  </p>
                );
              }
              return (
                <p key={li} className="text-sv-text-2">
                  {renderInline(l, `${bi}-${li}`)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
