import { Container } from "./primitives";
import { Eyebrow } from "./primitives";

// Shared interior-page opener: mono eyebrow, display headline, optional lead.
// Keeps the instrument identity consistent across every page.
export function PageHero({
  eyebrow,
  code,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  code?: string;
  title: string;
  lead?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-sv-line pt-32 pb-16 lg:pb-24">
      <div className="sv-field" aria-hidden />
      <div className="sv-beam" aria-hidden />
      <Container className="relative z-10">
        <Eyebrow code={code} className="sv-reveal" live>
          {eyebrow}
        </Eyebrow>
        <h1
          className="sv-reveal sv-grad-text mt-6 max-w-4xl text-sv-display-l"
          style={{ ["--i" as string]: 1 } as React.CSSProperties}
        >
          {title}
        </h1>
        {lead && (
          <p
            className="sv-reveal mt-6 max-w-2xl text-sv-body-l text-sv-text-2"
            style={{ ["--i" as string]: 2 } as React.CSSProperties}
          >
            {lead}
          </p>
        )}
        {children}
      </Container>
    </section>
  );
}
