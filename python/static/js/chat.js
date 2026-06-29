(function () {
  function scrollChatToBottom() {
    const el = document.getElementById("chat-messages");
    if (el) el.scrollTop = el.scrollHeight;
  }

  function scrollChatToUnread() {
    const panel = document.getElementById("chat-panel");
    const anchor = document.getElementById("chat-unread-anchor");
    if (panel?.dataset.scrollUnread === "1" && anchor) {
      anchor.scrollIntoView({ block: "center" });
      panel.removeAttribute("data-scroll-unread");
      return true;
    }
    return false;
  }

  function scrollChat() {
    if (!scrollChatToUnread()) scrollChatToBottom();
  }

  function initComposer(root) {
    const form = root.querySelector(".chat-composer");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";

    const textarea = form.querySelector(".chat-composer-input");
    const fileInput = form.querySelector('input[type="file"]');
    const fileLabel = form.querySelector(".chat-attach-name");

    if (textarea) {
      const resize = () => {
        textarea.style.height = "auto";
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
      };
      textarea.addEventListener("input", resize);
      textarea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (textarea.value.trim() || (fileInput && fileInput.files.length)) {
            form.requestSubmit();
          }
        }
      });
      resize();
    }

    if (fileInput && fileLabel) {
      fileInput.addEventListener("change", () => {
        const name = fileInput.files[0]?.name;
        fileLabel.textContent = name ? name : "";
        fileLabel.hidden = !name;
      });
    }

    form.addEventListener("htmx:beforeRequest", () => {
      const btn = form.querySelector(".chat-send-btn");
      if (btn) btn.disabled = true;
    });
    form.addEventListener("htmx:afterRequest", () => {
      const btn = form.querySelector(".chat-send-btn");
      if (btn) btn.disabled = false;
    });
  }

  function initChatPanel() {
    const panel = document.getElementById("chat-panel");
    if (!panel) return;
    initComposer(panel);
    scrollChat();
  }

  function startPolling() {
    const cfg = window.__chatPoll;
    if (!cfg || window.__chatPollStarted) return;
    window.__chatPollStarted = true;
    setInterval(function () {
      if (typeof htmx === "undefined") return;
      htmx.ajax("GET", cfg.panel, { target: "#chat-panel", swap: "outerHTML" });
      if (cfg.threads) {
        htmx.ajax("GET", cfg.threads, { target: "#chat-thread-list", swap: "innerHTML" });
      }
    }, 5000);
  }

  document.addEventListener("DOMContentLoaded", function () {
    initChatPanel();
    startPolling();
  });

  document.body.addEventListener("htmx:afterSwap", function (e) {
    if (e.detail.target.id === "chat-panel") initChatPanel();
  });
})();
