import "server-only";
import { TurnBusyError } from "./engine";
import { acquireTurnLock, releaseTurnLock } from "./store";

// One lock per session for every operation that mutates the conversation or
// the brief: visitor turns, retries, finishing, translating, revising, saving
// an edit, submitting. They all share `lab_sessions.pending_turn_id`, so a
// turn still streaming blocks a finish, and a translation in flight blocks an
// edit — nothing can overwrite anything else mid-operation. Held locks expire
// after `ttlSeconds` so a crashed function never freezes a session.

export async function withSessionLock<T>(sessionId: string, key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const token = `${key}:${Date.now().toString(36)}`;
  const locked = await acquireTurnLock(sessionId, token, ttlSeconds);
  if (!locked) throw new TurnBusyError();
  try {
    return await fn();
  } finally {
    await releaseTurnLock(sessionId, token);
  }
}
