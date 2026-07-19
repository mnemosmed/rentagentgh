from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from core.views import manifest_view, service_worker_view

urlpatterns = [
    path("admin/", admin.site.urls),
    # PWA endpoints must live at the site root for correct scope.
    path("manifest.webmanifest", manifest_view, name="manifest"),
    path("sw.js", service_worker_view, name="service_worker"),
    path("", include("core.urls")),
    path("accounts/", include("accounts.urls")),
    path("agents/", include("agents.urls")),
    path("messages/", include("messaging.urls")),
    path("feedback/", include("feedback.urls")),
    path("payments/", include("payments.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
