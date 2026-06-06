export type ConversationRow = {
  id: string;
  created_at: string;
  updated_at: string;
  locale: string;
  page_context: string | null;
  status: string;
  problem_category: string | null;
  summary: string | null;
  converted: boolean;
  score: number;
  lead: { name: string; email: string; company: string | null; status: string } | null;
};

export type CrmInsights = {
  total: number;
  converted: number;
  conversionRate: number;
  categoryCounts: Record<string, number>;
  statusCounts: Record<string, number>;
};

export type CrmDataResponse = {
  ok: boolean;
  reason?: string;
  insights: CrmInsights;
  conversations: ConversationRow[];
};
