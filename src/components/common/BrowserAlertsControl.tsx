import React, { useState } from "react";
import { enableBrowserNotifications } from "../../lib/browserNotifications";

export default function BrowserAlertsControl() {
  const [permission, setPermission] = useState<string>(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported");
  const [message, setMessage] = useState("");
  const enable = async () => {
    const result = await enableBrowserNotifications();
    setPermission(result === "enabled" ? "granted" : "unsupported");
    setMessage(result === "enabled"
      ? "Enabled for activity while HideDex remains open in another tab."
      : result);
  };
  return (
    <div className="mb-3 pb-3 border-b border-brand-border/60">
      <button type="button" onClick={() => void enable()} disabled={permission === "granted"}
        className="w-full text-left rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-xs text-brand-text disabled:opacity-70">
        {permission === "granted" ? "Browser alerts enabled" : "Enable browser alerts"}
      </button>
      <p className="text-[10px] mt-1 text-brand-muted">
        Receive account activity alerts when HideDex stays open in a background tab.
        Permission is optional. Notifications after closing the browser require a future server push service.
      </p>
      {message && <p className="text-[10px] mt-1 text-brand-sub" role="status">{message}</p>}
    </div>
  );
}
