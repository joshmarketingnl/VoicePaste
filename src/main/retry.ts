export async function withRetries<T>(
  fn: () => Promise<T>,
  attempts: number,
  baseDelayMs: number,
  shouldRetry: (error: unknown) => boolean,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !shouldRetry(error)) {
        break;
      }
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
