/* Opt-in display-only service worker; no cache, tracking, signing or subscriptions. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({type:"window", includeUncontrolled:true}).then((tabs) => {
    const tab = tabs.find((client) => new URL(client.url).origin === self.location.origin);
    return tab ? tab.focus() : self.clients.openWindow("/");
  }));
});
