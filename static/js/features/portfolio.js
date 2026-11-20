(() => {
  const el = (id) => document.getElementById(id);
  const form = el('portfolioForm');
  const status = el('portfolioStatus');
  const previewStatus = el('portfolioPreviewStatus');
  const templates = {
    minimal: ['Minimal', 'Clean and focused'], editorial: ['Editorial', 'Serif and spacious'],
    terminal: ['Terminal', 'Monospace and technical'], gallery: ['Gallery', 'Project-first cards'],
    executive: ['Executive', 'Classic and polished'], bento: ['Bento', 'Modular and colorful'],
    atlas: ['Atlas', 'Split layout'], monograph: ['Monograph', 'High-contrast typography'],
  };
  // Preview-only content; never added to the form or publishing payload.
  const sample = {
    name: 'Nadia Belkacem', headline: 'Product designer & creative developer', location: 'Rabat, Morocco',
    bio: 'I design and build digital tools that make complicated things feel simple. I’m drawn to work that brings local stories, thoughtful systems, and the open web together.',
    skills: 'Design systems, Creative coding, Accessibility, Prototyping, Research',
    projects: [
      { title: 'The Medina Index', subtitle: 'Digital archive · Art direction & development', period: '2025', description: 'A browsable atlas of independent makers and workshops, built around interviews and hand-drawn maps.' },
      { title: 'Fieldnotes', subtitle: 'Open-source toolkit · Design systems', period: '2024', description: 'A set of accessible components for teams publishing field research on the web.' },
    ],
    experience: [{ title: 'Product Designer', subtitle: 'Studio Tilia', period: '2023–Present', description: 'Lead the design of publishing tools for independent researchers and small teams.' }],
    education: [{ title: 'BA in Visual Communication', subtitle: 'School of Design', period: '2022' }],
    certificates: [{ title: 'Digital Accessibility', subtitle: 'Professional development', period: '2025' }],
  };
  let samplePreference = null;
  const groups = {
    projects: ['Projects', 'project', 'Technologies or role', 'Project link'],
    experience: ['Experience', 'role', 'Company or organization', 'Company link'],
    education: ['Education', 'qualification', 'School or institution', 'Program link'],
    certificates: ['Certifications', 'certificate', 'Issuing organization', 'Credential link'],
  };
  const entryFields = [
    ['title', 'Title', 'text', 140], ['subtitle', '', 'text', 140],
    ['period', 'Date or period', 'text', 140], ['url', '', 'url', 500],
    ['description', 'Description', 'textarea', 2400],
  ];
  const fields = ['name', 'headline', 'location', 'email', 'bio', 'skills', 'github', 'linkedin', 'website', 'resume', 'template'];
  const lists = {};
  const handoffKey = "techmap_portfolio_signin_draft";
  let initialized = false, busy = false, current = null, previewTimer, previewRequest;

  for (const [key, [label, caption]] of Object.entries(templates)) {
    const option = document.createElement('label');
    option.className = 'portfolio-option';
    // Only fixed template metadata is interpolated here.
    option.innerHTML = `<input type="radio" name="template" value="${key}" ${key === 'minimal' ? 'checked' : ''}>
      <span class="portfolio-option-card"><span class="portfolio-thumb ${key}" aria-hidden="true"><i></i><i></i><i></i></span><strong>${label}</strong><small>${caption}</small></span>`;
    el('portfolioTemplates').append(option);
  }

  function addEntry(key, data = {}, focus = false) {
    const { list, add } = lists[key];
    if (list.children.length >= 12) return;
    const entry = document.createElement('fieldset');
    entry.className = 'portfolio-entry portfolio-fields';
    const legend = document.createElement('legend');
    legend.textContent = groups[key][1];
    entry.append(legend);
    for (const [field, label, type, maxLength] of entryFields) {
      const wrapper = document.createElement('label');
      wrapper.textContent = label || groups[key][field === 'url' ? 3 : 2];
      const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
      if (type !== 'textarea') input.type = type;
      else { input.rows = 3; wrapper.className = 'full'; }
      input.dataset.field = field;
      input.maxLength = maxLength;
      input.value = data[field] || '';
      wrapper.append(input);
      entry.append(wrapper);
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'mini-btn portfolio-remove';
    remove.textContent = `Remove ${groups[key][1]}`;
    remove.onclick = () => { entry.remove(); add.disabled = false; add.focus(); queuePreview(); };
    entry.append(remove);
    list.append(entry);
    add.disabled = list.children.length >= 12;
    if (focus) entry.querySelector('input').focus();
  }

  for (const [key, [label, singular]] of Object.entries(groups)) {
    const section = document.createElement('section');
    section.className = 'portfolio-group';
    section.innerHTML = `<h3>${label}</h3><div></div><button type="button" class="mini-btn">+ Add ${singular}</button>`;
    const add = section.querySelector('button');
    lists[key] = { list: section.querySelector('div'), add };
    add.onclick = () => addEntry(key, {}, true);
    el('portfolioSections').append(section);
  }

  function collect(strict = false) {
    const data = Object.fromEntries(fields.map(key => [key, form.elements[key].value.trim()]));
    for (const key of Object.keys(groups)) {
      data[key] = [];
      for (const entry of lists[key].list.children) {
        const inputs = [...entry.querySelectorAll('[data-field]')];
        const values = Object.fromEntries(inputs.map(input => [input.dataset.field, input.value.trim()]));
        if (!Object.values(values).some(Boolean)) continue;
        if (!values.title) {
          if (strict) { inputs[0].focus(); throw new Error(`Enter a title for each ${groups[key][1]} you add.`); }
          continue;
        }
        data[key].push(values);
      }
    }
    return data;
  }

  async function request(path = '', options = {}) {
    const response = await fetch(`/api/portfolio${path}`, {
      ...options, headers: options.body ? { 'Content-Type': 'application/json' } : {},
    });
    if (!response.ok) {
      const { detail } = await response.json().catch(() => ({}));
      const error = new Error(typeof detail === 'string' ? detail :
        `Check your ${path === '/preview' ? 'profile details and links' : 'username and form details'} and try again.`);
      error.status = response.status;
      throw error;
    }
    return response;
  }

  function showingSample(data) {
    return samplePreference ?? !Object.entries(data).some(([key, value]) =>
      key !== 'template' && (Array.isArray(value) ? value.length > 0 : Boolean(value)));
  }

  async function refreshPreview() {
    const controller = new AbortController();
    previewRequest = controller;
    try {
      const data = collect();
      const example = showingSample(data);
      const response = await request('/preview', {
        method: 'POST', body: JSON.stringify(example ? { ...sample, template: data.template } : data), signal: controller.signal,
      });
      const html = await response.text();
      if (controller.signal.aborted) return;
      el('portfolioFrame').srcdoc = html;
      el('portfolioPreviewMode').textContent = example ? 'Sample content' : 'Private preview';
      el('portfolioSample').textContent = example ? 'Show my content' : 'Show sample';
      previewStatus.hidden = true;
    } catch (error) {
      if (controller.signal.aborted) return;
      previewStatus.textContent = `Preview not updated. ${error.message}`;
      previewStatus.hidden = false;
    }
  }

  function queuePreview() {
    el('portfolioDesign').textContent = (templates[form.elements.template.value] || templates.minimal)[0];
    previewRequest?.abort();
    clearTimeout(previewTimer);
    previewTimer = setTimeout(refreshPreview, 350);
  }

  function paintPublished() {
    const published = Boolean(current?.published);
    el('portfolioDraft').classList.toggle('hidden', published);
    el('portfolioUnpublish').classList.toggle('hidden', !published);
    el('portfolioLive').classList.toggle('hidden', !published);
    el('portfolioPublish').textContent = published ? 'Publish changes' : 'Publish website';
    if (published) el('portfolioOpen').href = `/portfolio/${current.slug}`;
    else el('portfolioOpen').removeAttribute('href');
  }

  async function initialize() {
    if (initialized) return;
    initialized = true;
    // Don't let a delayed account response replace someone’s in-progress typing.
    form.inert = true;
    try {
      current = await (await request()).json();
      let handoff = null;
      try {
        handoff = JSON.parse(sessionStorage.getItem(handoffKey));
        sessionStorage.removeItem(handoffKey);
      } catch { /* Session storage may be blocked. */ }
      const source = handoff && (!current || window.confirm('Continue the draft you started before signing in? Your saved portfolio will not change until you save or publish.')) ? handoff : current;
      if (source) {
        for (const key of [...fields, 'slug']) form.elements[key].value = source[key];
        for (const key of Object.keys(groups)) source[key].forEach(entry => addEntry(key, entry));
      }
      paintPublished();
      el('portfolioActions').classList.remove('hidden');
    } catch (error) {
      if (error.status === 401) el('portfolioGuest').classList.remove('hidden');
      else {
        status.textContent = 'Could not load your portfolio. Refresh the page to try again.';
        initialized = false;
      }
    } finally {
      form.inert = false;
      queuePreview();
    }
  }

  function setBusy(value) {
    busy = value;
    for (const button of el('portfolioActions').querySelectorAll('button')) button.disabled = value;
  }

  form.addEventListener('input', queuePreview);
  el('portfolioSample').onclick = () => {
    samplePreference = !showingSample(collect());
    queuePreview();
  };
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !event.submitter) return;
    const slug = form.elements.slug.value.trim();
    const published = event.submitter.value === 'publish';
    if (!slug) { status.textContent = 'Choose a public username.'; form.elements.slug.focus(); return; }
    if (published && !form.elements.name.value.trim()) {
      status.textContent = 'Enter your display name before publishing.';
      form.elements.name.focus();
      return;
    }
    if (published && current?.published && current.slug !== slug &&
        !window.confirm('Change the public link? The old address will stop working.')) return;
    setBusy(true);
    try {
      current = await (await request('', { method: 'PUT', body: JSON.stringify({ ...collect(true), slug, published }) })).json();
      paintPublished();
      status.textContent = published ? 'Published. Anyone with the link can visit your website.' : 'Private draft saved.';
    } catch (error) {
      status.textContent = error.message;
    } finally { setBusy(false); }
  });

  el('portfolioUnpublish').onclick = async () => {
    if (busy || !window.confirm('Take your public portfolio offline? Your saved content will remain available to you.')) return;
    setBusy(true);
    try {
      await request('/unpublish', { method: 'POST' });
      current.published = false;
      paintPublished();
      status.textContent = 'Website unpublished. Your saved version is now private.';
    } catch (error) { status.textContent = error.message; }
    finally { setBusy(false); }
  };

  el('portfolioCopy').onclick = async () => {
    const url = el('portfolioOpen').href;
    try { await navigator.clipboard.writeText(url); status.textContent = 'Public link copied.'; }
    catch { status.textContent = `Copy your public link: ${url}`; }
  };

  el('portfolioSignIn').addEventListener('click', event => {
    try {
      const draft = { ...collect(true), slug: form.elements.slug.value.trim() };
      sessionStorage.setItem(handoffKey, JSON.stringify(draft));
    } catch (error) {
      event.preventDefault();
      status.textContent = error.message;
    }
  });

  const tab = document.querySelector('.nav-tab[data-tab="portfolio"]');
  tab.addEventListener('click', initialize);
  if (new URLSearchParams(location.search).get('studio') === 'portfolio') {
    document.addEventListener('DOMContentLoaded', () => tab.click(), { once: true });
  }
})();
