import { ProblemError } from '../types/space';

export class ApiClientError extends Error {
  status: number;
  title: string;
  detail: string;

  constructor(problem: ProblemError) {
    super(`${problem.title}: ${problem.detail}`);
    this.status = problem.status;
    this.title = problem.title;
    this.detail = problem.detail;
  }
}

export async function fetchApi<T>(
  path: string,
  options?: RequestInit,
  retries = 1,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const resp = await fetch(`/api/v1${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options?.headers ?? {}),
      },
    });

    if (!resp.ok) {
      let problem: ProblemError = {
        status: resp.status,
        title: 'API Error',
        detail: `Request failed with status ${resp.status}.`,
      };
      try {
        const body = (await resp.json()) as Partial<ProblemError>;
        if (body.detail) {
          problem = {
            status: body.status ?? resp.status,
            title: body.title ?? 'Request Error',
            detail: body.detail,
          };
        }
      } catch {
        // Use fallback problem details
      }
      throw new ApiClientError(problem);
    }

    return (await resp.json()) as T;
  } catch (err) {
    if (err instanceof ApiClientError) {
      if (err.status >= 500 && retries > 0) {
        await new Promise((r) => setTimeout(r, 350));
        return fetchApi<T>(path, options, retries - 1);
      }
      throw err;
    }
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 350));
      return fetchApi<T>(path, options, retries - 1);
    }
    throw new ApiClientError({
      status: 0,
      title: 'Network Interrupted',
      detail: err instanceof Error ? err.message : 'Unable to reach telemetry backend.',
    });
  } finally {
    clearTimeout(timeout);
  }
}
