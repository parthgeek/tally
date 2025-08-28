# Analytics Package Architecture Fix - Implementation Plan

## 🔍 **Problem Summary**

The development environment is failing due to server-side code being bundled for client-side execution, causing Webpack errors when trying to resolve Node.js built-ins like `node:fs`.

### **Root Cause**
- The `@nexus/analytics` package exports both client and server code from a single entry point
- Client-side imports (`instrumentation-client.ts`) pull in server dependencies (`posthog-node`)
- Next.js 15 + Webpack cannot bundle Node.js built-ins for browser execution

### **Error Chain**
```
instrumentation-client.ts → @nexus/analytics → posthog-server.js → posthog-node → node:fs
```

## 🎯 **Implementation Goals**

1. **Immediate**: Restore development environment functionality
2. **Short-term**: Proper client/server code separation
3. **Long-term**: Maintainable architecture with conditional exports

## 📋 **Implementation Plan**

### **Phase 1: Immediate Fix (Priority: Critical)**

#### **1.1 Update Package Exports Structure**
```json
// packages/analytics/package.json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./client": {
      "types": "./dist/client.d.ts", 
      "import": "./dist/client.js"
    },
    "./server": {
      "types": "./dist/server.d.ts",
      "import": "./dist/server.js"
    },
    "./posthog-client": {
      "types": "./dist/posthog-client.d.ts",
      "import": "./dist/posthog-client.js"
    }
  }
}
```

#### **1.2 Create Client-Only Entry Point**
**File:** `packages/analytics/src/client.ts`
```typescript
// Client-safe exports only - no server dependencies
export {
  getPosthogClientBrowser,
} from './posthog-client.js';

export {
  initSentryClient,
  captureException,
  captureMessage,
  setUserContext,
} from './sentry.js';
```

#### **1.3 Create Server-Only Entry Point**
**File:** `packages/analytics/src/server.ts`
```typescript
// Server-only exports
export {
  getPosthogClientServer,
  shutdownPosthogServer,
} from './posthog-server.js';

export {
  initSentryServer,
} from './sentry.js';

export {
  getLangfuse,
  createTrace,
  createGeneration,
  scoreTrace,
  shutdownLangfuse,
} from './langfuse.js';
```

#### **1.4 Update Main Index to Environment-Safe**
**File:** `packages/analytics/src/index.ts`
```typescript
// Safe exports that work in both environments
export {
  captureException,
  captureMessage,
  setUserContext,
} from './sentry.js';

// Re-export client and server modules
export * from './client.js';
export * from './server.js';
```

### **Phase 2: Fix Import Usage (Priority: Critical)**

#### **2.1 Update Instrumentation Client**
**File:** `apps/web/src/instrumentation-client.ts`
```typescript
// Use client-specific imports only
import { getPosthogClientBrowser, initSentryClient } from '@nexus/analytics/client';
import { replayIntegration } from '@sentry/nextjs';

// Initialize PostHog for client-side
getPosthogClientBrowser();

// Initialize Sentry for client-side using the analytics package
initSentryClient({
  tracesSampleRate: 1,
  enableLogs: true,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  debug: false,
  integrations: [
    replayIntegration(),
  ],
});

// Re-export Sentry helpers for Next.js integration
export { captureRouterTransitionStart as onRouterTransitionStart } from '@sentry/nextjs';
```

#### **2.2 Update Provider Usage**
**File:** `apps/web/src/providers.tsx`
```typescript
import { getPosthogClientBrowser } from '@nexus/analytics/client';
// ... rest unchanged
```

#### **2.3 Update Server-Side Usage**
**File:** `apps/web/sentry.server.config.ts`
```typescript
import { initSentryServer } from '@nexus/analytics/server';
// ... rest of config
```

### **Phase 3: Advanced Architecture (Priority: Medium)**

#### **3.1 Implement Conditional Exports**
**File:** `packages/analytics/package.json`
```json
{
  "exports": {
    ".": {
      "browser": "./dist/client.js",
      "worker": "./dist/client.js", 
      "node": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./client": {
      "types": "./dist/client.d.ts",
      "import": "./dist/client.js"
    },
    "./server": {
      "types": "./dist/server.d.ts", 
      "import": "./dist/server.js"
    }
  }
}
```

#### **3.2 Add Bundle Analysis Prevention**
**File:** `packages/analytics/src/server.ts`
```typescript
// Prevent client bundling with runtime check
if (typeof window !== 'undefined') {
  throw new Error(
    '@nexus/analytics/server should not be imported in client-side code. ' +
    'Use @nexus/analytics/client instead.'
  );
}

// ... server exports
```

#### **3.3 Create Type-Safe Environment Detection**
**File:** `packages/analytics/src/env-check.ts`
```typescript
export const isServer = typeof window === 'undefined';
export const isClient = typeof window !== 'undefined';

export function ensureServer(context: string): void {
  if (!isServer) {
    throw new Error(`${context} can only be used on the server side`);
  }
}

export function ensureClient(context: string): void {
  if (!isClient) {
    throw new Error(`${context} can only be used on the client side`);
  }
}
```

### **Phase 4: Build System Improvements (Priority: Low)**

#### **4.1 Add Bundle Size Analysis**
```json
// packages/analytics/package.json
{
  "scripts": {
    "analyze": "bundlesize",
    "build:client": "tsc --project tsconfig.client.json",
    "build:server": "tsc --project tsconfig.server.json"
  },
  "bundlesize": [
    {
      "path": "./dist/client.js",
      "maxSize": "50kb",
      "description": "Client-only bundle"
    }
  ]
}
```

#### **4.2 Separate TypeScript Configs**
**File:** `packages/analytics/tsconfig.client.json`
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "lib": ["DOM", "ES2020"]
  },
  "include": [
    "src/client.ts",
    "src/posthog-client.ts", 
    "src/sentry.ts"
  ]
}
```

**File:** `packages/analytics/tsconfig.server.json`
```json
{
  "extends": "./tsconfig.json", 
  "compilerOptions": {
    "outDir": "./dist",
    "lib": ["Node", "ES2020"]
  },
  "include": [
    "src/server.ts",
    "src/posthog-server.ts",
    "src/langfuse.ts"
  ]
}
```

## 🚀 **Implementation Steps**

### **Step 1: Create New Entry Points (15 min)**
1. Create `packages/analytics/src/client.ts` with client-only exports
2. Create `packages/analytics/src/server.ts` with server-only exports
3. Update `packages/analytics/package.json` exports

### **Step 2: Update Import Usage (10 min)**
1. Update `apps/web/src/instrumentation-client.ts` imports
2. Update `apps/web/src/providers.tsx` imports
3. Update server-side Sentry config imports

### **Step 3: Build and Test (5 min)**
1. Run `cd packages/analytics && pnpm build`
2. Test development server: `cd apps/web && pnpm dev`
3. Verify no bundling errors

### **Step 4: Validation (10 min)**
1. Check client bundle doesn't include server code
2. Verify PostHog and Sentry still work
3. Test both development and production builds

## ✅ **Success Criteria**

### **Immediate Success (Phase 1-2)**
- [ ] Development server starts without errors
- [ ] No "node:fs" or Node.js built-in errors in client bundle
- [ ] PostHog client initialization works in browser
- [ ] Sentry client initialization works in browser
- [ ] No server-side code in client bundle

### **Architecture Success (Phase 3-4)**
- [ ] Clear separation between client and server exports
- [ ] Type-safe environment detection
- [ ] Bundle size optimization
- [ ] Maintainable import patterns

## 🚨 **Risks and Mitigation**

### **Risk 1: Breaking Existing Imports**
**Mitigation:** Maintain backward compatibility in main index.ts while adding specific entry points

### **Risk 2: TypeScript Resolution Issues**
**Mitigation:** Use explicit file extensions (.js) in imports and proper package.json exports

### **Risk 3: Build System Complexity**
**Mitigation:** Start with simple separation, add complexity gradually

## 📝 **Testing Strategy**

### **Development Testing**
```bash
# Test development server starts
cd apps/web && pnpm dev

# Test production build
cd apps/web && pnpm build

# Test analytics package build
cd packages/analytics && pnpm build
```

### **Bundle Analysis**
```bash
# Check what's in client bundle
npx webpack-bundle-analyzer apps/web/.next/static/chunks/*.js

# Verify no server dependencies
grep -r "posthog-node\|node:" apps/web/.next/static/chunks/
```

### **Runtime Testing**
- Verify PostHog events fire in browser console
- Verify Sentry errors are captured
- Test in both development and production modes

## 🔄 **Rollback Plan**

### **If Issues Occur:**
1. **Immediate**: Revert import changes in `instrumentation-client.ts`
2. **Fallback**: Use direct file imports: `import { x } from '@nexus/analytics/dist/posthog-client.js'`
3. **Nuclear**: Temporarily inline client code in `instrumentation-client.ts`

### **Rollback Commands:**
```bash
# Revert to previous working state
git checkout HEAD~1 -- apps/web/src/instrumentation-client.ts
git checkout HEAD~1 -- packages/analytics/src/

# Quick inline fix if needed
# Temporarily copy client functions directly into instrumentation-client.ts
```

## 📚 **References**

- [Next.js App Router Instrumentation](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation)
- [Node.js Package Exports](https://nodejs.org/api/packages.html#conditional-exports)
- [Webpack Node.js Polyfills](https://webpack.js.org/configuration/node/)
- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)

---

**Estimated Total Time:** 40 minutes  
**Priority:** Critical (blocking development environment)  
**Complexity:** Medium (architectural changes)  
**Risk Level:** Low (with proper testing and rollback plan)
