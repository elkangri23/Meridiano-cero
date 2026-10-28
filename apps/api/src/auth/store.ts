import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Database } from '../database/connection.ts';
import { profiles, sessions } from '../database/schema.ts';

export function tokenDigest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
export function createSessionStore(database: Database) {
  return {
    async create(previous: string | undefined) {
      return database.orm.transaction(async tx => {
        // Serialize the single local profile's rotations, including concurrent tabs.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(28012027)`);
        const available = await tx.select().from(profiles).where(eq(profiles.localKey, 'development'));
        const profile = available[0];
        if (!profile) throw new Error('LOCAL_PROFILE_MISSING');
        if (previous) await tx.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.tokenHash, tokenDigest(previous)), eq(sessions.profileId, profile.id)));
        const token = randomBytes(32).toString('base64url');
        const csrfToken = randomBytes(32).toString('base64url');
        const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
        await tx.insert(sessions).values({ tokenHash: tokenDigest(token), profileId: profile.id, csrfToken, expiresAt });
        return { token, csrfToken, profile: { id: profile.id, displayName: profile.displayName, role: profile.role } };
      });
    },
    async find(token: string | undefined) {
      if (!token) return undefined;
      const found = await database.orm.select({
        csrfToken: sessions.csrfToken,
        profile: { id: profiles.id, displayName: profiles.displayName, role: profiles.role },
      }).from(sessions).innerJoin(profiles, eq(sessions.profileId, profiles.id))
        .where(and(eq(sessions.tokenHash, tokenDigest(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())));
      return found[0];
    },
    async revoke(token: string) {
      await database.orm.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, tokenDigest(token)));
    },
  };
}
