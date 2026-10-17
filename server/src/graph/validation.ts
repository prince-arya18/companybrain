import { z } from 'zod';

export const idSchema = z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_.:-]+$/);
export const maxDepthSchema = z.coerce.number().int().min(1).max(8);
