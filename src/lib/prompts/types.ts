// Shared Prompt-library types, used by the admin client view and the server
// routes.

export type Prompt = {
  id: string;
  title: string;
  body: string;
  category: string | null;
  tags: string[];
  variables: string[];
  favorite: boolean;
  use_count: number;
  created_at: string;
  updated_at: string;
};

// What the AI returns when classifying (and optionally improving) a prompt.
export type Classification = {
  title: string;
  category: string;
  tags: string[];
  improved: string | null;
};

// A file the operator attaches to the AI maker so Claude can read it and turn
// it into a prompt. Images and PDFs are sent to Claude natively; Word and plain
// text are reduced to text. `data` is base64 (no data: prefix) for binary
// kinds; `text` carries the already-extracted text kind.
export type MakerAttachment = {
  name: string;
  kind: "image" | "pdf" | "docx" | "text";
  mediaType?: string; // for images: image/png | image/jpeg | image/gif | image/webp
  data?: string; // base64 for image / pdf / docx
  text?: string; // for the text kind
};
