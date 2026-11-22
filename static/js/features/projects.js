/* Projects tab — a curated library of portfolio project briefs by specialty.
   Purely client-side: ideas come from js/core/projects-data.js and the user's
   saved / building / shipped state lives in localStorage (synced to the
   account by auth.js when signed in). */
(function () {
  "use strict";

  const DATA = window.techmapProjectIdeas;
  if (!DATA || !Array.isArray(DATA.projects) || !Array.isArray(DATA.specialties)) return;

  const PROJECTS = DATA.projects;
  const SPECIALTIES = DATA.specialties;
  const SPECIALTY = Object.fromEntries(SPECIALTIES.map((s) => [s.id, s]));
  const LEVELS = {
    beginner: { label: "Beginner", rank: 1 },
    intermediate: { label: "Intermediate", rank: 2 },
    advanced: { label: "Advanced", rank: 3 },
  };
  const EFFORTS = {
    weekend: { label: "A weekend", rank: 1 },
    sprint: { label: "1–2 weeks", rank: 2 },
    month: { label: "3–4 weeks", rank: 3 },
    deep: { label: "2+ months", rank: 4 },
  };
  const STATUS = {
    saved: { label: "Saved", short: "Saved" },
    building: { label: "Building", short: "Building" },
    shipped: { label: "Shipped", short: "Shipped" },
  };
  const STORE_KEY = "techmap_projects";
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const storage = (() => {
    try {
      const t = "__techmap_projects_test__";
      localStorage.setItem(t, "1");
      localStorage.removeItem(t);
      return localStorage;
    } catch {
      return null;
    }
  })();

  let built = false;
  let query = "";
  let specialty = "all";
  let level = "all";
  let time = "all";
  let sort = "recommended";
  let savedOnly = false;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(String(value).trim());
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function readState() {
    if (!storage) return {};
    try {
      const raw = JSON.parse(storage.getItem(STORE_KEY) || "{}");
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
      const clean = {};
      for (const p of PROJECTS) {
        const value = raw[p.id];
        if (value === "saved" || value === "building" || value === "shipped") {
          clean[p.id] = value;
        }
      }
      return clean;
    } catch {
      return {};
    }
  }

  let progress = readState();

  function writeState() {
    if (!storage) return;
    try {
      storage.setItem(STORE_KEY, JSON.stringify(progress));
    } catch {
      /* Storage is optional. */
    }
  }

  function trackedCount() {
    return PROJECTS.reduce((total, p) => total + (progress[p.id] ? 1 : 0), 0);
  }

  function shippedCount() {
    return PROJECTS.reduce((total, p) => total + (progress[p.id] === "shipped" ? 1 : 0), 0);
  }

  function buildingCount() {
    return PROJECTS.reduce((total, p) => total + (progress[p.id] === "building" ? 1 : 0), 0);
  }

  const searchIndex = new Map(
    PROJECTS.map((p) => {
      const sp = SPECIALTY[p.specialty] || { label: "", roles: [], resources: [] };
      const hay = [
        p.title,
        p.pitch,
        p.build,
        p.why,
        p.bullet,
        p.level,
        p.time,
        p.stack.join(" "),
        p.features.join(" "),
        p.steps.join(" "),
        sp.label,
        sp.short,
        sp.roles.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return [p.id, hay];
    })
  );

  function matchesFilters(p) {
    if (specialty !== "all" && p.specialty !== specialty) return false;
    if (level !== "all" && p.level !== level) return false;
    if (time !== "all" && p.effort !== time) return false;
    if (savedOnly && !progress[p.id]) return false;
    if (!query) return true;
    return searchIndex.get(p.id).includes(query);
  }

  function filtered() {
    const items = PROJECTS.filter(matchesFilters);
    const byTitle = (a, b) => a.title.localeCompare(b.title);
    if (sort === "az") return items.sort(byTitle);
    if (sort === "quickest") {
      return items.sort(
        (a, b) =>
          EFFORTS[a.effort].rank - EFFORTS[b.effort].rank ||
          LEVELS[a.level].rank - LEVELS[b.level].rank ||
          byTitle(a, b)
      );
    }
    if (sort === "easiest") {
      return items.sort(
        (a, b) =>
          LEVELS[a.level].rank - LEVELS[b.level].rank ||
          EFFORTS[a.effort].rank - EFFORTS[b.effort].rank ||
          byTitle(a, b)
      );
    }
    // Recommended: round-robin the specialties so the first screen shows a
    // varied spread of ideas instead of ten frontend projects in a row.
    const bySpecialty = new Map(SPECIALTIES.map((sp) => [sp.id, []]));
    for (const item of items) bySpecialty.get(item.specialty)?.push(item);
    const mixed = [];
    for (let round = 0; mixed.length < items.length; round++) {
      for (const sp of SPECIALTIES) {
        const bucket = bySpecialty.get(sp.id);
        if (bucket && bucket[round]) mixed.push(bucket[round]);
      }
    }
    return mixed;
  }

  const ICON_BOOKMARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4-6.5 4V4.5a1 1 0 0 1 1-1Z"/></svg>';
  const ICON_CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.4"/><path d="M12 7.4V12l3.1 1.9"/></svg>';
  const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.4 4.4 4.4L19 6.6"/></svg>';

  function cardHtml(p) {
    const sp = SPECIALTY[p.specialty] || { label: p.specialty, accent: "brand" };
    const status = progress[p.id];
    const statusLabel = status ? STATUS[status].label : "";
    const stack = p.stack
      .slice(0, 5)
      .map((item) => `<span class="project-tag">${escapeHtml(item)}</span>`)
      .join("");
    return `<article class="project-card" data-id="${escapeHtml(p.id)}" data-accent="${escapeHtml(sp.accent)}">
      <div class="project-card-top">
        <span class="project-specialty">${escapeHtml(sp.label)}</span>
        <span class="project-level project-level--${escapeHtml(p.level)}">${escapeHtml(LEVELS[p.level].label)}</span>
      </div>
      <h3><button type="button" class="project-title-btn" data-open="${escapeHtml(p.id)}">${escapeHtml(p.title)}</button></h3>
      <p class="project-pitch">${escapeHtml(p.pitch)}</p>
      <div class="project-meta">
        <span class="project-meta-item">${ICON_CLOCK}${escapeHtml(p.time)}</span>
        <span class="project-meta-item project-meta-cv">${ICON_CHECK}CV bullet</span>
        ${status ? `<span class="project-state project-state--${escapeHtml(status)}">${escapeHtml(statusLabel)}</span>` : ""}
      </div>
      <div class="project-stack">${stack}</div>
      <div class="project-card-foot">
        <button type="button" class="project-save${status ? " is-saved" : ""}" data-save="${escapeHtml(p.id)}" aria-pressed="${status ? "true" : "false"}" aria-label="${status ? "Remove from your saved projects" : "Save this project"}">${ICON_BOOKMARK}<span>${status ? "Saved" : "Save"}</span></button>
        <button type="button" class="project-open" data-open="${escapeHtml(p.id)}">View brief <span aria-hidden="true">↗</span></button>
      </div>
    </article>`;
  }

  function chipHtml(sp, count, active) {
    return `<button type="button" class="chip${active ? " active" : ""}" data-specialty="${escapeHtml(sp.id)}" role="tab" aria-selected="${active}">
      <span>${escapeHtml(sp.short)}</span><span class="chip-count">${count}</span>
    </button>`;
  }

  function buildChips() {
    const wrap = $("#projectChips");
    if (!wrap) return;
    const counts = {};
    for (const p of PROJECTS) counts[p.specialty] = (counts[p.specialty] || 0) + 1;
    const all = `<button type="button" class="chip${specialty === "all" ? " active" : ""}" data-specialty="all" role="tab" aria-selected="${specialty === "all"}">
      <span>All specialties</span><span class="chip-count">${PROJECTS.length}</span>
    </button>`;
    wrap.innerHTML = all + SPECIALTIES.filter((sp) => counts[sp.id]).map((sp) => chipHtml(sp, counts[sp.id], specialty === sp.id)).join("");
    if (!wrap.dataset.wired) {
      wrap.dataset.wired = "1";
      wrap.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-specialty]");
        if (!btn) return;
        specialty = btn.dataset.specialty;
        $$(".chip", wrap).forEach((chip) => {
          const on = chip.dataset.specialty === specialty;
          chip.classList.toggle("active", on);
          chip.setAttribute("aria-selected", String(on));
        });
        render();
      });
    }
  }

  function updateStats() {
    const total = $("#projectTotal");
    const saved = $("#projectSavedCount");
    const shipped = $("#projectShippedCount");
    if (total) total.textContent = String(PROJECTS.length);
    if (saved) saved.textContent = String(trackedCount());
    if (shipped) shipped.textContent = String(shippedCount());
  }

  function updateStatusLine(items) {
    const status = $("#projectStatus");
    if (!status) return;
    const tracked = trackedCount();
    const building = buildingCount();
    const parts = [
      `<strong>${items.length}</strong> of ${PROJECTS.length} briefs shown`,
      `<strong>${PROJECTS.filter((p) => p.level === "beginner").length}</strong> beginner-friendly`,
    ];
    if (tracked) parts.push(`<strong>${tracked}</strong> saved${building ? ` · <strong>${building}</strong> building` : ""}`);
    status.innerHTML = parts.join(" · ");
  }

  function render(options = {}) {
    const grid = $("#projectGrid");
    if (!grid) return;
    const items = filtered();
    grid.innerHTML = items.map(cardHtml).join("");
    const empty = $("#projectEmpty");
    if (empty) empty.classList.toggle("hidden", items.length !== 0);
    const emptyText = $("#projectEmptyText");
    if (emptyText) {
      const untouched = !query && specialty === "all" && level === "all" && time === "all";
      emptyText.textContent =
        savedOnly && untouched
          ? "You have not saved a project yet. Choose a brief and use Save to build your shortlist."
          : "No project ideas match these filters. Try a different specialty, difficulty or search.";
    }
    updateStatusLine(items);
    updateStats();

    const cards = $$(".project-card", grid);
    if (!options.animate && window.canAnimate && window.canAnimate() && cards.length) {
      cards.forEach((el) => (el.style.opacity = "0"));
      window.anime({
        targets: cards,
        opacity: [0, 1],
        translateY: [12, 0],
        delay: window.anime.stagger(16),
        duration: 380,
        easing: "easeOutQuad",
      });
    }
  }

  function ideaById(id) {
    return PROJECTS.find((p) => p.id === id);
  }

  function refreshDialogStatus(id) {
    const dialog = $("#projectDialog");
    if (!dialog || !dialog.open) return;
    $$("[data-set-status]", dialog).forEach((btn) => {
      const on = progress[id] === btn.dataset.setStatus;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", String(on));
    });
  }

  function setStatus(id, status, options = {}) {
    if (!ideaById(id) || !STATUS[status]) return;
    if (progress[id] === status) delete progress[id];
    else progress[id] = status;
    writeState();
    updateStats();
    render({ animate: true });
    refreshDialogStatus(id);
    if (options.message) toast(options.message);
  }

  function toggleTracked(id) {
    if (!ideaById(id)) return;
    if (progress[id]) {
      delete progress[id];
      toast("Removed from your projects");
    } else {
      progress[id] = "saved";
      toast("Saved — find it under Saved only");
    }
    writeState();
    updateStats();
    render({ animate: true });
    refreshDialogStatus(id);
  }

  function toast(message) {
    if (typeof window.showToast === "function") window.showToast(message);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.append(area);
        area.select();
        const ok = document.execCommand("copy");
        area.remove();
        return ok;
      } catch {
        return false;
      }
    }
  }

  function fullBrief(idea) {
    const sp = SPECIALTY[idea.specialty] || { label: idea.specialty };
    return [
      idea.title,
      `${sp.label} · ${LEVELS[idea.level].label} · ${idea.time}`,
      "",
      idea.pitch,
      "",
      "WHY IT WORKS ON A CV",
      idea.why,
      "",
      "WHAT TO BUILD",
      idea.build,
      "",
      "KEY FEATURES",
      ...idea.features.map((feature) => `- ${feature}`),
      "",
      "HOW TO SHIP IT",
      ...idea.steps.map((step, index) => `${index + 1}. ${step}`),
      "",
      "STACK",
      idea.stack.join(", "),
      "",
      "CV BULLET",
      idea.bullet,
    ].join("\n");
  }

  function openProject(id) {
    const idea = ideaById(id);
    const dialog = $("#projectDialog");
    const body = $("#projectDialogBody");
    if (!idea || !dialog || !body) return;
    const sp = SPECIALTY[idea.specialty] || { label: idea.specialty, accent: "brand", resources: [] };
    const status = progress[idea.id];
    const resources = (sp.resources || [])
      .map((resource) => {
        const href = safeUrl(resource.url);
        return href
          ? `<li><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(resource.label)} <span aria-hidden="true">↗</span></a></li>`
          : "";
      })
      .join("");
    const statusButtons = Object.entries(STATUS)
      .map(
        ([key, meta]) =>
          `<button type="button" class="project-status-btn${status === key ? " active" : ""}" data-set-status="${key}" aria-pressed="${status === key}">${meta.label}</button>`
      )
      .join("");

    body.innerHTML = `<div class="project-dialog-head" data-accent="${escapeHtml(sp.accent)}">
      <div class="project-dialog-kicker">${escapeHtml(sp.label)} · ${escapeHtml(LEVELS[idea.level].label)} · ${escapeHtml(idea.time)}</div>
      <h2 id="projectDialogTitle">${escapeHtml(idea.title)}</h2>
      <p class="project-dialog-pitch">${escapeHtml(idea.pitch)}</p>
    </div>
    <div class="project-detail-grid">
      <div class="project-detail-main">
        <section class="project-detail-section">
          <h3>What you will build</h3>
          <p>${escapeHtml(idea.build)}</p>
          <ul class="project-feature-list">${idea.features.map((f) => `<li>${ICON_CHECK}<span>${escapeHtml(f)}</span></li>`).join("")}</ul>
        </section>
        <section class="project-detail-section">
          <h3>How to ship it</h3>
          <ol class="project-step-list">${idea.steps.map((s) => `<li><span>${escapeHtml(s)}</span></li>`).join("")}</ol>
        </section>
        <section class="project-bullet-card">
          <div class="project-bullet-head">
            <div><span class="project-bullet-kicker">CV-ready bullet</span><h3>Put it on your résumé</h3></div>
            <button type="button" class="mini-btn primary" data-copy="bullet">Copy bullet</button>
          </div>
          <p class="project-bullet-text" data-bullet-text>${escapeHtml(idea.bullet)}</p>
          <p class="project-bullet-hint">Swap each [X] for a real number once you have shipped. Honest metrics matter more than big ones.</p>
        </section>
      </div>
      <aside class="project-detail-side">
        <div class="project-why">
          <span class="project-side-kicker">Why it earns a place</span>
          <p>${escapeHtml(idea.why)}</p>
        </div>
        <div class="project-side-block">
          <h3>Stack</h3>
          <div class="project-stack project-stack--detail">${idea.stack.map((s) => `<span class="project-tag">${escapeHtml(s)}</span>`).join("")}</div>
        </div>
        <div class="project-side-block">
          <h3>Your progress</h3>
          <div class="project-status-row">${statusButtons}</div>
          <p class="project-side-hint">Saved, building and shipped states sync with your account.</p>
        </div>
        ${resources ? `<div class="project-side-block"><h3>Free starting points</h3><ul class="project-resource-list">${resources}</ul></div>` : ""}
        <div class="project-side-block project-side-actions">
          <h3>Use it right away</h3>
          <button type="button" class="project-action-btn" data-add-portfolio>Add to Portfolio Studio <span aria-hidden="true">↗</span></button>
          <button type="button" class="project-action-btn" data-add-resume>Add to Resume Studio <span aria-hidden="true">↗</span></button>
          <button type="button" class="project-action-btn" data-copy="brief">Copy full brief</button>
        </div>
      </aside>
    </div>`;

    body.dataset.id = idea.id;
    if (!dialog.open) dialog.showModal();
    const inner = dialog.querySelector(".project-dialog-inner");
    if (inner) inner.scrollTop = 0;
    const close = $("#projectDialogClose");
    if (close) close.focus({ preventScroll: true });
  }

  function addToPortfolio(idea) {
    const tab = document.querySelector('.nav-tab[data-tab="portfolio"]');
    if (!tab) return;
    $("#projectDialog")?.close();
    tab.click();
    const sp = SPECIALTY[idea.specialty] || { short: "" };
    const payload = {
      title: idea.title,
      subtitle: sp.short ? `${sp.short} project` : "Portfolio project",
      period: "",
      description: `${idea.build}\n\nBuilt with ${idea.stack.join(", ")}.`,
      url: "",
    };
    (async () => {
      try {
        await window.techmapPortfolio?.ensureReady?.();
        const result = window.techmapPortfolio?.addProjectIdea?.(payload);
        if (result === true) toast("Added to Portfolio Studio — review and save it there");
        else if (result === "duplicate") toast("That project is already in your portfolio editor");
        else if (result === "full") toast("Portfolio Studio allows up to 12 projects");
        else toast("Open Portfolio Studio to add this project");
      } catch {
        toast("Open Portfolio Studio to add this project");
      }
    })();
  }

  function addToResume(idea) {
    const field = document.getElementById("rProjects");
    if (!field) {
      toast("Resume Studio is not available on this page");
      return;
    }
    const line = `${idea.title} — ${idea.build} Stack: ${idea.stack.join(", ")}.`;
    if (field.value.toLowerCase().includes(idea.title.toLowerCase())) {
      toast("That project is already in your résumé projects");
      return;
    }
    field.value = (field.value.trim() ? `${field.value.trim()}\n` : "") + line;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    $("#projectDialog")?.close();
    document.querySelector('.nav-tab[data-tab="resume"]')?.click();
    toast("Added to Resume Studio — shorten it to one strong line");
  }

  function bindControls() {
    const search = $("#projectSearch");
    if (search) {
      let timer;
      search.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          query = search.value.trim().toLowerCase();
          render();
        }, 110);
      });
    }
    const levelSelect = $("#projectLevel");
    if (levelSelect) {
      levelSelect.addEventListener("change", () => {
        level = levelSelect.value;
        render();
      });
    }
    const timeSelect = $("#projectTime");
    if (timeSelect) {
      timeSelect.addEventListener("change", () => {
        time = timeSelect.value;
        render();
      });
    }
    const sortSelect = $("#projectSort");
    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        sort = sortSelect.value;
        render();
      });
    }
    const savedToggle = $("#projectSavedOnly");
    if (savedToggle) {
      savedToggle.addEventListener("change", () => {
        savedOnly = savedToggle.checked;
        render();
      });
    }
    const surprise = $("#projectSurprise");
    if (surprise) {
      surprise.addEventListener("click", () => {
        const pool = filtered();
        if (!pool.length) {
          toast("No projects match these filters");
          return;
        }
        openProject(pool[Math.floor(Math.random() * pool.length)].id);
      });
    }
    const quickWin = $("#projectQuickWin");
    if (quickWin) {
      quickWin.addEventListener("click", () => {
        specialty = "all";
        level = "all";
        time = "weekend";
        sort = "quickest";
        savedOnly = false;
        query = "";
        if (search) search.value = "";
        if (levelSelect) levelSelect.value = "all";
        if (timeSelect) timeSelect.value = "weekend";
        if (sortSelect) sortSelect.value = "quickest";
        if (savedToggle) savedToggle.checked = false;
        buildChips();
        render();
        $("#projectGrid")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    const reset = $("#projectReset");
    if (reset) {
      reset.addEventListener("click", () => {
        query = "";
        specialty = "all";
        level = "all";
        time = "all";
        sort = "recommended";
        savedOnly = false;
        if (search) search.value = "";
        if (levelSelect) levelSelect.value = "all";
        if (timeSelect) timeSelect.value = "all";
        if (sortSelect) sortSelect.value = "recommended";
        if (savedToggle) savedToggle.checked = false;
        buildChips();
        render();
      });
    }

    const grid = $("#projectGrid");
    if (grid) {
      grid.addEventListener("click", (event) => {
        const save = event.target.closest("[data-save]");
        if (save) {
          event.preventDefault();
          toggleTracked(save.dataset.save);
          return;
        }
        const open = event.target.closest("[data-open]");
        if (open) openProject(open.dataset.open);
      });
    }

    const dialog = $("#projectDialog");
    if (dialog) {
      $("#projectDialogClose")?.addEventListener("click", () => dialog.close());
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
      });
      dialog.addEventListener("click", (event) => {
        const id = $("#projectDialogBody")?.dataset.id;
        const idea = id ? ideaById(id) : null;
        if (!idea) return;

        const statusBtn = event.target.closest("[data-set-status]");
        if (statusBtn) {
          const next = statusBtn.dataset.setStatus;
          const was = progress[idea.id] === next;
          setStatus(
            idea.id,
            next,
            {
              message: was
                ? "Progress cleared"
                : next === "shipped"
                  ? "Shipped! Add the bullet to your résumé"
                  : next === "building"
                    ? "Marked as building — keep the scope small"
                    : "Saved to your project list",
            }
          );
          return;
        }

        const copyBtn = event.target.closest("[data-copy]");
        if (copyBtn) {
          const text = copyBtn.dataset.copy === "brief" ? fullBrief(idea) : idea.bullet;
          const label = copyBtn.dataset.copy === "brief" ? "Full brief copied" : "CV bullet copied";
          copyText(text).then((ok) => toast(ok ? label : "Could not copy — select the text manually"));
          return;
        }

        if (event.target.closest("[data-add-portfolio]")) {
          addToPortfolio(idea);
          return;
        }
        if (event.target.closest("[data-add-resume]")) {
          addToResume(idea);
        }
      });
    }
  }

  function loadProjects() {
    if (!built) {
      buildChips();
      bindControls();
      updateStats();
      built = true;
    }
    render();
  }

  window.loadProjects = loadProjects;
})();
