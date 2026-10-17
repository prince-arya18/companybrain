import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../');
dotenv.config({ path: resolve(projectRoot, '.env') });

const falkorConnectionUrlSchema = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return ['falkor:', 'redis:', 'rediss:'].includes(url.protocol)
      && url.hostname.length > 0
      && url.port.length > 0;
  } catch {
    return false;
  }
}, { message: 'Expected falkor://, redis://, or rediss:// URL with host and port' });

const envSchema = z.object({
  FALKORDB_URL: falkorConnectionUrlSchema,
  FALKORDB_TLS: z.enum(['true', 'false']).default('false'),
  FALKORDB_GRAPH: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).default('mygraph'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
});

export const config = envSchema.parse(process.env);
