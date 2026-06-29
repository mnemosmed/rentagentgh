from django.urls import path

from .views import agent_reply_view, chat_partial_view, inbox_view, send_message_view, threads_partial_view

app_name = "messaging"

urlpatterns = [
    path("", inbox_view, name="inbox"),
    path("threads/", threads_partial_view, name="threads_partial"),
    path("c/<uuid:conversation_id>/", inbox_view, name="conversation"),
    path("c/<uuid:conversation_id>/send/", send_message_view, name="send"),
    path("c/<uuid:conversation_id>/partial/", chat_partial_view, name="chat_partial"),
    path("c/<uuid:conversation_id>/agent-reply/", agent_reply_view, name="agent_reply"),
]
