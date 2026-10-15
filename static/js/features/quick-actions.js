(() => {
  const el = (id) => document.getElementById(id);
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
      "Four styles, an optional photo, and your story",
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
      "Workspace help",
      "Find your way around TechMap",
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