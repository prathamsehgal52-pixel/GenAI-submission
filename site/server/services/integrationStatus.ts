import { db, schema } from '../db/client'

/** Records the latest success/failure per integration for the operator view. */
export async function markIntegration(integration: string, ok: boolean, error?: string) {
  const now = new Date()
  await db
    .insert(schema.integrationStatus)
    .values({ integration, lastSuccessAt: ok ? now : null, lastFailureAt: ok ? null : now, lastError: ok ? null : (error ?? null) })
    .onConflictDoUpdate({
      target: schema.integrationStatus.integration,
      set: ok
        ? { lastSuccessAt: now, updatedAt: now }
        : { lastFailureAt: now, lastError: (error ?? '').slice(0, 500), updatedAt: now },
    })
}
