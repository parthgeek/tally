/**
 * Universal Pass2 LLM Categorization with Attribute Extraction
 * 
 * This module categorizes transactions using the universal taxonomy
 * and extracts industry-specific attributes instead of relying on
 * vendor-specific categories.
 */

import type { NormalizedTransaction } from '@nexus/types';
import { GeminiClient } from './gemini-client.js';
import {
  buildUniversalPrompt,
  parseLLMResponse,
  isValidCategorySlug,
  type PromptContext,
  type LLMResponse,
} from './prompt.js';
import {
  mapCategorySlugToId,
  validateAttributes,
  type Industry,
} from './taxonomy.js';
import { calibrateLLMConfidence } from './engine/scorer.js';

export interface UniversalCategorizationContext {
  industry: Industry;
  orgId: string;
  pass1Context?: {
    categoryId?: string;
    confidence?: number;
    signals?: string[];
  };
  config?: {
    geminiApiKey?: string;
    model?: string;
    temperature?: number;
  };
  analytics?: any;
  logger?: any;
}

export interface UniversalCategorizationResult {
  categoryId: string;
  confidence: number;
  attributes: Record<string, string>;
  rationale: string[];
  llmTraceId?: string;
}

/**
 * Categorize transaction using universal taxonomy + attribute extraction
 */
export async function categorizeWithUniversalLLM(
  transaction: NormalizedTransaction,
  context: UniversalCategorizationContext
): Promise<UniversalCategorizationResult> {
  const rationale: string[] = [];
  const startTime = Date.now();

  try {
    // Initialize Gemini client
    const apiKey = context.config?.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const geminiClient = new GeminiClient({
      apiKey,
      model: context.config?.model || 'gemini-2.0-flash-exp',
      temperature: context.config?.temperature ?? 1.0, // Default to 1.0 for better accuracy
    });

    // Build prompt with industry context
    const promptContext: PromptContext = {
      industry: context.industry,
      transaction: {
        description: transaction.description,
        merchantName: transaction.merchantName ?? null,
        amount: parseFloat(transaction.amountCents) / 100, // Convert cents to dollars
        mcc: transaction.mcc ?? null,
        date: transaction.date,
      },
      ...(context.pass1Context && { pass1Context: context.pass1Context }),
    };

    const prompt = buildUniversalPrompt(promptContext);

    // Log prompt for debugging (can be removed in production)
    if (context.logger?.debug) {
      context.logger.debug('Universal LLM Prompt:', {
        transaction_id: transaction.id,
        industry: context.industry,
        merchant: transaction.merchantName,
        prompt_length: prompt.length,
      });
    }

    // Call LLM
    const response = await geminiClient.generateContent(prompt);
    const latency = Date.now() - startTime;

    // Parse response
    const parsed: LLMResponse = parseLLMResponse(response.text);

    // Validate category slug
    if (!isValidCategorySlug(parsed.category_slug, context.industry)) {
      rationale.push(
        `LLM returned invalid category "${parsed.category_slug}" for ${context.industry}, falling back to miscellaneous`
      );
      parsed.category_slug = 'miscellaneous';
      parsed.confidence = 0.3;
    }

    // Map slug to ID
    const categoryId = mapCategorySlugToId(parsed.category_slug);

    // Validate and clean attributes
    const validatedAttributes = validateAndCleanAttributes(
      parsed.category_slug,
      parsed.attributes || {},
      rationale
    );

    // Calibrate confidence
    const hasStrongPass1Signal =
      context.pass1Context?.confidence !== undefined && context.pass1Context.confidence >= 0.80;
    const calibratedConfidence = calibrateLLMConfidence(parsed.confidence, hasStrongPass1Signal);

    // Add rationale entries
    rationale.push(parsed.rationale);
    rationale.push(
      `Confidence: raw=${parsed.confidence.toFixed(3)}, calibrated=${calibratedConfidence.toFixed(3)}`
    );
    rationale.push(`Latency: ${latency}ms`);

    if (Object.keys(validatedAttributes).length > 0) {
      rationale.push(`Attributes: ${JSON.stringify(validatedAttributes)}`);
    }

    // Track analytics
    if (context.analytics?.capture) {
      context.analytics.capture('categorization_llm_universal', {
        org_id: context.orgId,
        industry: context.industry,
        category_slug: parsed.category_slug,
        raw_confidence: parsed.confidence,
        calibrated_confidence: calibratedConfidence,
        attributes_count: Object.keys(validatedAttributes).length,
        has_pass1_context: !!context.pass1Context?.categoryId,
        latency_ms: latency,
        model: context.config?.model || 'gemini-2.0-flash-exp',
      });
    }

    // Track categorization completion (PostHog)
    if (context.analytics?.captureEvent) {
      context.analytics.captureEvent('universal_categorization_completed', {
        category_slug: parsed.category_slug,
        category_id: categoryId,
        confidence: calibratedConfidence,
        has_attributes: Object.keys(validatedAttributes).length > 0,
        attribute_count: Object.keys(validatedAttributes).length,
        industry: context.industry,
        model: context.config?.model || 'gemini-2.5-flash-lite',
        latency_ms: latency,
      });

      // Track attribute extraction separately if attributes were extracted
      if (Object.keys(validatedAttributes).length > 0) {
        context.analytics.captureEvent('attributes_extracted', {
          category_slug: parsed.category_slug,
          category_id: categoryId,
          attributes: Object.keys(validatedAttributes),
          attribute_values: validatedAttributes,
          industry: context.industry,
        });
      }
    }

    return {
      categoryId,
      confidence: calibratedConfidence,
      attributes: validatedAttributes,
      rationale,
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    
    // Log error
    console.error('Universal LLM categorization failed:', error);
    rationale.push(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    rationale.push(`Latency: ${latency}ms`);

    // Track error
    if (context.analytics?.capture) {
      context.analytics.capture('categorization_llm_error', {
        org_id: context.orgId,
        industry: context.industry,
        error: error instanceof Error ? error.message : 'Unknown error',
        latency_ms: latency,
      });
    }

    // Fallback to miscellaneous with low confidence
    return {
      categoryId: mapCategorySlugToId('miscellaneous'),
      confidence: 0.25,
      attributes: {},
      rationale,
    };
  }
}

/**
 * Validate and clean attributes against category schema
 */
function validateAndCleanAttributes(
  categorySlug: string,
  attributes: Record<string, any>,
  rationale: string[]
): Record<string, string> {
  if (!attributes || Object.keys(attributes).length === 0) {
    return {};
  }

  // Validate attributes
  const validation = validateAttributes(categorySlug, attributes);

  // Log validation warnings
  if (!validation.valid) {
    rationale.push(`Attribute validation warnings: ${validation.errors.join('; ')}`);
  }

  // Clean attributes (convert all values to strings, remove nulls/undefined)
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== null && value !== undefined && value !== '') {
      // Convert to string
      cleaned[key] = String(value);
    }
  }

  return cleaned;
}

/**
 * Helper: Get industry for organization
 * (Default to 'ecommerce' for now, can be enhanced later)
 */
export function getOrganizationIndustry(_orgId: string): Industry {
  // TODO: Query from database when industry is stored per org
  // For now, default to ecommerce
  return 'ecommerce';
}

