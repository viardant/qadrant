export async function apiCall(
  pbUrl: string,
  token: string,
  pathStr: string,
  options: RequestInit = {}
): Promise<unknown> {
  const headers: Record<string, string> = {
    Authorization: token,
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(`${pbUrl}${pathStr}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const error = new Error(`API error ${pathStr} (${res.status}): ${body}`);
    (error as Error & { status: number }).status = res.status;
    throw error;
  }

  return res.json();
}

export function handleApiError(error: unknown): string {
  if (error instanceof Error) {
    const status = (error as Error & { status?: number }).status;
    if (status === 404) {
      return 'Error: Resource not found. Please check the PocketBase URL is correct and the collection exists.';
    }
    if (status === 401 || status === 403) {
      return 'Error: Authentication failed. Please re-authenticate with: qadrant login <token>';
    }
    if (status === 429) {
      return 'Error: Rate limit exceeded. Please wait before making more requests.';
    }
    return `Error: ${error.message}`;
  }
  return `Error: Unexpected error occurred: ${String(error)}`;
}
