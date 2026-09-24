// Deterministic, offline test environment. No real keys, no network.
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.LAB_AI_PROVIDER = "mock";
process.env.LAB_MAIL_PROVIDER = "log";
process.env.LAB_COOKIE_SECRET = process.env.LAB_COOKIE_SECRET || "test-cookie-secret-0123456789";
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-role";
process.env.NEXT_PUBLIC_SITE_URL = "https://stryvia.ai";
delete process.env.VERCEL_ENV;
