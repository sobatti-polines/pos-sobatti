/**
 * In-memory SSE relay for the phone barcode scanner.
 * Lifetime: server process. Sessions expire after IDLE_MS.
 */

type Listener = (barcode: string) => void;

const sessions = new Map<string, { listeners: Set<Listener>; timer: ReturnType<typeof setTimeout> }>();

const IDLE_MS = 5 * 60 * 1000; // 5 minutes

function touch(sessionId: string) {
  const s = sessions.get(sessionId);
  if (!s) return;
  clearTimeout(s.timer);
  s.timer = setTimeout(() => sessions.delete(sessionId), IDLE_MS);
}

export function ensureSession(sessionId: string) {
  if (!sessions.has(sessionId)) {
    const timer = setTimeout(() => sessions.delete(sessionId), IDLE_MS);
    sessions.set(sessionId, { listeners: new Set(), timer });
  }
  touch(sessionId);
}

export function addListener(sessionId: string, fn: Listener) {
  ensureSession(sessionId);
  sessions.get(sessionId)!.listeners.add(fn);
  return () => sessions.get(sessionId)?.listeners.delete(fn);
}

export function emit(sessionId: string, barcode: string) {
  const s = sessions.get(sessionId);
  if (!s) return false;
  touch(sessionId);
  s.listeners.forEach((fn) => fn(barcode));
  return true;
}
