import { API_BASE, getAuthHeader } from '../auth/api';

export interface ModelLockInfo {
  locked: boolean;
  lockId?: string;
  lockedBy?: string;
  expiresAt?: string;
  owner?: boolean;
}

interface LockResponse {
  success?: boolean;
  lock?: {
    lockId?: string;
    lockedBy?: string;
    expiresAt?: string;
    owner?: boolean;
  };
  locked?: boolean;
  lockId?: string;
  lockedBy?: string;
  expiresAt?: string;
  owner?: boolean;
  message?: string;
  error?: string;
}

async function readError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    try {
      const obj = JSON.parse(text) as { message?: string; error?: string };
      return obj.message || obj.error || text || `HTTP ${res.status}`;
    } catch {
      return text || `HTTP ${res.status}`;
    }
  } catch {
    return `HTTP ${res.status}`;
  }
}

function normalize(payload: LockResponse): ModelLockInfo {
  const lock = payload.lock;
  return {
    locked: typeof payload.locked === 'boolean' ? payload.locked : true,
    lockId: lock?.lockId ?? payload.lockId,
    lockedBy: lock?.lockedBy ?? payload.lockedBy,
    expiresAt: lock?.expiresAt ?? payload.expiresAt,
    owner: lock?.owner ?? payload.owner,
  };
}

export async function acquireModelLock(modelName: string): Promise<ModelLockInfo> {
  const res = await fetch(`${API_BASE}/models/${encodeURIComponent(modelName)}/lock/acquire`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader(), Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(await readError(res));
  const payload = (await res.json()) as LockResponse;
  return normalize(payload);
}

export async function renewModelLock(modelName: string, lockId: string): Promise<ModelLockInfo> {
  const res = await fetch(`${API_BASE}/models/${encodeURIComponent(modelName)}/lock/renew`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader(), Accept: 'application/json' },
    body: JSON.stringify({ lockId }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const payload = (await res.json()) as LockResponse;
  return normalize(payload);
}

export async function releaseModelLock(modelName: string, lockId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/models/${encodeURIComponent(modelName)}/lock/release`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader(), Accept: 'application/json' },
    body: JSON.stringify({ lockId }),
    keepalive: true,
  });
  if (!res.ok) throw new Error(await readError(res));
}

export async function getModelLock(modelName: string): Promise<ModelLockInfo> {
  const res = await fetch(`${API_BASE}/models/${encodeURIComponent(modelName)}/lock`, {
    headers: { ...getAuthHeader(), Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(await readError(res));
  const payload = (await res.json()) as LockResponse;
  return normalize(payload);
}
