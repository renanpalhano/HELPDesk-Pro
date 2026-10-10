(function () {
    "use strict";
    // Capture the callback before the SDK consumes the fragment. Never log it.
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(url.hash.slice(1));
    const isRecoveryType = url.searchParams.get("type") === "recovery" || fragment.get("type") === "recovery";
    const tokenHash = isRecoveryType ? url.searchParams.get("token_hash") : null;
    const accessToken = isRecoveryType ? fragment.get("access_token") : null;
    const code = url.searchParams.get("recovery") === "1" ? url.searchParams.get("code") : null;
    const callbackError = !window.HelpDeskGoogle?.isCallback() && (url.searchParams.has("error") || fragment.has("error") || fragment.has("error_code"));
    let active = isRecoveryType || url.searchParams.get("recovery") === "1" || callbackError;
    let client, hooks, ready = false, userId = null, validation = null, finishing = false;
    let stateKey = "checkingRecovery", errorKey = "", generation = 0;
    const $ = id => document.getElementById(id);
    const t = key => window.HelpDeskCopy.t(key);

    function cleanUrl(exit = false) {
        const clean = new URL(window.location.href);
        for (const key of ["token_hash", "code", "type", "access_token", "refresh_token", "error", "error_code", "error_description"]) clean.searchParams.delete(key);
        if (exit) clean.searchParams.delete("recovery");
        clean.hash = "";
        window.history.replaceState(null, "", clean.pathname + clean.search);
    }
    function render() {
        if (!hooks) return;
        $("recoveryState").textContent = t(stateKey);
        $("recoveryError").textContent = errorKey ? t(errorKey) : "";
        for (const id of ["newPassword", "confirmPassword", "recoverySubmit"]) $(id).disabled = !ready || finishing;
        $("requestNewLink").hidden = stateKey !== "recoveryInvalid";
    }
    function show() { hooks.view("recover"); render(); }
    function invalid() {
        generation++; ready = false; userId = null;
        stateKey = "recoveryInvalid"; errorKey = "";
        $("newPassword").value = ""; $("confirmPassword").value = "";
        cleanUrl(); show();
    }
    async function validate(session) {
        if (validation) return validation;
        const stamp = generation;
        validation = (async () => {
            try {
                if (!session?.user?.id) throw new Error("invalid_recovery");
                const { data, error } = await client.auth.getUser();
                if (error || data?.user?.id !== session.user.id) throw new Error("invalid_recovery");
                if (!active || stamp !== generation) return;
                userId = data.user.id; ready = true; stateKey = "recoveryReady"; errorKey = "";
                cleanUrl(); show(); $("newPassword").focus();
            } catch { if (active && stamp === generation) invalid(); }
        })();
        try { await validation; } finally { validation = null; }
    }
    async function initialize() {
        if (!active) return;
        hooks.clear(); show();
        if (callbackError) { invalid(); return; }
        try {
            if (tokenHash) {
                cleanUrl();
                const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
                if (error) throw error;
                await validate(data.session);
            } else if (code) {
                cleanUrl();
                const { data, error } = await client.auth.exchangeCodeForSession(code);
                if (error) throw error;
                await validate(data.session);
            } else {
                const { data, error } = await client.auth.getSession();
                if (ready || validation) return;
                // A URL marker alone never authorizes changing a restored session.
                if (error || !accessToken || data?.session?.access_token !== accessToken) throw new Error("invalid_recovery");
                await validate(data.session);
            }
        } catch { if (active) invalid(); }
    }
    async function exitRecovery(target = "auth", success = false) {
        finishing = true; generation++; render();
        try {
            if (active) {
                const { error } = await client.auth.signOut({ scope: "local" });
                if (error) throw error;
            }
            active = false; ready = false; userId = null; cleanUrl(true);
            hooks.clear(); hooks.view(target);
            $("newPassword").value = ""; $("confirmPassword").value = "";
            hooks.notice(success ? t("passwordSaved") : "");
            if (target === "auth") $("email").focus();
            else $("resetEmail").focus();
        } catch {
            ready = false; stateKey = success ? "recoveryLogoutFailed" : "recoveryInvalid";
            show();
        } finally { finishing = false; render(); }
    }
    async function requestReset(event) {
        event.preventDefault();
        const button = $("resetSubmit"); button.disabled = true; button.textContent = t("loading");
        $("resetBack").disabled = true; hooks.notice("");
        try {
            // Only this explicit form submission can send a recovery email.
            const redirectTo = window.location.origin + window.location.pathname + "?recovery=1";
            const { error } = await client.auth.resetPasswordForEmail($("resetEmail").value.trim(), { redirectTo });
            if (error && !/user.not.found|email.not.found/i.test(error.code || "")) throw error;
            $("resetForm").reset(); hooks.view("auth"); hooks.notice(t("resetRequested")); $("email").focus();
        } catch (error) {
            const message = /rate.limit/i.test(error.message || "") ? "rateLimit" : /fetch|network/i.test(error.message || "") ? "network" : "resetFailed";
            hooks.notice(t(message), true);
        } finally { button.disabled = false; button.textContent = t("sendReset"); $("resetBack").disabled = false; }
    }
    async function savePassword(event) {
        event.preventDefault();
        if (!ready || finishing || !active) return;
        const password = $("newPassword").value, confirmation = $("confirmPassword").value;
        errorKey = password.length < 8 || password.length > 128 ? "passwordLength" : password !== confirmation ? "passwordMismatch" : "";
        if (errorKey) { render(); return; }
        finishing = true; render(); $("recoverySubmit").textContent = t("loading");
        try {
            const { data, error } = await client.auth.getUser();
            if (error || data?.user?.id !== userId) { invalid(); return; }
            const result = await client.auth.updateUser({ password });
            if (result.error) throw result.error;
            $("newPassword").value = ""; $("confirmPassword").value = "";
            ready = false;
            await exitRecovery("auth", true);
        } catch (error) {
            if (/session|expired|jwt|token/i.test(error.code || error.message || "")) invalid();
            else {
                errorKey = /same.password|same_password/i.test(error.code || error.message || "") ? "passwordSame" : /weak|password/i.test(error.code || error.message || "") ? "passwordWeak" : /fetch|network/i.test(error.message || "") ? "network" : "generic";
                render();
            }
        } finally { finishing = false; $("recoverySubmit").textContent = t("savePassword"); render(); }
    }
    window.HelpDeskRecovery = {
        active: () => active,
        refresh: render,
        start(authClient, ui) {
            client = authClient; hooks = ui;
            $("forgotPassword").onclick = () => { hooks.notice(""); $("password").value = ""; $("resetEmail").value = $("email").value; hooks.view("reset"); $("resetEmail").focus(); };
            $("resetForm").onsubmit = requestReset;
            $("resetBack").onclick = () => { hooks.notice(""); hooks.view("auth"); $("email").focus(); };
            $("recoveryForm").onsubmit = savePassword;
            $("recoveryBack").onclick = () => exitRecovery();
            $("requestNewLink").onclick = () => exitRecovery("reset");
            if (active) { hooks.clear(); show(); window.setTimeout(initialize, 0); }
        },
        onAuth(event, session) {
            if (event === "PASSWORD_RECOVERY") {
                if (!active) generation++;
                active = true; ready = false; stateKey = "checkingRecovery";
                hooks.clear(); show();
                window.setTimeout(() => validate(session), 0);
            } else if (active && event === "SIGNED_OUT" && !finishing) invalid();
            return active;
        }
    };
})();
