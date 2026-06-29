from django.urls import path

from .views import admin_feedback_list, feedback_form_view, site_feedback_view

app_name = "feedback"

urlpatterns = [
    path("<str:token>/", feedback_form_view, name="form"),
    path("admin/list/", admin_feedback_list, name="admin_list"),
    path("site/", site_feedback_view, name="site"),
]
