(() => {
  const toggle = document.getElementById('themeToggle');
  const { t } = window.techmapLanguage;
  function update() {
    const dark = document.documentElement.dataset.appearance === 'dark';
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.setAttribute('aria-label', t('Dark mode'));
    toggle.title = t(dark ? 'Switch to light mode' : 'Switch to dark mode');
    document.querySelector('meta[name="theme-color"]').content = dark ? '#141625' : '#f7f8fc';
  }
  toggle.addEventListener('click', () => { window.techmapAppearance.toggle(); update(); });
  update();
})();
