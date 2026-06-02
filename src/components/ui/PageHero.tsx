import { Container, Eyebrow } from "./primitives";
import { WordReveal } from "@/components/motion/WordReveal";
import { Parallax } from "@/components/motion/Parallax";

// Shared interior-page opener: mono eyebrow, display headline, optional lead.
// Keeps the instrument identity consistent across every page — now with the
// same cinematic language as the home hero (word-assemble title + parallax
// depth), so motion is coherent site-wide.
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
        <Parallax speed={18}>
          <Eyebrow code={code} className="sv-reveal" live>
            {eyebrow}
          </Eyebrow>
          <WordReveal
            as="h1"
            gradient
            stagger={42}
            text={title}
            className="mt-6 block max-w-4xl text-sv-display-l"
          />
          {lead && (
            <p
              className="sv-reveal mt-6 max-w-2xl text-sv-body-l text-sv-text-2"
              style={{ ["--i" as string]: 2 } as React.CSSProperties}
            >
              {lead}
            </p>
          )}
        </Parallax>
        {children}
      </Container>
    </section>
  );
}
