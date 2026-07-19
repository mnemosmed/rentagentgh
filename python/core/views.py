from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render
from django.templatetags.static import static
from django.urls import reverse
from django.views.decorators.cache import cache_control

from agents.areas import get_all_areas
from feedback.models import UserFeedback


def home_view(request):
    testimonials = UserFeedback.objects.filter(is_published=True, rating__gte=4).order_by("-submitted_at")[:6]
    return render(
        request,
        "core/home.html",
        {
            "testimonials": testimonials,
            "all_areas": get_all_areas(),
            "search_action": reverse("agents:search"),
        },
    )


def manifest_view(request):
    """Web App Manifest (served at /manifest.webmanifest)."""
    manifest = {
        "name": settings.SITE_NAME,
        "short_name": "RentAgent",
        "description": "Find trusted rental agents in Accra by neighborhood.",
        "start_url": "/",
        "scope": "/",
        "display": "standalone",
        "orientation": "portrait-primary",
        "background_color": "#ffffff",
        "theme_color": "#FF5A5F",
        "categories": ["business", "productivity", "lifestyle"],
        "icons": [
            {"src": static("icons/icon-192.png"), "sizes": "192x192", "type": "image/png", "purpose": "any"},
            {"src": static("icons/icon-512.png"), "sizes": "512x512", "type": "image/png", "purpose": "any"},
            {"src": static("icons/maskable-512.png"), "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
    }
    return JsonResponse(manifest, content_type="application/manifest+json")


@cache_control(max_age=0, no_cache=True)
def service_worker_view(request):
    """Service worker, served from site root so its scope covers the whole app."""
    offline_url = reverse("core:offline")
    sw = f"""
const CACHE = 'rentagent-v1';
const OFFLINE_URL = '{offline_url}';
const PRECACHE = [
  OFFLINE_URL,
  '{static("css/main.css")}',
  '{static("icons/icon-192.png")}',
];

self.addEventListener('install', (event) => {{
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
}});

self.addEventListener('activate', (event) => {{
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
}});

self.addEventListener('fetch', (event) => {{
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network first, fall back to offline page.
  if (req.mode === 'navigate') {{
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }}

  // Static assets: cache first, then network.
  if (url.pathname.startsWith('/static/')) {{
    event.respondWith(
      caches.match(req).then((cached) =>
        cached || fetch(req).then((resp) => {{
          const copy = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return resp;
        }})
      )
    );
  }}
}});
"""
    return HttpResponse(sw, content_type="application/javascript")


def offline_view(request):
    return render(request, "core/offline.html")
