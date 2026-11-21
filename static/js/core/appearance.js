/* Light is the default, regardless of the operating-system preference. */
(() => {
  const key = 'techmap_appearance';
  const root = document.documentElement;
  let saved;
  try { saved = localStorage.getItem(key); } catch { /* Storage is optional. */ }
  root.dataset.appearance = saved === 'dark' ? 'dark' : 'light';
  window.techmapAppearance = {
    toggle() {
      root.dataset.appearance = root.dataset.appearance === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, root.dataset.appearance); } catch { /* Apply for this page. */ }
    },
  };
})();
