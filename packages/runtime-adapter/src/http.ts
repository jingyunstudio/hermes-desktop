export interface ReachableProbeOptions {
  timeoutMs?: number;
}

export async function isUrlReachable(url: string, options?: ReachableProbeOptions): Promise<boolean> {
  const timeoutMs = options?.timeoutMs ?? 1500;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
