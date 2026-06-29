(function () {
  function initAreaSearch(root) {
    const input = root.querySelector(".area-search-input");
    const list = root.querySelector(".area-search-list");
    const areasId = root.dataset.areasId;
    const dataEl = areasId ? document.getElementById(areasId) : null;
    if (!input || !list || !dataEl) return;

    let areas = [];
    try {
      areas = JSON.parse(dataEl.textContent);
    } catch (_) {
      areas = [];
    }

    let activeIndex = -1;

    function filtered(query) {
      const q = query.trim().toLowerCase();
      if (!q) return areas;
      return areas.filter((a) => a.toLowerCase().includes(q));
    }

    function render(query) {
      const matches = filtered(query);
      list.innerHTML = "";
      activeIndex = -1;

      if (!matches.length) {
        hide();
        return;
      }

      matches.forEach((area, i) => {
        const li = document.createElement("li");
        li.className = "area-search-option";
        li.setAttribute("role", "option");
        li.textContent = area;
        li.dataset.index = String(i);
        li.addEventListener("mousedown", (e) => {
          e.preventDefault();
          select(area);
        });
        list.appendChild(li);
      });

      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    function hide() {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      activeIndex = -1;
    }

    function select(area) {
      input.value = area;
      hide();
      input.focus();
    }

    function highlight(index) {
      const options = list.querySelectorAll(".area-search-option");
      options.forEach((el, i) => {
        el.classList.toggle("is-active", i === index);
      });
      if (options[index]) {
        options[index].scrollIntoView({ block: "nearest" });
      }
    }

    input.addEventListener("input", () => render(input.value));
    input.addEventListener("focus", () => render(input.value));

    input.addEventListener("keydown", (e) => {
      const options = list.querySelectorAll(".area-search-option");
      if (list.hidden || !options.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, options.length - 1);
        highlight(activeIndex);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        highlight(activeIndex);
      } else if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        select(options[activeIndex].textContent);
      } else if (e.key === "Escape") {
        hide();
      }
    });

    document.addEventListener("click", (e) => {
      if (!root.contains(e.target)) hide();
    });
  }

  document.querySelectorAll("[data-area-search]").forEach(initAreaSearch);
})();
