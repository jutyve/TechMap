const helpDialog = document.createElement("dialog");
helpDialog.className = "help-dialog";
helpDialog.setAttribute("aria-labelledby", "helpTitle");
helpDialog.innerHTML = `<button aria-label="Close help">✕</button><div class="eyebrow">MAKE YOURSELF AT HOME</div><h2 id="helpTitle">Find your next chapter.</h2><p>Discover companies, narrow your search, and compare up to three teams side by side. Save favorites and keep private notes in their profiles.</p><p>In Resume Studio, choose from four templates, add an optional photo, and preview your own details without AI. Print your finished resume or save it as a PDF.</p><p><strong>Shortcuts:</strong> press / to search or Ctrl/Cmd + K for quick actions. The header switch remembers your light or dark mode preference.</p><p>Your saved details and photo stay in this browser. Photos are never sent to the AI provider. AI polishing sends your form text to your configured provider.</p>`;
document.body.append(helpDialog);
helpDialog.querySelector("button").onclick = () => helpDialog.close();
document.getElementById("helpBtn").onclick = () => helpDialog.showModal();
helpDialog.addEventListener("click", (e) => {
  if (e.target === helpDialog) {
    const r = helpDialog.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      helpDialog.close();
  }
});
document.getElementById("exploreBtn").onclick = () => {
  document.getElementById("searchInput").focus({ preventScroll: true });
  document.querySelector(".directory-heading").scrollIntoView({
    behavior: reduceMotion ? "instant" : "smooth",
    block: "start",
  });
};
for (const mode of ["grid", "list"])
  document.getElementById(`${mode}View`).onclick = () => {
    document
      .getElementById("companiesGrid")
      .classList.toggle("list-mode", mode === "list");
    try {
      localStorage.setItem("techmap_layout", mode);
    } catch {}
    for (const m of ["grid", "list"]) {
      const b = document.getElementById(`${m}View`);
      b.classList.toggle("active", m === mode);
      b.setAttribute("aria-pressed", String(m === mode));
    }
  };
/* The dataset spells a few cities more than one way, so counters are merged
   case- and accent-insensitively and each hero node shows its own total. */
const cityKey = (name) =>
  String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

apiJson("/stats")
  .then((stats) => {
    const cities = new Map();
    for (const [name, count] of Object.entries(stats.city_distribution || {})) {
      const key = cityKey(name);
      if (key) cities.set(key, (cities.get(key) || 0) + count);
    }
    const specialties = new Set(
      Object.keys(stats.specialty_distribution || {}).map(cityKey),
    );

    document.getElementById("heroCompanies").textContent =
      stats.total_companies.toLocaleString();
    document.getElementById("heroCities").textContent = cities.size;
    document.getElementById("heroSpecialties").textContent = specialties.size;

    document.querySelectorAll("[data-city-count]").forEach((node) => {
      const count = cities.get(cityKey(node.dataset.cityCount));
      node.textContent = count ? count.toLocaleString() : "—";
      if (!count) node.closest(".city-node")?.classList.add("hidden");
    });
  })
  .catch(() => {});
for (const id of ["analyzer", "resume", "assistant"]) {
  const note = document.createElement("p");
  note.className = "ai-notice";
  note.textContent =
    id === "resume"
      ? "Make it yours · Preview locally for free. AI polishing is optional and needs a configured provider."
      : "AI-powered · Needs a configured AI provider. Your input is sent to that provider — review generated content before using it.";
  document.querySelector(`#${id} .panel-header`).after(note);
}
/* Appearance: an explicit choice overrides the OS preference. */
const THEME_ICONS = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.4v2.2M12 19.4v2.2M2.4 12h2.2M19.4 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M20.4 14.7A8.7 8.7 0 0 1 9.3 3.6a8.7 8.7 0 1 0 11.1 11.1Z"/></svg>',
};
function paintThemeToggle() {
  const dark = document.documentElement.dataset.theme === "dark";
  document.getElementById("themeIcon").innerHTML = dark
    ? THEME_ICONS.sun
    : THEME_ICONS.moon;
  document.getElementById("themeLabel").textContent = dark
    ? "Light mode"
    : "Dark mode";
  document
    .getElementById("themeToggle")
    .setAttribute("aria-label", `Switch to ${dark ? "light" : "dark"} mode`);
}
document.getElementById("themeToggle").onclick = () => {
  const next =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("techmap_theme", next);
  } catch {}
  paintThemeToggle();
};
window.addEventListener("themechange", paintThemeToggle);
paintThemeToggle();
try {
  if (localStorage.getItem("techmap_layout") === "list")
    document.getElementById("listView").click();
} catch {}

/* Sorting and contact filters are applied by the API before pagination. */
for (const [id, key] of [
  ["sortFilter", "sort"],
  ["contactFilter", "contact"],
]) {
  document.getElementById(id).onchange = (event) => {
    state[key] = event.target.value;
    loadCompanies(true);
  };
}
window.updateFilterSummary = () => {
  const parts = [];
  if (state.search) parts.push(`“${state.search}”`);
  if (state.city !== "all") parts.push(state.city);
  if (state.specs.size)
    parts.push(
      `${state.specs.size} specialt${state.specs.size === 1 ? "y" : "ies"} (${state.matchAll ? "match all" : "match any"})`,
    );
  if (state.contact !== "all")
    parts.push(
      document.getElementById("contactFilter").selectedOptions[0].textContent,
    );
  const changed = parts.length || state.sort !== "recommended";
  document
    .getElementById("filterSummary")
    .classList.toggle("hidden", !changed || state.view !== "all");
  document.getElementById("filterSummaryText").textContent = parts.length
    ? `Filtered by: ${parts.join(" · ")}`
    : "Custom sort applied";
};
document.getElementById("resetFilters").onclick = () => {
  state.search = "";
  state.city = "all";
  state.specs.clear();
  state.matchAll = false;
  state.contact = "all";
  state.sort = "recommended";
  document.getElementById("searchInput").value = "";
  document.getElementById("cityFilter").value = "all";
  document.getElementById("contactFilter").value = "all";
  document.getElementById("sortFilter").value = "recommended";
  document.getElementById("matchAll").checked = false;
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.remove("active");
    chip.setAttribute("aria-pressed", "false");
  });
  updateClearButton();
  loadCompanies(true);
};
document.addEventListener("keydown", (event) => {
  if (
    event.key !== "/" ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.target.closest('input, textarea, select, [contenteditable="true"]') ||
    document.querySelector("dialog[open], .detail-overlay:not(.hidden)")
  )
    return;
  event.preventDefault();
  document.querySelector('.nav-tabs [data-tab="companies"]').click();
  document.querySelector('[data-view="all"]').click();
  document.getElementById("searchInput").focus();
});

/* A deliberately small comparison shortlist, independent of current filters. */
const comparedCompanies = new Map();
window.isCompared = (id) => comparedCompanies.has(Number(id));
function updateComparison() {
  const count = comparedCompanies.size;
  document
    .getElementById("compareTray")
    .classList.toggle("hidden", count === 0);
  document.body.classList.toggle("has-comparison", count > 0);
  document.getElementById("compareCount").textContent =
    `${count} of 3 companies selected`;
  document.getElementById("openCompare").disabled = count < 2;
  const names = document.getElementById("compareNames");
  names.replaceChildren();
  for (const company of comparedCompanies.values()) {
    const button = document.createElement("button");
    button.textContent = `${truncate(company.company_name, 24)} ×`;
    button.setAttribute(
      "aria-label",
      `Remove ${company.company_name} from comparison`,
    );
    button.onclick = () => {
      comparedCompanies.delete(company.id);
      updateComparison();
    };
    names.append(button);
  }
  document.querySelectorAll("[data-compare-id]").forEach((button) => {
    const selected = isCompared(button.dataset.compareId);
    button.setAttribute("aria-pressed", String(selected));
    button.textContent = selected
      ? "✓ Selected for comparison"
      : "+ Add to comparison";
  });
}
window.toggleCompare = (company) => {
  if (comparedCompanies.has(company.id)) comparedCompanies.delete(company.id);
  else if (comparedCompanies.size >= 3) {
    showToast("Compare up to 3 companies. Remove one to add another.");
    return;
  } else comparedCompanies.set(company.id, company);
  updateComparison();
};
document.getElementById("clearCompare").onclick = () => {
  comparedCompanies.clear();
  updateComparison();
};
const compareDialog = document.getElementById("compareDialog");
document.getElementById("closeCompare").onclick = () => compareDialog.close();
document.getElementById("openCompare").onclick = () => {
  const companies = [...comparedCompanies.values()];
  if (companies.length < 2) return;
  const text = (value) => escapeHtml(value || "Not listed");
  const link = (url, label) =>
    safeUrl(url)
      ? `<a href="${escapeHtml(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`
      : '<span class="muted">Not listed</span>';
  const rows = [
    ["City", (c) => text(c.city)],
    ["Specialties", (c) => text(c.specialties.join(" · "))],
    ["About", (c) => text(truncate(c.description, 350))],
    ["Website", (c) => link(c.website, "Visit website")],
    ["Careers", (c) => link(c.careers_url, "View careers")],
    ["Email", (c) => text(c.apply_email)],
    ["Phone", (c) => text(c.phone)],
  ];
  document.getElementById("compareContent").innerHTML =
    `<div class="comparison-scroll" tabindex="0" aria-label="Company comparison table, scroll horizontally for more"><table class="comparison-table"><thead><tr><th scope="col">At a glance</th>${companies.map((c) => `<th scope="col">${text(c.company_name)}<button class="mini-btn compare-save" data-save-id="${c.id}">${isFavorite(c.id) ? "★ Saved" : "☆ Save company"}</button></th>`).join("")}</tr></thead><tbody>${rows.map(([label, render]) => `<tr><th scope="row">${label}</th>${companies.map((c) => `<td>${render(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  document.querySelectorAll(".compare-save").forEach((button) => {
    button.onclick = () => {
      toggleFavorite(button.dataset.saveId);
      button.textContent = isFavorite(button.dataset.saveId)
        ? "★ Saved"
        : "☆ Save company";
      if (state.view === "favorites") loadFavoritesView();
    };
  });
  compareDialog.showModal();
};

/* Private notes: plain text only; saved explicitly to this browser. */
window.addCompanyNotes = (company) => {
  let notes = {};
  try {
    const parsed = JSON.parse(
      localStorage.getItem("techmap_company_notes") || "{}",
    );
    if (parsed && !Array.isArray(parsed) && typeof parsed === "object")
      notes = parsed;
  } catch {}
  const section = document.createElement("section");
  section.className = "company-notes";
  section.innerHTML = `<div class="notes-heading"><div><h3>Your private notes</h3><p>Keep track of your research, contacts, and next steps. Stored only in this browser.</p></div><span aria-hidden="true">✎</span></div><label for="companyNote" class="sr-only">Notes for ${escapeHtml(company.company_name)}</label><textarea id="companyNote" maxlength="5000" rows="4" placeholder="Who would you like to reach out to? What stands out about this team?"></textarea><div class="notes-actions"><span id="noteStatus" role="status">Up to 5,000 characters</span><button id="saveCompanyNote" class="mini-btn primary">Save note</button></div>`;
  // Use company identity rather than row ID so notes survive dataset reordering.
  const key = JSON.stringify([company.company_name, company.city]);
  const area = section.querySelector("textarea");
  area.value = typeof notes[key] === "string" ? notes[key] : "";
  area.oninput = () => {
    section.querySelector("#noteStatus").textContent = "Unsaved changes";
  };
  section.querySelector("button").onclick = () => {
    try {
      const current = JSON.parse(
        localStorage.getItem("techmap_company_notes") || "{}",
      );
      if (!current || typeof current !== "object" || Array.isArray(current))
        throw Error("Invalid notes");
      if (area.value.trim()) current[key] = area.value;
      else delete current[key];
      localStorage.setItem("techmap_company_notes", JSON.stringify(current));
      section.querySelector("#noteStatus").textContent =
        "Saved in this browser ✓";
    } catch {
      section.querySelector("#noteStatus").textContent =
        "Could not save. Browser storage may be full or unavailable.";
    }
  };
  document.getElementById("detailContent").append(section);
};