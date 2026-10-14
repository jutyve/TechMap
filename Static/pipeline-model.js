(function (root) {
  const stages = [
    { id: "saved", label: "On my radar", icon: "◇" },
    { id: "preparing", label: "Preparing", icon: "✎" },
    { id: "applied", label: "Applied", icon: "↗" },
    { id: "interviewing", label: "Interviewing", icon: "◎" },
    { id: "offer", label: "Offer", icon: "✧" },
    { id: "closed", label: "Closed", icon: "○" },
  ];
  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      return "";
    const d = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(d.getTime()) &&
      d.toISOString().slice(0, 10) === value
      ? value
      : "";
  }
  function today(now = new Date()) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }
  function normalize(value) {
    if (!Array.isArray(value)) return [];
    const text = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
    const ids = new Set();
    return value
      .filter(
        (item) =>
          item && typeof item === "object" && typeof item.company === "string",
      )
      .map((item, index) => {
        let id = text(item.id, 160) || `legacy-${index}`;
        while (ids.has(id)) id += "-duplicate";
        ids.add(id);
        const stage = stages.some((s) => s.id === item.stage)
          ? item.stage
          : "preparing";
        return {
          ...item,
          id,
          company: text(item.company, 160),
          role: text(item.role, 160),
          stage,
          notes: text(item.notes, 5000),
          link: text(item.link, 2000),
          followUp: validDate(item.followUp),
          date: text(item.date, 64),
          updatedAt: text(item.updatedAt, 64),
        };
      });
  }
  function isDue(item, day = today()) {
    return (
      !!item.followUp &&
      item.followUp <= day &&
      !["closed", "offer"].includes(item.stage)
    );
  }
  function select(items, query, scope, day = today()) {
    const needle = query.trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (scope === "due" && !isDue(item, day)) return false;
      if (scope === "active" && ["closed", "offer"].includes(item.stage))
        return false;
      if (scope === "closed" && item.stage !== "closed") return false;
      return [item.company, item.role, item.notes]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle);
    });
  }
  function csv(items) {
    const fields = ["company", "role", "stage", "followUp", "link", "notes"];
    const cell = (value) => {
      let text = String(value || "");
      if (/^[\s]*[=+@\-]/.test(text) || /^[\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    return (
      "\uFEFF" +
      [fields, ...items.map((item) => fields.map((field) => item[field]))]
        .map((row) => row.map(cell).join(","))
        .join("\r\n")
    );
  }
  const model = { stages, validDate, today, normalize, isDue, select, csv };
  if (typeof module !== "undefined" && module.exports) module.exports = model;
  else root.PipelineModel = model;
})(typeof window !== "undefined" ? window : globalThis);

Static/pipeline.js
+534
/* Local-first opportunity pipeline. No provider calls and no automatic sending. */
(() => {
  const M = window.PipelineModel;
  const storageKey = "techmap_applications";
  const el = (id) => document.getElementById(id);
  let layout = "board";
  let editingId = null;
  let editorSnapshot = "";
  const newId = () =>
    globalThis.crypto?.randomUUID?.() ||
    `op-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const editorValue = () =>
    JSON.stringify(
      ["opCompany", "opRole", "opStage", "opFollowUp", "opLink", "opNotes"].map(
        (id) => el(id).value,
      ),
    );
  function requestEditorClose() {
    if (
      editorValue() !== editorSnapshot &&
      !confirm("Discard your unsaved opportunity changes?")
    )
      return;
    el("opportunityDialog").close();
  }
  let removed = null;
  let readError = "";
  try {
    if (localStorage.getItem("techmap_pipeline_layout") === "list")
      layout = "list";
  } catch {}

  function read() {
    readError = "";
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (!Array.isArray(value)) throw Error("Invalid saved data");
      return M.normalize(value);
    } catch {
      readError =
        "Your saved opportunities could not be read. Restore a workspace backup or enable browser storage. Existing data has not been replaced.";
      return [];
    }
  }
  function write(items) {
    if (readError) throw Error(readError);
    // Never silently truncate a person's tracked applications.
    localStorage.setItem(storageKey, JSON.stringify(items));
  }
  function saveError(error) {
    showToast(
      error.message === readError
        ? readError
        : "Could not save. Browser storage may be full or unavailable.",
    );
  }
  const stageOptions = (selected) =>
    M.stages
      .map(
        (stage) =>
          `<option value="${stage.id}" ${selected === stage.id ? "selected" : ""}>${stage.label}</option>`,
      )
      .join("");
  function dateLabel(value) {
    if (!M.validDate(value)) return "";
    return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  function card(item) {
    const due = M.isDue(item);
    const reminder = item.followUp
      ? `<span class="follow-up ${due ? "is-due" : ""}">${due ? "◷ Follow-up due" : "◷ Follow up"} · ${escapeHtml(dateLabel(item.followUp))}</span>`
      : '<span class="follow-up">No follow-up scheduled</span>';
    return `<article class="opportunity-card" data-op-id="${escapeHtml(item.id)}"><div class="op-card-heading"><span class="op-monogram" aria-hidden="true">${escapeHtml(item.company.slice(0, 2).toUpperCase())}</span><button class="op-edit" data-edit="${escapeHtml(item.id)}" aria-label="Edit opportunity at ${escapeHtml(item.company)}">Edit ↗</button></div><h3>${escapeHtml(item.company)}</h3><p class="op-role">${escapeHtml(item.role || "Exploring possibilities")}</p>${item.notes ? `<p class="op-note">${escapeHtml(truncate(item.notes, 120))}</p>` : '<p class="op-note op-note-empty">Add a note to make your next step clear.</p>'}<div class="op-reminder">${reminder}</div><div class="op-card-footer"><label class="sr-only" for="stage-${escapeHtml(item.id)}">Stage for ${escapeHtml(item.company)}</label><select id="stage-${escapeHtml(item.id)}" data-stage="${escapeHtml(item.id)}">${stageOptions(item.stage)}</select>${safeUrl(item.link) ? `<a href="${escapeHtml(safeUrl(item.link))}" target="_blank" rel="noopener noreferrer" aria-label="Open job link for ${escapeHtml(item.company)}">Link ↗</a>` : ""}</div></article>`;
  }
  window.renderPipeline = () => {
    const items = read();
    const filtered = M.select(
      items,
      el("pipelineSearch").value,
      el("pipelineScope").value,
    );
    const due = items.filter((item) => M.isDue(item)).length;
    const applied = items.filter((item) =>
      ["applied", "interviewing", "offer"].includes(item.stage),
    ).length;
    el("pipelineMetrics").innerHTML =
      `<button data-scope="all"><span class="metric-symbol">◇</span><div><strong>${items.length}</strong><span>Opportunities tracked</span></div></button><div><span class="metric-symbol">↗</span><div><strong>${applied}</strong><span>Applied or beyond</span></div></div><button data-scope="due" class="${due ? "metric-due" : ""}"><span class="metric-symbol">◷</span><div><strong>${due}</strong><span>Follow-ups due</span></div></button><div><span class="metric-symbol">✧</span><div><strong>${items.filter((item) => item.stage === "offer").length}</strong><span>Offers recorded</span></div></div>`;
    el("pipelineCount").textContent =
      readError ||
      `${filtered.length} ${filtered.length === 1 ? "opportunity" : "opportunities"}${filtered.length !== items.length ? ` of ${items.length}` : ""} · ${layout === "board" ? "Move stages using each card’s dropdown" : "Your pipeline at a glance"}`;
    el("pipelineBoard").classList.toggle("active", layout === "board");
    el("pipelineBoard").setAttribute(
      "aria-pressed",
      String(layout === "board"),
    );
    el("pipelineList").classList.toggle("active", layout === "list");
    el("pipelineList").setAttribute("aria-pressed", String(layout === "list"));
    el("applicationsEmpty").classList.toggle(
      "hidden",
      items.length > 0 || !!readError,
    );
    el("boardNavigation").classList.toggle(
      "hidden",
      layout !== "board" || !filtered.length,
    );
    requestAnimationFrame(syncBoardNavigation);
    const wrap = el("applicationsList");
    wrap.className =
      layout === "board" ? "opportunity-board" : "opportunity-list";
    if (!items.length) wrap.innerHTML = "";
    else if (!filtered.length)
      wrap.innerHTML =
        '<div class="pipeline-no-results"><h3>No opportunities match this view.</h3><p>Try another search, or show your full pipeline.</p><button id="resetPipelineView" class="mini-btn">Clear search & filters</button></div>';
    else if (layout === "board")
      wrap.innerHTML = M.stages
        .map((stage) => {
          const stageItems = filtered.filter((item) => item.stage === stage.id);
          return `<section class="pipeline-column stage-${stage.id}" aria-label="${stage.label}"><header><h2><span aria-hidden="true">${stage.icon}</span> ${stage.label}</h2><span>${stageItems.length}</span></header><div class="pipeline-column-cards">${stageItems.map(card).join("") || '<p class="empty-column">Room for your next step.</p>'}</div><button class="stage-add" data-add-stage="${stage.id}">+ Add opportunity</button></section>`;
        })
        .join("");
    else wrap.innerHTML = filtered.map(card).join("");
    const reset = el("resetPipelineView");
    if (reset)
      reset.onclick = () => {
        el("pipelineSearch").value = "";
        el("pipelineScope").value = "all";
        renderPipeline();
      };
  };

  function syncBoardNavigation() {
    const board = el("applicationsList");
    el("previousStages").disabled = board.scrollLeft <= 1;
    el("nextStages").disabled =
      board.scrollLeft + board.clientWidth >= board.scrollWidth - 1;
  }
  el("applicationsList").addEventListener("scroll", syncBoardNavigation, {
    passive: true,
  });
  window.addEventListener("resize", syncBoardNavigation);
  el("previousStages").onclick = () =>
    el("applicationsList").scrollBy({
      left: -280,
      behavior: reduceMotion ? "instant" : "smooth",
    });
  el("nextStages").onclick = () =>
    el("applicationsList").scrollBy({
      left: 280,
      behavior: reduceMotion ? "instant" : "smooth",
    });

  window.pipelineRecord = (entry) => {
    const items = read();
    const now = new Date().toISOString();
    const item = M.normalize([
      {
        ...entry,
        id: newId(),
        stage: "preparing",
        date: now,
        updatedAt: now,
      },
    ])[0];
    try {
      write([item, ...items]);
      renderPipeline();
    } catch (error) {
      saveError(error);
    }
  };
  function openEditor(item = null, defaults = {}) {
    editingId = item?.id || null;
    el("opportunityTitle").textContent = item
      ? "Make your next step clear."
      : "Add an opportunity";
    el("opCompany").value = item?.company || defaults.company || "";
    el("opRole").value = item?.role || "";
    el("opStage").innerHTML = stageOptions(
      item?.stage || defaults.stage || "saved",
    );
    el("opFollowUp").value = item?.followUp || "";
    el("opLink").value = item?.link || defaults.link || "";
    el("opNotes").value = item?.notes || "";
    el("opError").textContent = "";
    el("deleteOpportunity").classList.toggle("hidden", !item);
    editorSnapshot = editorValue();
    el("opportunityDialog").showModal();
    el("opCompany").focus();
  }
  el("addOpportunity").onclick = () => openEditor();
  el("emptyAddOpportunity").onclick = () => openEditor();
  el("closeOpportunity").onclick = requestEditorClose;
  el("opportunityDialog").addEventListener("cancel", (event) => {
    event.preventDefault();
    requestEditorClose();
  });
  el("pipelineBackupHelp").onclick = () => el("helpBtn").click();
  el("opportunityForm").onsubmit = (event) => {
    event.preventDefault();
    const company = el("opCompany").value.trim();
    const link = el("opLink").value.trim();
    const followUp = el("opFollowUp").value;
    if (!company) {
      el("opError").textContent = "Please enter a company name.";
      return;
    }
    if (link && !safeUrl(link)) {
      el("opError").textContent = "Use a complete http:// or https:// link.";
      return;
    }
    if (followUp && !M.validDate(followUp)) {
      el("opError").textContent = "Please choose a valid follow-up date.";
      return;
    }
    const items = read();
    const existing = items.find((item) => item.id === editingId);
    if (editingId && !existing) {
      el("opError").textContent =
        "This entry changed in another tab. Close the editor and try again.";
      return;
    }
    const now = new Date().toISOString();
    const item = {
      ...existing,
      id: editingId || newId(),
      company,
      role: el("opRole").value.trim(),
      stage: el("opStage").value,
      followUp,
      link,
      notes: el("opNotes").value,
      date: existing?.date || now,
      updatedAt: now,
      type: existing?.type || "manual",
    };
    try {
      write(
        existing
          ? items.map((old) => (old.id === editingId ? item : old))
          : [item, ...items],
      );
      el("opportunityDialog").close();
      renderPipeline();
      showToast("Opportunity saved in this browser.");
    } catch {
      el("opError").textContent =
        readError ||
        "Could not save. Browser storage may be full or unavailable.";
    }
  };
  el("deleteOpportunity").onclick = () => {
    const items = read();
    const item = items.find((item) => item.id === editingId);
    if (!item) return;
    try {
      write(items.filter((old) => old.id !== item.id));
      removed = item;
      el("opportunityDialog").close();
      el("pipelineFeedback").classList.remove("hidden");
      el("pipelineFeedback").querySelector("span").textContent =
        `Removed ${item.company}.`;
      renderPipeline();
    } catch (error) {
      saveError(error);
    }
  };
  el("undoOpportunity").onclick = () => {
    if (!removed) return;
    const items = read();
    try {
      if (!items.some((item) => item.id === removed.id))
        write([removed, ...items]);
      removed = null;
      el("pipelineFeedback").classList.add("hidden");
      renderPipeline();
    } catch (error) {
      saveError(error);
    }
  };
  el("applicationsList").addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit]");
    const add = event.target.closest("[data-add-stage]");
    if (edit) {
      const item = read().find((item) => item.id === edit.dataset.edit);
      if (item) openEditor(item);
    }
    if (add) openEditor(null, { stage: add.dataset.addStage });
  });
  el("applicationsList").addEventListener("change", (event) => {
    const select = event.target.closest("[data-stage]");
    if (!select) return;
    const items = read();
    try {
      write(
        items.map((item) =>
          item.id === select.dataset.stage
            ? {
                ...item,
                stage: select.value,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
      renderPipeline();
      document.querySelectorAll("[data-stage]").forEach((button) => {
        if (button.dataset.stage === select.dataset.stage) button.focus();
      });
      showToast("Stage updated. No application was sent.");
    } catch (error) {
      saveError(error);
      renderPipeline();
    }
  });
  el("pipelineMetrics").onclick = (event) => {
    const button = event.target.closest("[data-scope]");
    if (button) {
      el("pipelineScope").value = button.dataset.scope;
      renderPipeline();
    }
  };
  el("pipelineSearch").oninput = renderPipeline;
  el("pipelineScope").onchange = renderPipeline;
  for (const mode of ["board", "list"])
    el(mode === "board" ? "pipelineBoard" : "pipelineList").onclick = () => {
      layout = mode;
      try {
        localStorage.setItem("techmap_pipeline_layout", mode);
      } catch {}
      renderPipeline();
    };
  el("exportPipeline").onclick = () => {
    const items = read();
    if (readError) {
      showToast(readError);
      return;
    }
    const filtered = M.select(
      items,
      el("pipelineSearch").value,
      el("pipelineScope").value,
    );
    downloadTextFile(
      "techmap-opportunities.csv",
      M.csv(filtered),
      "text/csv;charset=utf-8",
    );
    showToast(`Exported ${filtered.length} opportunities from this view.`);
  };
  window.addEventListener("storage", (event) => {
    if (event.key === storageKey) renderPipeline();
  });
  // Update follow-up counts when returning to the page, including after midnight.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) renderPipeline();
  });

  const originalNotes = window.addCompanyNotes;
  window.addCompanyNotes = (company) => {
    originalNotes?.(company);
    const cta = document.createElement("div");
    cta.className = "profile-track";
    const copy = document.createElement("div");
    copy.innerHTML =
      "<strong>See a possibility here?</strong><p>Turn your research into a next step. No AI needed.</p>";
    const button = document.createElement("button");
    button.className = "mini-btn primary";
    button.textContent = "+ Track opportunity";
    button.onclick = () => {
      document.getElementById("detailClose").click();
      document.querySelector('.nav-tabs [data-tab="applications"]').click();
      openEditor(null, {
        company: company.company_name,
        link: safeUrl(company.careers_url) || safeUrl(company.website),
      });
    };
    cta.append(copy, button);
    el("detailContent").prepend(cta);
  };

  /* Searchable quick actions, with keyboard navigation and native dialog focus. */
  const nav = (tab) =>
    document.querySelector(`.nav-tabs [data-tab="${tab}"]`).click();
  const commands = [
    [
      "Discover companies",
      "Explore Morocco’s tech ecosystem",
      "▦",
      () => nav("companies"),
    ],
    [
      "My applications",
      "Your opportunities and next steps",
      "↗",
      () => nav("applications"),
    ],
    [
      "Add opportunity",
      "Track a company or role manually",
      "+",
      () => {
        nav("applications");
        openEditor();
      },
    ],
    [
      "Follow-ups due",
      "See the conversations to pick back up",
      "◷",
      () => {
        nav("applications");
        el("pipelineScope").value = "due";
        renderPipeline();
      },
    ],
    [
      "Saved companies",
      "Your shortlist in one place",
      "☆",
      () => {
        nav("companies");
        document.querySelector('[data-view="favorites"]').click();
      },
    ],
    [
      "Ecosystem insights",
      "Get to know the directory",
      "▥",
      () => nav("dashboard"),
    ],
    [
      "Resume studio",
      "Build your next resume with AI",
      "▧",
      () => nav("resume"),
    ],
    [
      "Resume analyzer",
      "Review your resume with AI",
      "◎",
      () => nav("analyzer"),
    ],
    [
      "Career assistant",
      "Talk through your next move with AI",
      "✧",
      () => nav("assistant"),
    ],
    [
      "Switch color theme",
      "Change between light and dark mode",
      "◐",
      () => el("themeToggle").click(),
    ],
    [
      "Help & workspace backup",
      "Keep a portable copy of your saved work",
      "?",
      () => el("helpBtn").click(),
    ],
  ];
  let visible = commands,
    active = 0;
  function paintLauncher() {
    const input = el("launcherInput");
    const query = input.value.trim().toLowerCase();
    visible = commands.filter((c) =>
      (c[0] + " " + c[1]).toLowerCase().includes(query),
    );
    active = Math.max(0, Math.min(active, visible.length - 1));
    el("launcherResults").innerHTML =
      visible
        .map(
          (c, i) =>
            `<div role="option" id="command-${i}" data-command="${i}" aria-selected="${i === active}" class="launcher-option"><span aria-hidden="true">${c[2]}</span><div><strong>${c[0]}</strong><small>${c[1]}</small></div><span aria-hidden="true">↵</span></div>`,
        )
        .join("") ||
      '<p class="launcher-empty">No actions found. Try “resume” or “follow-up”.</p>';
    if (visible.length) {
      input.setAttribute("aria-activedescendant", `command-${active}`);
      el(`command-${active}`).scrollIntoView({ block: "nearest" });
    } else input.removeAttribute("aria-activedescendant");
  }
  function openLauncher() {
    if (document.querySelector("dialog[open], .detail-overlay:not(.hidden)"))
      return;
    el("launcherInput").value = "";
    active = 0;
    el("launcherDialog").showModal();
    paintLauncher();
    el("launcherInput").focus();
  }
  function execute(index) {
    const command = visible[index];
    if (!command) return;
    el("launcherDialog").close();
    command[3]();
  }
  el("openLauncher").onclick = openLauncher;
  el("closeLauncher").onclick = () => el("launcherDialog").close();
  el("launcherInput").oninput = () => {
    active = 0;
    paintLauncher();
  };
  el("launcherInput").onkeydown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (visible.length)
        active =
          (active + (event.key === "ArrowDown" ? 1 : -1) + visible.length) %
          visible.length;
      paintLauncher();
    }
    if (event.key === "Enter") {
      event.preventDefault();
      execute(active);
    }
  };
  el("launcherResults").onclick = (event) => {
    const option = event.target.closest("[data-command]");
    if (option) execute(Number(option.dataset.command));
  };
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (el("launcherDialog").open) el("launcherDialog").close();
      else openLauncher();
    }
  });
})();