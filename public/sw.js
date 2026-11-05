// Service worker solo per le notifiche, e solo dove serve: su iPhone con iOS 18.4+ le notifiche arrivano senza
// (Declarative Web Push) e questo file non viene nemmeno registrato. Niente cache e niente fetch: l'app resta
// sempre quella pubblicata, come l'Armadio.
// Il messaggio è nel formato dichiarativo: { web_push: 8030, notification: { title, body, navigate, app_badge } }.

self.addEventListener("push", (evento) => {
  let n = {};
  try {
    n = evento.data?.json()?.notification || {};
  } catch {
    n = { body: evento.data?.text() };
  }
  const badge = Number(n.app_badge);
  evento.waitUntil(
    Promise.all([
      self.registration.showNotification(n.title || "Piante", {
        body: n.body || "",
        lang: n.lang || "it-IT",
        tag: "promemoria-piante",
        data: { url: n.navigate || self.registration.scope },
        icon: "icons/goccia-192.png",
      }),
      Number.isInteger(badge) && self.navigator.setAppBadge ? self.navigator.setAppBadge(badge).catch(() => {}) : null,
    ]),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const url = evento.notification.data?.url || self.registration.scope;
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((finestre) => {
      const aperta = finestre.find((f) => f.url.startsWith(self.registration.scope));
      if (aperta) return aperta.navigate(url).then((f) => (f || aperta).focus());
      return self.clients.openWindow(url);
    }),
  );
});
