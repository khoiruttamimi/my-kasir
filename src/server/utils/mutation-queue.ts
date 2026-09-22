// Create one queue per resource. Operations are serialized within this server process.
export function createMutationQueue() {
  let pendingMutation: Promise<unknown> = Promise.resolve();

  return function mutate<T>(operation: () => Promise<T>): Promise<T> {
    const result = pendingMutation.then(operation);
    // Keep the queue running after failures while returning the error to the caller.
    pendingMutation = result.catch(() => undefined);
    return result;
  };
}
