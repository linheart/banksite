import { useCallback, useEffect, useState } from "react";
import { subscribeToasts, takeQueuedToasts } from "./toastBus";

const TOAST_LIFETIME_MS = 2500;

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((toast) => {
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== toast.id));
    }, TOAST_LIFETIME_MS);
  }, []);

  useEffect(() => {
    const queued = takeQueuedToasts();
    queued.forEach((toast) => pushToast(toast));
    return subscribeToasts(pushToast);
  }, [pushToast]);

  if (!toasts.length) return null;

  return (
    <div className="toast-host" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast ${toast.type === "error" ? "toast--error" : "toast--ok"}`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
