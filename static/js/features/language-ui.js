(() => {
  const { lang, t, set, number } = window.techmapLanguage;
  const picker = document.getElementById('languagePreference');
  picker.value = lang;
  picker.setAttribute('aria-label', t('Language'));
  picker.addEventListener('change', () => {
    try { set(picker.value); location.reload(); }
    catch { picker.value = lang; }
  });
  if (lang === 'en') return;

  const attrs = ['placeholder', 'aria-label', 'title'];
  // These regions contain user, directory, or generated content. Localize the interface, not their contents.
  const skip = 'script, style, svg, [data-language-names], #companiesGrid, #detailBody, #chatMessages, #compareContent, .account-name, .resume-paper';
  function translateNode(node) {
    if (node.nodeType === Node.TEXT_NODE && !node.parentElement?.closest(skip)) {
      const original = node.data.trim();
      if (original && t(original) !== original) node.data = node.data.replace(original, t(original));
    }
  }
  function translate(root) {
    if (root.nodeType === Node.TEXT_NODE) { translateNode(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE || root.closest(skip)) return;
    for (const el of [root, ...root.querySelectorAll('[placeholder], [aria-label], [title], option')]) {
      if (el.closest(skip)) continue;
      if (el.tagName === 'OPTION' && !el.hasAttribute('value')) el.value = el.value;
      for (const attr of attrs) if (el.hasAttribute(attr)) el.setAttribute(attr, t(el.getAttribute(attr)));
    }
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) translateNode(walk.currentNode);
  }
  translate(document.body);
  const intro = document.querySelector('#chatMessages .chat-bubble.assistant');
  if (intro && t(intro.textContent.trim()) !== intro.textContent.trim()) intro.textContent = t(intro.textContent.trim());
  if (lang === 'ar') {
    for (const field of document.querySelectorAll('textarea, input[type="text"]:not(#portfolioSlug)')) field.dir = 'auto';
  }
  const titles = { fr: 'TechMap Maroc — Annuaire tech et outils de carrière', ar: 'تيك ماب المغرب — دليل الشركات وأدوات المسار المهني' };
  document.title = titles[lang];
  // Observe only interface regions that are rebuilt by feature scripts.
  const observer = new MutationObserver(records => {
    for (const { addedNodes } of records) for (const node of addedNodes) translate(node);
  });
  for (const target of document.querySelectorAll('.local-profile, .help-dialog, #launcherDialog, #workspaceTour, #portfolio, .auth-main')) {
    observer.observe(target, { childList: true, subtree: true });
  }
  window.techmapLanguage.companyCount = (count, favorites) => {
    const value = number(count);
    if (lang === 'ar') return favorites ? `الشركات المحفوظة: ${value}` : `عدد الشركات: ${value}`;
    return `${value} ${count === 1 ? 'entreprise' : 'entreprises'}${favorites ? (count === 1 ? ' enregistrée' : ' enregistrées') : ''}`;
  };
})();
