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
