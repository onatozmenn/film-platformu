"use client";

import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";

function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);

  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot(): boolean {
  return navigator.onLine;
}

export function OfflineNotice() {
  const isOnline = useSyncExternalStore(subscribe, getOnlineSnapshot, () => true);

  if (isOnline) {
    return null;
  }

  return (
    <div className="offline-notice" role="status">
      <WifiOff aria-hidden="true" size={18} strokeWidth={2} />
      <span>Çevrimdışısınız. Açık sayfayı inceleyebilirsiniz; yeni veriler yüklenemeyebilir.</span>
    </div>
  );
}
