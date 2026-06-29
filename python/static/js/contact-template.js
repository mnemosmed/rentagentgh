(function () {
  const contactForm = document.getElementById("contact-request-form");
  if (!contactForm) return;

  const fieldNames = [
    "property_type",
    "location",
    "budget_min",
    "budget_max",
    "move_in",
    "preferences",
  ];

  function setField(name, value) {
    const el = contactForm.querySelector(`[name="${name}"]`);
    if (el) el.value = value ?? "";
  }

  function readFields() {
    const data = {};
    fieldNames.forEach((name) => {
      const el = contactForm.querySelector(`[name="${name}"]`);
      data[name] = el ? el.value : "";
    });
    return data;
  }

  const picker = document.getElementById("contact-template-picker");
  if (picker) {
    picker.addEventListener("change", () => {
      const option = picker.selectedOptions[0];
      if (!option || !option.dataset.template) return;
      try {
        const data = JSON.parse(option.dataset.template);
        fieldNames.forEach((name) => setField(name, data[name]));
      } catch (_) {
        /* ignore malformed template data */
      }
    });
  }

  const toggleBtn = document.getElementById("toggle-save-template");
  const savePanel = document.getElementById("save-template-panel");
  if (toggleBtn && savePanel) {
    toggleBtn.addEventListener("click", () => {
      const open = savePanel.hidden;
      savePanel.hidden = !open;
      toggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });

    savePanel.addEventListener("submit", () => {
      fieldNames.forEach((name) => {
        let hidden = savePanel.querySelector(`input[type="hidden"][name="${name}"]`);
        if (!hidden) {
          hidden = document.createElement("input");
          hidden.type = "hidden";
          hidden.name = name;
          savePanel.appendChild(hidden);
        }
        hidden.value = readFields()[name];
      });
    });
  }
})();
