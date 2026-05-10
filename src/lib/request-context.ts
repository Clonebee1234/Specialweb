/**
 * Per-request context stored in `AsyncLocalStorage`.
 *
 * The middleware assigns a `requestId` on every incoming request and this
 * module makes it available anywhere downstream (logger, handler wrapper, SQL
 * tracing) without threading it as an explicit argument.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export type RequestContext = {
  requestId: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

export function newRequestId(): string {
  return randomUUID();
}
