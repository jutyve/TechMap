/* Login / account page (login.html).
   Handles sign-in, registration with email verification, resending
   verification links, and the forgot/reset-password flow. When the server
   has no mail service configured it returns a clearly labelled dev link so
   the flow can still be completed locally. */
(() => {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const next = (() => {
    const value = params.get("next") || "";
    return value.startsWith("/") && !value.startsWith("//") ? value : "/";
  })();

  if (next === "/?studio=portfolio") $("authBack").href = next;

  const views = ["viewAuth", "viewCheckEmail", "viewForgot", "viewForgotSent", "viewReset", "viewAccount"];
  function showView(id) {
    views.forEach((view) => $(view).classList.toggle("hidden", view !== id));
    window.scrollTo({ top: 0 });
  }

  function showAlert(type, message) {
    const box = $("authAlert");
    box.className = `auth-alert ${type || ""}`;
    box.textContent = message;
  }
  function clearAlert() {
    $("authAlert").classList.add("hidden");
  }

  async function api(path, options = {}) {
    const response = await fetch(`/api${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    let body = {};
    try {
      body = await response.json();
    } catch {
      /* non-JSON response */
    }
    if (!response.ok) {
      const detail = body.detail;
      const error = new Error(
        typeof detail === "string"
          ? detail
          : detail?.message || `Request failed (${response.status})`
      );
      error.code = typeof detail === "object" ? detail?.code : undefined;
      error.status = response.status;
      throw error;
    }
    return body;
  }

  function devLink(boxId, url, label) {
    const box = $(boxId);
    if (!url) {
      box.classList.add("hidden");
      box.innerHTML = "";
      return;
    }
    box.innerHTML =
      `<span class="dev-tag">Dev mode</span><br />` +
      `No mail server is configured on this server, so no real email was sent. ` +
      `Use this link instead (it is also printed in the server console):<br />` +
      `<a href="${url}">${label}</a>`;
    box.classList.remove("hidden");
  }

  function setBusy(button, busy, busyLabel) {
    if (busy) {
      button.dataset.label = button.textContent;
      button.textContent = busyLabel;
      button.disabled = true;
    } else {
      button.textContent = button.dataset.label || button.textContent;
      button.disabled = false;
    }
  }

  /* --- Password visibility toggles --- */
  document.querySelectorAll(".pw-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const input = $(button.dataset.target);
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      button.textContent = showing ? "Show" : "Hide";
      button.setAttribute("aria-label", showing ? "Show password" : "Hide password");
      input.focus();
    });
  });

  /* --- Tabs --- */
  function selectTab(register) {
    clearAlert();
    $("tabSignin").classList.toggle("active", !register);
    $("tabRegister").classList.toggle("active", register);
    $("tabSignin").setAttribute("aria-selected", String(!register));
    $("tabRegister").setAttribute("aria-selected", String(register));
    $("signinForm").classList.toggle("hidden", register);
    $("registerForm").classList.toggle("hidden", !register);
    $("authTitle").textContent = register ? "Create your account" : "Welcome back";
    $("authSubtitle").textContent = register
      ? "One account for your companies, notes and resume — saved everywhere you sign in."
      : "Sign in to pick up right where you left off.";
    (register ? $("rgName") : $("siEmail")).focus();
  }
  $("tabSignin").addEventListener("click", () => selectTab(false));
  $("tabRegister").addEventListener("click", () => selectTab(true));
  if (params.get("mode") === "register") selectTab(true);

  document.querySelectorAll("[data-back-to-auth]").forEach((button) =>
    button.addEventListener("click", () => {
      clearAlert();
      showView("viewAuth");
      selectTab(false);
    })
  );
  $("backToSignin").addEventListener("click", () => {
    clearAlert();
    showView("viewAuth");
    selectTab(false);
  });

  /* --- Sign in --- */
  $("signinForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAlert();
    $("unverifiedBox").classList.add("hidden");
    const button = $("signinSubmit");
    setBusy(button, true, "Signing in…");
    try {
      await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: $("siEmail").value.trim(),
          password: $("siPassword").value,
        }),
      });
      location.assign(next === "/" ? "/?signedin=1" : next);
    } catch (error) {
      showAlert("error", error.message);
      if (error.code === "email_not_verified") {
        $("unverifiedBox").classList.remove("hidden");
        devLink("unverifiedDev", "", "");
      }
    } finally {
      setBusy(button, false);
    }
  });

  /* --- Resend verification --- */
  let pendingEmail = "";
  async function resendVerification(email, devBoxId, devLabel, button) {
    if (!email) {
      showAlert("error", "Enter your email address first.");
      return;
    }
    setBusy(button, true, "Sending…");
    try {
      const result = await api("/auth/verify/resend", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      showAlert("success", result.message);
      if (devBoxId) devLink(devBoxId, result.dev_verification_url, devLabel);
    } catch (error) {
      showAlert("error", error.message);
    } finally {
      setBusy(button, false);
    }
  }
  $("resendFromSignin").addEventListener("click", (event) =>
    resendVerification($("siEmail").value.trim(), "unverifiedDev", "Verify my email", event.currentTarget)
  );
  $("resendFromCheck").addEventListener("click", (event) =>
    resendVerification(pendingEmail, "checkDev", "Verify my email", event.currentTarget)
  );

  /* --- Register --- */
  $("registerForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAlert();
    const password = $("rgPassword").value;
    if (password.length < 8) {
      showAlert("error", "Password must be at least 8 characters.");
      return;
    }
    if (password !== $("rgPassword2").value) {
      showAlert("error", "The two passwords don't match.");
      return;
    }
    const button = $("registerSubmit");
    setBusy(button, true, "Creating your account…");
    try {
      const result = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: $("rgName").value.trim(),
          email: $("rgEmail").value.trim(),
          password,
        }),
      });
      if (!result.needs_verification) {
        location.assign(next === "/" ? "/?signedin=1" : next);
        return;
      }
      pendingEmail = result.email;
      $("checkEmailAddress").textContent = result.email;
      devLink("checkDev", result.dev_verification_url, "Verify my email");
      if (result.message) showAlert("success", result.message);
      showView("viewCheckEmail");
    } catch (error) {
      showAlert("error", error.message);
    } finally {
      setBusy(button, false);
    }
  });

  /* --- Forgot / reset password --- */
  $("forgotLink").addEventListener("click", () => {
    clearAlert();
    $("fpEmail").value = $("siEmail").value.trim();
    showView("viewForgot");
    $("fpEmail").focus();
  });

  $("forgotForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAlert();
    const button = $("forgotSubmit");
    setBusy(button, true, "Sending…");
    try {
      const result = await api("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: $("fpEmail").value.trim() }),
      });
      devLink("forgotDev", result.dev_reset_url, "Choose a new password");
      showView("viewForgotSent");
    } catch (error) {
      showAlert("error", error.message);
    } finally {
      setBusy(button, false);
    }
  });

  const resetToken = params.get("reset_token") || "";
  if (resetToken) showView("viewReset");

  $("resetForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAlert();
    const password = $("rsPassword").value;
    if (password.length < 8) {
      showAlert("error", "Password must be at least 8 characters.");
      return;
    }
    if (password !== $("rsPassword2").value) {
      showAlert("error", "The two passwords don't match.");
      return;
    }
    const button = $("resetSubmit");
    setBusy(button, true, "Saving…");
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: resetToken, password }),
      });
      location.assign("/?reset=1");
    } catch (error) {
      showAlert("error", error.message);
    } finally {
      setBusy(button, false);
    }
  });

  /* --- Account view (already signed in) --- */
  function initials(name, email) {
    const parts = String(name || email || "?").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    const first = parts[0][0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase() || "?";
  }

  let selectedPhoto = '';
  const accountPicker = techmapPhotos.picker($("accountPhotoPicker"), "Account photo", {
    async onChange(photo) {
      await techmapPhotos.accountPhoto(photo);
      selectedPhoto = photo;
      techmapPhotos.avatar($("accountAvatar"), photo);
    },
  });

  function paintAccount(user) {
    $("accountAvatar").textContent = initials(user.name, user.email);
    techmapPhotos.avatar($("accountAvatar"), selectedPhoto);
    $("accountNameDisplay").textContent = user.name || "Your account";
    $("accountEmailDisplay").textContent = user.email;
    $("accountVerifiedBadge").classList.toggle("hidden", !user.is_verified);
    $("acName").value = user.name || "";
  }

  $("profileForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAlert();
    try {
      const result = await api("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ name: $("acName").value.trim() }),
      });
      paintAccount(result.user);
      showAlert("success", "Name saved.");
    } catch (error) {
      showAlert("error", error.message);
    }
  });

  $("accountSignOut").addEventListener("click", async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* already signed out */
    }
    showView("viewAuth");
    selectTab(false);
    showAlert("success", "You're signed out. Your work on this device stays available locally.");
  });

  $("deleteReveal").addEventListener("click", () => {
    $("deleteForm").classList.remove("hidden");
    $("delPassword").focus();
  });

  $("deleteForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAlert();
    const button = $("deleteSubmit");
    setBusy(button, true, "Deleting…");
    try {
      await api("/auth/delete-account", {
        method: "POST",
        body: JSON.stringify({ password: $("delPassword").value }),
      });
      location.assign("/");
    } catch (error) {
      showAlert("error", error.message);
      setBusy(button, false);
    }
  });

  /* --- Landing state --- */
  if (params.get("error") === "invalid_token") {
    showAlert(
      "error",
      "That verification link is invalid or has expired. Sign in to get a fresh one."
    );
  }
  if (location.protocol === "file:") {
    showAlert(
      "error",
      "You opened this file directly from a folder, so it can't reach the backend. Start the app with `python run.py` and open http://127.0.0.1:8000/login.html instead."
    );
  }
  if (!resetToken) {
    api("/auth/me")
      .then(({ user }) => {
        paintAccount(user);
        showView("viewAccount");
        techmapPhotos.accountPhoto().then(({ photo }) => {
          selectedPhoto = photo;
          accountPicker.set(photo);
          techmapPhotos.avatar($("accountAvatar"), photo);
        }).catch(() => {});
      })
      .catch(() => {
        /* not signed in — keep the sign-in form */
      });
  }
})();
