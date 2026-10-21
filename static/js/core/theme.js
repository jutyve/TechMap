(() => {
  const preference = matchMedia("(prefers-color-scheme: dark)");
  let saved;
  try {
    saved = localStorage.getItem("techmap_theme");
  } catch {
    /* Browser storage may be disabled. */
  }
  document.documentElement.dataset.theme = ["light", "dark"].includes(saved)
    ? saved
    : preference.matches
      ? "dark"
      : "light";
  preference.addEventListener("change", (event) => {
    let explicit;
    try {
      explicit = localStorage.getItem("techmap_theme");
    } catch {}
    if (!["light", "dark"].includes(explicit)) {
      document.documentElement.dataset.theme = event.matches ? "dark" : "light";
      window.dispatchEvent(new Event("themechange"));
    }
  });
})();