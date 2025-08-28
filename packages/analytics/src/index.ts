// Safe exports that work in both environments
export {
  captureException,
  captureMessage,
  setUserContext,
} from './sentry.js';

// Re-export client and server modules
export * from './client.js';
export * from './server.js';