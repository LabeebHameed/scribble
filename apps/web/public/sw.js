const CACHE = "scribble-offline-v1"
const PRECACHE = ["/today"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
          return res
        })
        .catch(() => caches.match(req).then((r) => r || new Response(JSON.stringify({ offline: true }), { headers: { "Content-Type": "application/json" } })))
    )
    return
  }
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).catch(() => caches.match("/today")))
  )
})

// Web push placeholder — full VAPID wiring arrives with Expo native push
self.addEventListener("push", (event) => {
  const data = event.data?.json?.() || { title: "Scribble", body: "Needs attention" }
  event.waitUntil(
    self.registration.showNotification(data.title || "Scribble", {
      body: data.body || "Open Scribble",
      data: { url: "/today" },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  event.waitUntil(self.clients.openWindow(event.notification.data?.url || "/today"))
})
