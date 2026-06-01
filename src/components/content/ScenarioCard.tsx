import { Bracket } from "@/components/ui/Bracket";
import type { Scenario } from "@/lib/content";

// A scenario in present possibility (Spec §6.14) — never a past client story.
export function ScenarioCard({
  scenario,
  labels,
}: {
  scenario: Scenario;
  labels: { shape: string; ownership: string };
}) {
  return (
    <div className="group relative h-full overflow-hidden rounded-sv-md border border-sv-line bg-sv-surface-2 p-6 transition-colors duration-200 hover:border-sv-green-line">
      <span className="sv-scan-line" aria-hidden />
      <Bracket />
      <h3 className="font-display text-sv-h3 text-sv-text">{scenario.title}</h3>
      <p className="mt-3 text-sv-small text-sv-text-2">{scenario.problem}</p>
      <p className="mt-3 text-sv-small text-sv-text-2">{scenario.approach}</p>
      <dl className="mt-5 space-y-2 border-t border-sv-line pt-4">
        <div className="flex gap-3">
          <dt className="sv-label sv-label-sm w-24 shrink-0">{labels.shape}</dt>
          <dd className="text-sv-small text-sv-text">{scenario.shape}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="sv-label sv-label-sm w-24 shrink-0">{labels.ownership}</dt>
          <dd className="text-sv-small text-sv-green">{scenario.ownership}</dd>
        </div>
      </dl>
    </div>
  );
}
