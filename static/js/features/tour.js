(() => {
  const key = 'techmap_workspace_tour_v1';
  const steps = [
    ['.nav-tab[data-tab="companies"]', 'Find your next team', 'Start here to browse Morocco’s tech companies. Open a company to see what it does, find contact details, or save it to your shortlist.'],
    ['#searchInput', 'Narrow the directory', 'Search by company name, skill, or keyword. Use the filters nearby to narrow by city, specialty, or contact availability.'],
    ['.nav-tab[data-tab="dashboard"]', 'Get the big picture', 'Explore the ecosystem by city and specialty to see where different kinds of tech work are concentrated.'],
    ['.nav-tab[data-tab="analyzer"]', 'Review your résumé', 'Use the Resume Analyzer to get AI feedback on the experience and skills you’re presenting.'],
    ['.nav-tab[data-tab="resume"]', 'Build a résumé', 'Choose a template, preview your résumé, and print or save it as a PDF.'],
    ['.nav-tab[data-tab="portfolio"]', 'Publish your portfolio', 'Show your projects, experience, and certifications on a public page. You can preview designs before signing in to publish.'],
    ['.nav-tab[data-tab="assistant"]', 'Talk through your next move', 'Ask the Career Assistant for help with questions about your job search or next steps.'],
    ['#openLauncher', 'Get anywhere faster', 'Open Quick actions to jump to tools and saved companies. On a keyboard, press Ctrl+K or Command+K. Replay this tour anytime from the ? help button.'],
  ];
  const dialog = document.getElementById('workspaceTour');
  const card = document.getElementById('tourCard');
  const spot = document.getElementById('tourSpotlight');
  const title = document.getElementById('tourTitle');
  const description = document.getElementById('tourDescription');
  const count = document.getElementById('tourCount');
  const next = document.getElementById('tourNext');
  const back = document.getElementById('tourBack');
  let index = 0, frame, startScroll, navScroll, originalTab, restoreFocus;
  const tabs = document.querySelector('.nav-tabs');
  const isSeen = () => { try { return localStorage.getItem(key) === 'seen'; } catch { return false; } };
  function remember() { try { localStorage.setItem(key, 'seen'); } catch { /* Storage is optional. */ } }

  function position() {
    if (!dialog.open) return;
    const target = document.querySelector(steps[index][0]);
    const rect = target?.getBoundingClientRect();
    const w = dialog.clientWidth, h = dialog.clientHeight;
    const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));
    const pad = 6, margin = 12, gap = 13;
    const clipping = target?.closest('.nav-tabs, .navbar')?.getBoundingClientRect();
    const left = Math.max(0, clipping?.left ?? 0, (rect?.left ?? 0) - pad);
    const right = Math.min(w, clipping?.right ?? w, (rect?.right ?? 0) + pad);
    const top = Math.max(0, clipping?.top ?? 0, (rect?.top ?? 0) - pad);
    const bottom = Math.min(h, clipping?.bottom ?? h, (rect?.bottom ?? 0) + pad);
    const visible = rect && right > left && bottom > top;
    spot.hidden = !visible;
    if (visible) Object.assign(spot.style, { left: `${left}px`, top: `${top}px`, width: `${right-left}px`, height: `${bottom-top}px` });
    const cw = card.offsetWidth, ch = card.offsetHeight;
    let x = (w-cw)/2, y = (h-ch)/2;
    if (visible && right + gap + cw <= w - margin) {
      x = right + gap; y = (top+bottom-ch)/2;
    } else if (visible && bottom + gap + ch <= h - margin) {
      x = (left+right-cw)/2; y = bottom + gap;
    } else if (visible && top - gap - ch >= margin) {
      x = (left+right-cw)/2; y = top - gap - ch;
    } else if (visible) {
      x = (left+right-cw)/2; y = bottom < h/2 ? h-ch-margin : margin;
    }
    card.style.left = `${clamp(x, margin, w-cw-margin)}px`;
    card.style.top = `${clamp(y, margin, h-ch-margin)}px`;
  }

  function schedulePosition() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(position);
  }

  function render() {
    const [selector, heading, copy] = steps[index];
    if (selector === '#searchInput' && !document.getElementById('companies').classList.contains('active')) {
      document.querySelector('.nav-tab[data-tab="companies"]').click();
    }
    const target = document.querySelector(selector);
    target?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    count.textContent = `Workspace tour · ${index + 1} of ${steps.length}`;
    title.textContent = heading;
    description.textContent = copy;
    back.disabled = index === 0;
    next.textContent = index === steps.length - 1 ? 'Done' : 'Next';
    position();
    title.focus({ preventScroll: true });
    schedulePosition();
  }

  function start(focusTarget) {
    if (dialog.open) return;
    index = 0;
    startScroll = window.scrollY;
    navScroll = tabs.scrollLeft;
    originalTab = tabs.querySelector('.nav-tab.active');
    restoreFocus = focusTarget || document.activeElement;
    dialog.showModal();
    render();
  }

  next.onclick = () => { if (index === steps.length - 1) dialog.close(); else { index++; render(); } };
  back.onclick = () => { if (index) { index--; render(); } };
  document.getElementById('tourSkip').onclick = () => dialog.close();
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.addEventListener('close', () => {
    remember();
    cancelAnimationFrame(frame);
    if (originalTab && !originalTab.classList.contains('active')) originalTab.click();
    window.scrollTo({ top: startScroll, behavior: 'instant' });
    tabs.scrollLeft = navScroll;
    if (restoreFocus !== document.body) restoreFocus?.focus({ preventScroll: true });
  });
  window.addEventListener('resize', () => { if (dialog.open) schedulePosition(); });
  window.addEventListener('scroll', () => { if (dialog.open) schedulePosition(); }, true);
  const help = document.querySelector('.help-dialog');
  const replay = document.createElement('button');
  replay.type = 'button';
  replay.className = 'mini-btn primary tour-replay';
  replay.textContent = 'Start the workspace tour';
  replay.onclick = () => { help.close(); start(document.getElementById('helpBtn')); };
  help.append(replay);

  window.addEventListener('load', () => {
    if (isSeen() || location.search || location.hash) return;
    if (!document.querySelector('dialog[open]')) start();
  }, { once: true });
})();
