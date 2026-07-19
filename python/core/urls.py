from django.urls import path

from .views import home_view, offline_view

app_name = "core"

urlpatterns = [
    path("", home_view, name="home"),
    path("offline/", offline_view, name="offline"),
]
