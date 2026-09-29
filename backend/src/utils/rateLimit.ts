import { tokenHash } from './password';

/** Fixed-window limit stored in D1; keys are hashed so client IPs are not retained. */
export async function withinRateLimit(db: D1Database, key: string, maximum: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const digest = await tokenHash(key);
  const row = await db.prepare(`INSERT INTO rate_limits (key, attempts, reset_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET
      attempts = CASE WHEN reset_at <= ? THEN 1 ELSE attempts + 1 END,
      reset_at = CASE WHEN reset_at <= ? THEN ? ELSE reset_at END
    RETURNING attempts`).bind(digest, now + windowMs, now, now, now + windowMs).first<{attempts:number}>();
  return (row?.attempts ?? maximum + 1) <= maximum;
}
