"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Disable service worker in development to avoid chunk loading / HMR conflicts.
    // A visitor who previously loaded a production build on this origin (or an
    // older dev build from before this gate existed) can still have one left
    // over — it keeps intercepting navigations/assets, occasionally serving a
    // JS chunk that doesn't match the currently running dev server, which
    // triggers Next's dev-client auto-reload-on-chunk-mismatch recovery. Since
    // the stale worker never goes away on its own, that repeats forever
    // (visible as an unexplained refresh loop). Proactively unregister and
    // drop its caches instead of merely skipping a new registration.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
        .catch(() => {});
      if (typeof caches !== "undefined") {
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
          .catch(() => {});
      }
      return;
    }

    // The server stamps the current build id on the worker URL. A browser
    // holding a worker from an older deployment keeps serving its cached
    // shell, whose /_next/static/<old-build>/ chunk references 404 after
    // the deploy -- a stuck broken page that a plain reload does not fix,
    // because the worker intercepts the navigation again. Changing the
    // query string makes the browser treat the worker as an update, so
    // the new generation takes over and the old generation's caches are
    // dropped by the activate handler.
    navigator.serviceWorker
      .register(`/sw.js?v=${process.env.NEXT_PUBLIC_SW_BUILD_ID}`)
      .catch(() => {
        // Ignore registration failures to avoid blocking app rendering.
      });
  }, []);

  return null;
}
