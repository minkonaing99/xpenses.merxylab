import { useSyncExternalStore } from "react";
import "./OfflineBanner.css";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Slim bar shown while the device is offline (online-only app, so warn plainly). */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div className="offline" role="status">
      Offline. Changes won't save until you're back.
    </div>
  );
}
