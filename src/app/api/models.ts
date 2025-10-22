import { API_BASE, getAuthHeader } from '../auth/api';

async function readError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    try {
      const obj = JSON.parse(text);
      const msg = obj?.message || obj?.error;
      return typeof msg === 'string' ? msg : text;
    } catch {
      return text;
    }
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function deleteModel(name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/models/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: { ...getAuthHeader(), Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(await readError(res));
}

export async function deleteState(name: string, stateId: number): Promise<void> {
  const res = await fetch(
    `${API_BASE}/models/${encodeURIComponent(name)}/states/${stateId}`,
    { method: 'DELETE', headers: { ...getAuthHeader(), Accept: 'application/json' } }
  );
  if (!res.ok) throw new Error(await readError(res));
}

export async function deleteTransition(name: string, transitionId: number): Promise<void> {
  const res = await fetch(
    `${API_BASE}/models/${encodeURIComponent(name)}/transitions/${transitionId}`,
    { method: 'DELETE', headers: { ...getAuthHeader(), Accept: 'application/json' } }
  );
  if (!res.ok) throw new Error(await readError(res));
}

