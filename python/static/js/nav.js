(function () {
  var nav = document.getElementById("site-nav");
  var toggle = document.getElementById("nav-toggle");
  var backdrop = document.getElementById("nav-backdrop");
  if (!nav || !toggle) return;

  function setOpen(open) {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("nav-open", open);
    if (backdrop) backdrop.hidden = !open;
  }

  toggle.addEventListener("click", function () {
    setOpen(!nav.classList.contains("is-open"));
  });

  if (backdrop) {
    backdrop.addEventListener("click", function () {
      setOpen(false);
    });
  }

  nav.querySelectorAll(".navbar-links a").forEach(function (link) {
    link.addEventListener("click", function () {
      setOpen(false);
    });
  });

  window.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setOpen(false);
  });

  window.addEventListener("resize", function () {
    if (window.matchMedia("(min-width: 768px)").matches) setOpen(false);
  });
})();
