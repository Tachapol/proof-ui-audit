import { z } from 'zod';

export const ProductContextSchema = z.object({
  productGoal: z.string().trim().max(1000).default(''),
  brandKeywords: z.string().trim().max(300).default(''),
  themeColor: z.string().trim().regex(/^(#[0-9a-f]{3}|#[0-9a-f]{6})?$/i, 'Theme color must be a hex color such as #2563EB.').default(''),
  targetAudience: z.string().trim().max(1000).default(''),
  additionalContext: z.string().trim().max(2000).default(''),
}).strict();
export type ProductContext = z.infer<typeof ProductContextSchema>;
export const EMPTY_PRODUCT_CONTEXT: ProductContext = { productGoal: '', brandKeywords: '', themeColor: '', targetAudience: '', additionalContext: '' };
