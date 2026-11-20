/* Set direction before the page paints; the preference is local to this browser. */
(() => {
  const key = 'techmap_language';
  let saved;
  try { saved = localStorage.getItem(key); } catch { /* Storage may be unavailable. */ }
  const lang = ['en', 'fr', 'ar'].includes(saved) ? saved : 'en';
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  const text = (english) => Object.hasOwn(window.techmapLocales, english)
    ? window.techmapLocales[english][lang === 'fr' ? 0 : 1] : english;
  const number = (value) => new Intl.NumberFormat(lang === 'ar' ? 'ar-MA' : lang).format(value);
  window.techmapLanguage = {
    lang, number, t: lang === 'en' ? (english) => english : text,
    set(value) { if (['en', 'fr', 'ar'].includes(value)) localStorage.setItem(key, value); },
  };
})();
