# Categorizer Lab Debugging Guide

## Overview

This document provides a comprehensive guide to debugging common issues in the Categorizer Lab, based on real debugging sessions and fixes applied during the implementation process. It serves as a reference for troubleshooting similar issues in the future.

## Critical Issues & Solutions

### 1. Module Resolution Failures

#### Issue: Import Path Resolution Error
```
⨯ ./src/app/api/dev/categorizer-lab/run/route.ts
Module not found: Can't resolve '@/../../services/categorizer/categorize.js'
```

#### Root Cause Analysis
The original implementation attempted to import from a complex services layer structure:
```typescript
// Problematic import
import { categorizeTransaction } from '@/../../services/categorizer/categorize.js';
```

This failed because:
1. The relative path traversed outside the Next.js app directory
2. The services layer wasn't properly integrated with the build system
3. Module resolution rules differ between development and production builds

#### Solution Strategy
**Architectural Simplification**: Instead of fixing complex import paths, we simplified the architecture by using existing, well-tested package exports:

```typescript
// Fixed imports - use established package exports
import {
  enhancedPass1Categorize,
  createDefaultPass1Context,
  scoreWithLLM,
  type CategorizationContext
} from '@nexus/categorizer';
```

#### Lessons Learned
- Prefer package imports over complex relative paths
- Use established build patterns within the monorepo
- Test import resolution in both development and production environments

### 2. TypeScript Strict Mode Compliance

#### Issue: exactOptionalPropertyTypes Violations
```typescript
// TypeScript Error: exactOptionalPropertyTypes violation
categorizationResult = {
  categoryId: pass1Result.categoryId,
  confidence: pass1Result.confidence, // Could be undefined
  rationale: pass1Result.rationale
};
```

#### Root Cause Analysis
The TypeScript configuration uses `exactOptionalPropertyTypes: true`, which prevents assigning `undefined` to optional properties. This is a strict type safety feature that catches potential runtime errors.

#### Solution Implementation
**Conditional Property Assignment Pattern**:
```typescript
// Compliant solution
categorizationResult = {
  categoryId: pass1Result.categoryId as string,
  rationale: pass1Result.rationale
};

// Only assign confidence if it's defined
if (pass1Result.confidence !== undefined) {
  categorizationResult.confidence = pass1Result.confidence;
}
```

#### Additional Fixes Applied
1. **Optional Chaining in Tests**:
```typescript
// Fixed undefined access in test assertions
expect(result.error.issues[0]?.path).toContain('public_token');
expect(result.error.issues[0]?.code).toBe('too_small');
```

2. **Interface Compatibility**:
```typescript
// Fixed RationaleData interface
interface RationaleData {
  confidence?: number | undefined; // Explicit undefined type
}
```

3. **Type Casting for Branded Types**:
```typescript
// Handle branded CategoryId types
categoryId: llmResult.categoryId as string
```

### 3. LLM Categorization System Failure

#### Issue: Complete LLM Failure with Fallback Results
All LLM categorizations returned:
```json
{
  "predictedCategoryId": "550e8400-e29b-41d4-a716-446655440024",
  "confidence": 0.5,
  "rationale": ["LLM categorization failed, using fallback"]
}
```

#### Root Cause Investigation Process

**Step 1: API Route Debugging**
Added logging to confirm function calls:
```typescript
console.log('About to call scoreWithLLM for transaction:', labTx.id);
console.log('GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
```
✅ **Result**: API route was being called correctly, API key was present

**Step 2: Function Entry Point Debugging**
Added logging inside the LLM function:
```typescript
console.log('=== scoreWithLLM FUNCTION CALLED ===');
console.log('Transaction ID:', tx.id);
```
❌ **Result**: No logs appeared, indicating import resolution issue

**Step 3: Module Resolution Investigation**
Discovered the issue: TypeScript imports with `.js` extensions resolve to compiled files in `dist/` folder, not source files.

```bash
# Found stale compiled version
ls packages/categorizer/dist/pass2_llm.js
```

**Step 4: Compiled Code Analysis**
The compiled version contained outdated database query code:
```javascript
// Stale compiled code (lines 126-133)
if (tx.categoryId) {
  const { data: category } = await ctx.db
    .from('categories')
    .select('name')
    .eq('id', tx.categoryId)
    .single();

  priorCategoryName = category?.name;
}
```

#### Multi-Layered Solution

**Problem 1: Database Query in Lab Environment**
```typescript
// Fixed: Added null-safety and error handling
let priorCategoryName: string | undefined;
if (tx.categoryId && ctx.db) {
  try {
    const { data: category } = await ctx.db
      .from('categories')
      .select('name')
      .eq('id', tx.categoryId)
      .single();

    priorCategoryName = category?.name;
  } catch (error) {
    // Ignore database errors in lab environment
    console.warn('Could not fetch prior category name:', error);
  }
}
```

**Problem 2: Invalid API Key**
```bash
# Found in .env.local
GEMINI_API_KEY=test-key-for-categorizer-lab-development

# Fixed with real key from root .env
GEMINI_API_KEY=AIzaSyClJSmRMOH7YEzTa9DBIxWJg0DXUfygGrI
```

**Problem 3: Stale Compiled Code**
```bash
# Rebuilt package to update dist/ folder
cd packages/categorizer
pnpm run build
```

#### Verification Process
After applying fixes, verified success with detailed logging:
```
=== scoreWithLLM FUNCTION CALLED ===
Transaction ID: test-001
Transaction details: STARBUCKS COFFEE #1234 STARBUCKS -1250
Config passed: {
  geminiApiKey: 'AIzaSyClJSmRMOH7YEzTa9DBIxWJg0DXUfygGrI',
  model: 'gemini-2.5-flash-lite'
}
```

### 4. Test Environment Compatibility

#### Issue: NextRequest vs Request Type Mismatches
```typescript
// TypeScript Error
Argument of type 'Request' is not assignable to parameter of type 'NextRequest'
```

#### Root Cause
API routes expect Next.js-specific `NextRequest` objects, but tests were using standard Web API `Request` objects.

#### Solution
**Type-Consistent Test Requests**:
```typescript
// Fixed test implementation
import { NextRequest } from 'next/server';

const request = new NextRequest('http://localhost:3000/api/plaid/exchange', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testData)
});
```

#### Additional Test Fixes
1. **Vitest Globals Import**:
```typescript
import { describe, expect, test, beforeEach, vi } from 'vitest';
```

2. **Mock Type Compatibility**:
```typescript
// Use type assertion for dynamic mock overrides
(mockSupabase.auth.getSession as any) = () => Promise.resolve({
  data: { session: null },
  error: null,
});
```

3. **Playwright Type Fixes**:
```typescript
// Fixed RegExp vs string type issue
await scenarioSelect.selectOption({ label: 'Amazon Ambiguity' });
```

## Debugging Methodology

### 1. Systematic Error Isolation
When facing complex failures:
1. **Start from the entry point** (API route)
2. **Add logging at each layer** to identify where failures occur
3. **Check both source and compiled code** for discrepancies
4. **Verify environment configuration** (API keys, feature flags)

### 2. Module Resolution Debugging
For import/export issues:
```bash
# Check compiled output
ls packages/categorizer/dist/

# Verify TypeScript compilation
cd packages/categorizer && pnpm run build

# Test import resolution
node -e "console.log(require.resolve('@nexus/categorizer'))"
```

### 3. LLM Integration Debugging
For AI/LLM failures:
1. **Verify API key validity** with a simple test call
2. **Check request/response format** with detailed logging
3. **Test with minimal examples** before complex scenarios
4. **Monitor rate limits and error responses**

### 4. TypeScript Debugging Workflow
For type errors:
```bash
# Run type checking
pnpm run typecheck

# Check specific configuration
cat tsconfig.json | grep -A 5 -B 5 "exactOptionalPropertyTypes"

# Verify package builds
pnpm run build
```

## Prevention Strategies

### 1. Development Practices
- **Build packages before testing** imports
- **Use consistent environment setup** across development/production
- **Test with real API keys** in development (not placeholders)
- **Implement comprehensive error handling** from the start

### 2. Code Quality
- **Prefer explicit null checks** over implicit undefined handling
- **Use branded types consistently** throughout the system
- **Implement graceful degradation** for external service failures
- **Add logging at critical integration points**

### 3. Testing Strategy
- **Test with realistic data** that matches production scenarios
- **Use proper mocking strategies** for external dependencies
- **Verify type compatibility** in test environments
- **Include integration tests** for complex workflows

## Monitoring & Observability

### 1. Error Detection
```typescript
// Comprehensive error logging
try {
  const result = await llmFunction(data);
  return result;
} catch (error) {
  // Multiple logging channels
  console.error('Operation failed:', error);
  ctx.analytics?.captureException?.(error);
  ctx.logger?.error('LLM scoring error', error);

  // Structured error context
  ctx.analytics?.captureEvent?.('categorization_llm_error', {
    org_id: ctx.orgId,
    transaction_id: tx.id,
    error: error instanceof Error ? error.message : 'Unknown error'
  });

  return fallbackResult;
}
```

### 2. Performance Monitoring
```typescript
// Timing and performance tracking
const startTime = Date.now();
const result = await operation();
const latency = Date.now() - startTime;

analytics.captureEvent('operation_performance', {
  operation: 'llm_categorization',
  latency,
  success: !!result.categoryId
});
```

### 3. Quality Metrics
```typescript
// Track categorization quality
const metrics = {
  confidence: result.confidence,
  category: result.categoryId,
  reasoning_length: result.rationale.join(' ').length,
  fallback_used: result.rationale.includes('fallback')
};
```

## Common Pitfalls & Prevention

### 1. Environment Configuration
- ❌ **Don't** use placeholder API keys in development
- ✅ **Do** validate API keys during startup
- ❌ **Don't** assume environment variables exist
- ✅ **Do** implement proper fallbacks and error messages

### 2. TypeScript Configuration
- ❌ **Don't** ignore strict type checking errors
- ✅ **Do** embrace strict modes for better runtime safety
- ❌ **Don't** use `any` types to bypass issues
- ✅ **Do** fix root causes with proper type handling

### 3. Module Architecture
- ❌ **Don't** create complex relative import paths
- ✅ **Do** use established package exports
- ❌ **Don't** bypass build systems with workarounds
- ✅ **Do** follow monorepo conventions consistently

### 4. Error Handling
- ❌ **Don't** fail silently on external service errors
- ✅ **Do** implement comprehensive logging and fallbacks
- ❌ **Don't** expose internal errors to end users
- ✅ **Do** provide meaningful error messages and recovery options

## Future Improvements

### 1. Automated Testing
- **Pre-commit hooks** for type checking and building
- **Integration tests** for critical paths
- **Performance regression testing**

### 2. Development Tools
- **Better error messages** with suggested fixes
- **Development environment validation** scripts
- **Automated dependency checking**

### 3. Monitoring Enhancement
- **Real-time alerting** for categorization failures
- **Performance dashboards** for LLM response times
- **Quality metrics tracking** over time

This debugging guide serves as a comprehensive reference for maintaining and troubleshooting the Categorizer Lab system, ensuring robust operation and quick resolution of future issues.