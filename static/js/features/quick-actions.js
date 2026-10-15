(() => {
  const el = (id) => document.getElementById(id);
  /* Local line icons for each action. */
  const actionIcon = (paths) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  const ACTION_ICONS = {
    discover: actionIcon('<rect x="3" y="3" width="7.6" height="7.6" rx="2.2"/><rect x="13.4" y="3" width="7.6" height="7.6" rx="2.2"/><rect x="3" y="13.4" width="7.6" height="7.6" rx="2.2"/><rect x="13.4" y="13.4" width="7.6" height="7.6" rx="2.2"/>'),
    saved: actionIcon('<path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9-4.3-4.1 5.9-.8z"/>'),
    insights: actionIcon('<path d="M3.5 20.5h17"/><path d="M6.5 20.5v-6.2M11.4 20.5V7.8M16.3 20.5v-9.1M21 20.5V4.5"/>'),
    studio: actionIcon('<path d="M7 2.8h6.4L19 8.4v12a1.4 1.4 0 0 1-1.4 1.4H7a1.4 1.4 0 0 1-1.4-1.4V4.2A1.4 1.4 0 0 1 7 2.8Z"/><path d="M13.2 2.9v5.6H19"/><path d="M9 13.4h6M9 17h3.6"/>'),
    analyzer: actionIcon('<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="3.4"/><path d="M12 1.6v2.4M12 20v2.4M1.6 12h2.4M20 12h2.4"/>'),
    assistant: actionIcon('<path d="M11.4 3.4 13 8.6l5.2 1.6-5.2 1.6-1.6 5.2-1.6-5.2L4.6 10.2l5.2-1.6z"/><path d="M18.6 3.4v3.2M17 5h3.2"/>'),
    theme: actionIcon('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.4v2.2M12 19.4v2.2M2.4 12h2.2M19.4 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5"/>'),
    help: actionIcon('<circle cx="12" cy="12" r="8.6"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1.1.9-1.1 1.7v.3"/><path d="M12 17.2h.01"/>'),
  };
  /* Searchable quick actions, with keyboard navigation and native dialog focus. */
  const nav = (tab) =>
    document.querySelector(`.nav-tabs [data-tab="${tab}"]`).click();
  const commands = [
    [
      "Discover companies",
      "Explore Morocco’s tech ecosystem",
      ACTION_ICONS.discover,
      () => nav("companies"),
    ],
    [
      "Saved companies",
      "Your shortlist in one place",
      ACTION_ICONS.saved,
      () => {
        nav("companies");
        document.querySelector('[data-view="favorites"]').click();
      },
    ],
    [
      "Ecosystem insights",
      "Get to know the directory",
      ACTION_ICONS.insights,
      () => nav("dashboard"),
    ],
    [
      "Resume studio",
      "Four styles, an optional photo, and your story",
      ACTION_ICONS.studio,
      () => nav("resume"),
    ],
    [
      "Resume analyzer",
      "Review your resume with AI",
      ACTION_ICONS.analyzer,
      () => nav("analyzer"),
    ],
    [
      "Career assistant",
      "Talk through your next move with AI",
      ACTION_ICONS.assistant,
      () => nav("assistant"),
    ],
    [
      "Switch color theme",
      "Change between light and dark mode",
      ACTION_ICONS.theme,
      () => el("themeToggle").click(),
    ],
    [
      "Workspace help",
      "Find your way around TechMap",
      ACTION_ICONS.help,
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
      '<p class="launcher-empty">No actions found. Try “resume” or “companies”.</p>';
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