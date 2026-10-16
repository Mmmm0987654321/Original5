// Browser/OS alerts are separate from existing in-app notification logs.
// This does not install background polling or claim closed-tab push delivery.
export async function enableBrowserNotifications(): Promise<string> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator))
    return "Browser notifications are not supported on this device.";
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "Permission not granted; use your browser site settings to allow alerts.";
    await navigator.serviceWorker.register("/hidedex-alerts-sw.js", {scope: "/"});
    return "enabled";
  } catch {
    return "The browser could not register notifications.";
  }
}

export async function notifyBackgroundAccountEvent(
  title: string,
  description: string,
  type: "info" | "success" | "warning" | "error"
): Promise<void> {
  if (type === "info" || typeof document === "undefined" ||
    document.visibilityState !== "hidden" || !("Notification" in window) ||
    Notification.permission !== "granted" || !("serviceWorker" in navigator)) return;
  try {
    const worker = await navigator.serviceWorker.getRegistration("/");
    if (!worker) return;
    await worker.showNotification(title, {
      body: description,
      icon: "/hidedex-logo.webp",
      tag: "hidedex-activity-" + Date.now()
    });
  } catch {
    // Notification failures must never impact a real wallet/trading action.
  }
}
