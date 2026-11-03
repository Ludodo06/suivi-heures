// Lets the app open without a network.
// It asks the network first, so a new deployed version shows at once.
// It uses the saved copy only when the network fails.

const CACHE_NAME = "suivi-heures-v1";
const FIREBASE_CODE_ORIGIN = "https://www.gstatic.com";

self.addEventListener("fetch", (event) => {
  // Only the app and the Firebase code are kept. The Firebase data requests must
  // not pass here: they stay open for a long time, and they have their own cache.
  const { origin } = new URL(event.request.url);
  if (event.request.method !== "GET" || (origin !== self.location.origin && origin !== FIREBASE_CODE_ORIGIN)) {
    return;
  }
  event.respondWith(fetchThenCache(event.request));
});

/**
 * Gets a file from the network and keeps a copy of it.
 *
 * Args:
 *   request: The request of the page.
 *
 * Returns:
 *   The network response, or the saved copy if the network fails.
 */
async function fetchThenCache(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const saved = await cache.match(request);
    if (saved) {
      return saved;
    }
    throw error;
  }
}
