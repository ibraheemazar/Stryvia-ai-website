import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import type { MakerAttachment } from "./types";

// Turn the operator's attachments into Anthropic content blocks. Images and
// PDFs go to Claude natively (vision / document understanding); Word documents
// are converted to text with mammoth; plain text is passed through. The result
// is prepended to the user's text so Claude can "read the file and make a
// prompt out of it".

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export async function attachmentsToBlocks(
  attachments: MakerAttachment[],
): Promise<Anthropic.Messages.ContentBlockParam[]> {
  const blocks: Anthropic.Messages.ContentBlockParam[] = [];

  for (const a of attachments.slice(0, 8)) {
    try {
      if (a.kind === "image" && a.data && a.mediaType && IMAGE_TYPES.has(a.mediaType)) {
        blocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: a.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: a.data,
          },
        });
      } else if (a.kind === "pdf" && a.data) {
        blocks.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: a.data },
        });
      } else if (a.kind === "docx" && a.data) {
        const buffer = Buffer.from(a.data, "base64");
        const { value } = await mammoth.extractRawText({ buffer });
        blocks.push({
          type: "text",
          text: `Contents of attached document "${a.name}":\n\n${value.slice(0, 20000)}`,
        });
      } else if (a.kind === "text" && a.text) {
        blocks.push({
          type: "text",
          text: `Contents of attached file "${a.name}":\n\n${a.text.slice(0, 20000)}`,
        });
      }
    } catch (err) {
      console.error(`[stryvia] attachment "${a.name}" failed:`, err);
      blocks.push({ type: "text", text: `(Could not read attachment "${a.name}".)` });
    }
  }

  return blocks;
}
