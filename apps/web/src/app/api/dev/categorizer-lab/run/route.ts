import { NextRequest, NextResponse } from 'next/server';
import { isCategorizerLabEnabled } from '@/lib/flags';
import { 
  labRunRequestSchema, 
  type LabRunRequest, 
  type LabRunResponse,
  type TransactionResult
} from '@/lib/categorizer-lab/types';
import {
  mapLabTransactionToNormalized,
  createLabCategorizationContext,
  mapCategorizationResultToLab
} from '@/lib/categorizer-lab/mappers';
import { calculateMetrics } from '@/lib/categorizer-lab/metrics';
import {
  enhancedPass1Categorize,
  createDefaultPass1Context,
  scoreWithLLM,
  type CategorizationContext
} from '@nexus/categorizer';

// Force Node.js runtime for Supabase compatibility and workspace dependencies
export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Guard: Only available in development or when explicitly enabled
  if (!isCategorizerLabEnabled()) {
    return NextResponse.json(
      { error: 'Categorizer lab is not available' },
      { status: 404 }
    );
  }

  try {
    const body = await request.json();
    
    // Validate request payload
    const validatedRequest = labRunRequestSchema.parse(body) as LabRunRequest;
    const { dataset, options } = validatedRequest;

    // Process transactions based on engine mode
    const results: TransactionResult[] = [];
    const errors: string[] = [];
    
    // Create a pseudo org ID for the lab context
    const labOrgId = 'lab-org-' + Date.now();
    const ctx = createLabCategorizationContext(labOrgId) as CategorizationContext;
    
    // Process each transaction using new hybrid engine
    for (const labTx of dataset) {
      try {
        // Convert to normalized format
        const normalizedTx = mapLabTransactionToNormalized(labTx, labOrgId);

        let categorizationResult: {
          categoryId?: string;
          confidence?: number;
          rationale: string[];
        };
        let engine: 'pass1' | 'llm' = 'pass1';
        let timings = { pass1: 0, pass2: 0, total: 0 };

        const startTime = Date.now();

        switch (options.mode) {
          case 'pass1': {
            // Pass-1 only: Use enhanced Pass-1 categorizer
            const pass1Context = createDefaultPass1Context(ctx.orgId, null);
            const pass1Start = Date.now();
            const pass1Result = await enhancedPass1Categorize(normalizedTx, {
              ...ctx,
              ...pass1Context
            });
            const pass1End = Date.now();

            categorizationResult = {
              categoryId: pass1Result.categoryId as string,
              rationale: pass1Result.rationale
            };
            if (pass1Result.confidence !== undefined) {
              categorizationResult.confidence = pass1Result.confidence;
            }

            timings = {
              pass1: pass1End - pass1Start,
              pass2: 0,
              total: pass1End - startTime
            };
            engine = 'pass1';
            break;
          }

          case 'pass2': {
            // Pass-2 only: Use LLM directly
            if (!process.env.GEMINI_API_KEY) {
              throw new Error('GEMINI_API_KEY not configured - Pass-2 unavailable');
            }


            const llmStart = Date.now();
            const llmResult = await scoreWithLLM(normalizedTx, {
              ...ctx,
              db: null, // Lab environment doesn't need real DB
              config: {
                geminiApiKey: process.env.GEMINI_API_KEY,
                model: 'gemini-2.5-flash-lite'
              }
            });
            const llmEnd = Date.now();

            categorizationResult = {
              categoryId: llmResult.categoryId as string,
              confidence: llmResult.confidence,
              rationale: llmResult.rationale
            };

            timings = {
              pass1: 0,
              pass2: llmEnd - llmStart,
              total: llmEnd - startTime
            };
            engine = 'llm';
            break;
          }

          case 'hybrid': {
            // Hybrid mode: Pass-1 first, then LLM if confidence too low
            if (!process.env.GEMINI_API_KEY) {
              throw new Error('GEMINI_API_KEY not configured - Pass-2 unavailable');
            }

            // Try Pass-1 first
            const pass1Context = createDefaultPass1Context(ctx.orgId, null);
            const pass1Start = Date.now();
            const pass1Result = await enhancedPass1Categorize(normalizedTx, {
              ...ctx,
              ...pass1Context
            });
            const pass1End = Date.now();

            const threshold = options.hybridThreshold || 0.85;

            if (pass1Result.confidence && pass1Result.confidence >= threshold) {
              // Pass-1 confidence is high enough
              categorizationResult = {
                categoryId: pass1Result.categoryId as string,
                confidence: pass1Result.confidence,
                rationale: pass1Result.rationale
              };
              engine = 'pass1';
              timings = {
                pass1: pass1End - pass1Start,
                pass2: 0,
                total: pass1End - startTime
              };
            } else {
              // Use LLM for better accuracy
              const llmStart = Date.now();
              const llmResult = await scoreWithLLM(normalizedTx, {
                ...ctx,
                db: null, // Lab environment doesn't need real DB
                config: {
                  geminiApiKey: process.env.GEMINI_API_KEY,
                  model: 'gemini-2.5-flash-lite'
                }
              });
              const llmEnd = Date.now();

              categorizationResult = {
                categoryId: llmResult.categoryId as string,
                confidence: llmResult.confidence,
                rationale: llmResult.rationale
              };

              engine = 'llm';
              timings = {
                pass1: pass1End - pass1Start,
                pass2: llmEnd - llmStart,
                total: llmEnd - startTime
              };
            }
            break;
          }

          default:
            throw new Error(`Unsupported engine mode: ${options.mode}`);
        }

        // Map to lab result format
        const result = mapCategorizationResultToLab(
          labTx.id,
          categorizationResult,
          engine,
          {
            totalMs: timings.total,
            pass1Ms: timings.pass1,
            pass2Ms: timings.pass2
          }
        );

        results.push(result);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        const result = mapCategorizationResultToLab(
          labTx.id,
          {},
          'pass1', // Default engine for errors
          { totalMs: 0, pass1Ms: 0 }, // Zero timings for errors
          errorMessage
        );

        results.push(result);
        errors.push(`Transaction ${labTx.id}: ${errorMessage}`);
      }
    }
    
    // Calculate metrics
    const metrics = calculateMetrics(dataset, results);
    
    // Round confidence mean to 2 decimals for precision
    if (metrics.confidence.mean) {
      metrics.confidence.mean = Math.round(metrics.confidence.mean * 100) / 100;
    }
    
    // Add cost estimation for LLM calls
    const llmCalls = results.filter(r => r.engine === 'llm').length;
    if (llmCalls > 0) {
      const estimatedCostPerCall = 0.001; // $0.001 per call (rough estimate)
      metrics.cost = {
        estimatedUsd: llmCalls * estimatedCostPerCall,
        calls: llmCalls,
      };
    }
    
    // Determine overall status based on fixed policy
    let status: LabRunResponse['status'];
    if (errors.length === 0) {
      status = 'success';
    } else {
      // Any errors result in partial status (even if all failed per-tx)
      status = 'partial';
    }
    
    const response: LabRunResponse = {
      results,
      metrics,
      status,
      errors,
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Lab run error:', error);
    
    let errorMessage: string;
    if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = 'Unknown error occurred';
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 400 }
    );
  }
}


// Health check endpoint
export async function GET(): Promise<NextResponse> {
  if (!isCategorizerLabEnabled()) {
    return NextResponse.json(
      { available: false, message: 'Lab is disabled' },
      { status: 404 }
    );
  }
  
  return NextResponse.json({
    available: true,
    message: 'Categorizer lab is available',
    features: {
      pass1: true,
      pass2: !!process.env.GEMINI_API_KEY,
      hybrid: !!process.env.GEMINI_API_KEY,
    },
  });
}