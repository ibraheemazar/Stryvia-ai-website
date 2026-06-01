import { Container, Section } from "./primitives";
import { Bracket } from "./Bracket";
import { ChatSeedButton } from "@/components/chat/ChatSeedButton";

// A page-closing band that routes back to the conversation — every section
// feeds the one conversion path (Spec §4).
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
        <div className="relative mx-auto max-w-3xl rounded-sv-lg border border-sv-line-strong bg-sv-surface-1 p-10 text-center lg:p-16">
          <Bracket live focusIn />
          <h2 className="text-sv-h1">{title}</h2>
          <div className="mt-8 flex justify-center">
            <ChatSeedButton
              variant="primary"
              arrow={false}
              seed={seed}
              pageContext={pageContext}
              scrollToHero={false}
            >
              {cta}
            </ChatSeedButton>
          </div>
        </div>
      </Container>
    </Section>
  );
}
