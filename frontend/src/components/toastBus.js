let counter = 0;
const listeners = new Set();
const PENDING_TOASTS_KEY = "pending_toasts";

export function subscribeToasts(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function showToast(message, type = "error") {
  if (!message) return;
  const toast = {
    id: ++counter,
    message,
    type,
  };
  listeners.forEach((listener) => listener(toast));
}

export function queueToastForNextPage(message, type = "error") {
  if (!message) return;
  try {
    const raw = sessionStorage.getItem(PENDING_TOASTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.push({ message, type });
    sessionStorage.setItem(PENDING_TOASTS_KEY, JSON.stringify(list));
  } catch {
    showToast(message, type);
  }
}

export function takeQueuedToasts() {
  try {
    const raw = sessionStorage.getItem(PENDING_TOASTS_KEY);
    if (!raw) return [];
    sessionStorage.removeItem(PENDING_TOASTS_KEY);
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter((item) => item && item.message)
      .map((item) => ({
        id: ++counter,
        message: item.message,
        type: item.type || "error",
      }));
  } catch {
    return [];
  }
}
