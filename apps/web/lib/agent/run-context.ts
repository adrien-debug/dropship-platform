import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-store run context propagated through every helper invoked during
 * `createStore`. Lets the Anthropic wrapper attach `store_id` to the
 * dropship_ai_runs row without each helper having to thread the id
 * through its signature.
 *
 * Read it via `runContext.getStore()?.storeId`. Set it once at the top
 * of the pipeline via `runContext.run({ storeId }, async () => { ... })`.
 */
export interface AgentRunContext {
  storeId: string | null;
}

export const runContext = new AsyncLocalStorage<AgentRunContext>();
