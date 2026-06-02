import { Container, Section } from "./primitives";
import { Bracket } from "./Bracket";
import { ChatSeedButton } from "@/components/chat/ChatSeedButton";
import { ScrollScene } from "@/components/motion/ScrollScene";
import { WordReveal } from "@/components/motion/WordReveal";
import { Magnetic } from "@/components/motion/Magnetic";

// A page-closing band that routes back to the conversation — every section
// feeds the one conversion path (Spec §4). Rises into place on scroll, the
// title assembles, and the CTA leans toward the cursor.
export function CtaBand({
  title,
  cta,
  seed,
  pageContext,
}: {
  title: string;
  cta: string;
  seed?: string;
  pageContext?: string;
}) {
  return (
    <Section>
      <Container>
        <ScrollScene fade={false} rise={56}>
          <div className="sv-glow relative mx-auto max-w-3xl overflow-hidden rounded-sv-lg border border-sv-line-strong bg-sv-surface-1 p-10 text-center lg:p-16">
            <div className="sv-field" aria-hidden />
            <Bracket live focusIn />
            <WordReveal
              as="h2"
              gradient
              text={title}
              className="relative z-10 block text-sv-h1"
            />
            <div className="relative z-10 mt-8 flex justify-center">
              <Magnetic>
                <ChatSeedButton
                  variant="primary"
                  arrow={false}
                  seed={seed}
                  pageContext={pageContext}
                  scrollToHero={false}
                >
                  {cta}
                </ChatSeedButton>
              </Magnetic>
            </div>
          </div>
        </ScrollScene>
      </Container>
    </Section>
  );
}
