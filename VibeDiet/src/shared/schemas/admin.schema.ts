import { z } from 'zod';

export const AdminKeyAddSchema = z
  .object({
    keyString: z.string().optional(),
    keys: z.union([z.array(z.string()), z.string()]).optional(),
  })
  .strict();

export const AdminKeySlotTelemetrySchema = z.object({
  id: z.string(),
  maskedKey: z.string(),
  requests: z.number().int().min(0),
  errors: z.number().int().min(0),
  lastLatencyMs: z.number().nullable(),
  cooldownUntil: z.number().nullable(),
  status: z.enum(['healthy', 'cooldown', 'revoked']),
});

export const AdminOverviewResponseSchema = z.object({
  status: z.string(),
  configuredCount: z.number(),
  activeCount: z.number(),
  cooldownCount: z.number(),
  revokedCount: z.number(),
  slots: z.array(AdminKeySlotTelemetrySchema),
  memory: z.object({
    rssMb: z.number(),
    heapUsedMb: z.number(),
  }),
});
