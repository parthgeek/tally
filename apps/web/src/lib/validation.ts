import { z } from "zod";

/**
 * Common validation schemas for API requests
 */

/**
 * Schema for Plaid public token exchange request
 */
export const plaidExchangeSchema = z.object({
  public_token: z.string().min(10).max(500),
  metadata: z
    .object({
      institution_id: z.string().optional(),
      institution_name: z.string().optional(),
      accounts: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            type: z.string(),
            subtype: z.string().nullable(),
          })
        )
        .optional(),
    })
    .passthrough()
    .optional(), // Use passthrough to not trust nested data
});

export type PlaidExchangeRequest = z.infer<typeof plaidExchangeSchema>;

/**
 * Generic function to validate request body with Zod schema
 */
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: unknown }> {
  try {
    const body = await request.json();
    const validatedData = schema.parse(body);
    return { success: true, data: validatedData };
  } catch (error) {
    return { success: false, error };
  }
}
