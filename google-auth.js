(function () {
    "use strict";
    const callbackUrl = new URL(window.location.href);
    const fragment = new URLSearchParams(callbackUrl.hash.slice(1));
    const recovery = callbackUrl.searchParams.get("recovery") === "1" || callbackUrl.searchParams.get("type") === "recovery" || fragment.get("type") === "recovery";
    let attempted = false;
    try { attempted = window.sessionStorage.getItem("helpdesk-google-attempt") === "1"; } catch { /* Optional UI hint. */ }
    const callback = !recovery && (callbackUrl.searchParams.get("oauth") === "google" || (attempted && (fragment.has("access_token") || fragment.has("error") || callbackUrl.searchParams.has("code"))));
    let callbackActive = callback;
    const callbackError = callback && (fragment.has("error") || callbackUrl.searchParams.has("error"));
    const code = callback ? callbackUrl.searchParams.get("code") : null;
    let client, hooks, enabled = false, busy = false, rejecting = false, exchanging = false;
    let failed = callbackError, statusKey = "googleSoon", verifiedToken = null, validationVersion = 0;
    let approvalsVersion = 0;
    const $ = id => document.getElementById(id);
    const t = key => window.HelpDeskCopy.t(key);

    function clearAttempt() { try { window.sessionStorage.removeItem("helpdesk-google-attempt"); } catch { /* Optional. */ } }
    function cleanUrl() {
        const clean = new URL(window.location.href);
        for (const key of ["oauth", "code", "error", "error_code", "error_description", "access_token", "refresh_token"]) clean.searchParams.delete(key);
        clean.hash = "";
        window.history.replaceState(null, "", clean.pathname + clean.search);
        clearAttempt();
    }
    function render() {
        if (!hooks) return;
        $("googleLogin").disabled = !enabled || busy;
        $("googleLogin").textContent = t(busy ? "googleLoading" : "googleLogin");
        $("googleHint").textContent = t(statusKey);
    }
    function isOAuth(session) {
        // This is a UX check, not a JWT verifier or a substitute for RLS.
        // Remote getUser + the actual profiles row are checked before display.
        if (callbackActive) return true;
        try {
            const encoded = session.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
            const claims = JSON.parse(window.atob(encoded));
            if (Array.isArray(claims.amr)) {
                const methods = claims.amr.filter(item => ["password", "oauth", "recovery", "invite", "otp", "magiclink", "sso/saml", "email/signup"].includes(item.method));
                methods.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
                if (methods.length) return methods[0].method === "oauth";
            }
        } catch { /* The SDK may provide a session without claims in mocks. */ }
        return session.user?.app_metadata?.provider === "google";
    }
    async function reject(key) {
        rejecting = true;
        try { await client.auth.signOut({ scope: "local" }); } catch { /* UI stays blocked even if sign-out fails. */ }
        finally {
            verifiedToken = null; cleanUrl(); hooks.clear(); hooks.view("auth"); hooks.notice(t(key), true); rejecting = false;
        }
        return false;
    }
    async function checkProvider() {
        const config = window.HelpDeskAuthConfig;
        if (!config?.googleEnabled || !config?.googleDatabaseReady) { render(); return; }
        statusKey = "googleChecking"; render();
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8000);
        try {
            const response = await fetch(hooks.url + "/auth/v1/settings", { headers: { apikey: hooks.key }, signal: controller.signal });
            if (!response.ok) throw new Error("settings_unavailable");
            const settings = await response.json();
            enabled = settings.external?.google === true;
            statusKey = enabled ? "googleVisitorHint" : "googleSoon";
        } catch { enabled = false; statusKey = "googleUnavailable"; }
        finally { window.clearTimeout(timeout); render(); }
    }
    async function login() {
        if (!enabled || busy) return;
        busy = true; failed = false; hooks.notice(""); render();
        try {
            try { window.sessionStorage.setItem("helpdesk-google-attempt", "1"); } catch { /* Optional. */ }
            const redirectTo = window.location.origin + window.location.pathname + "?oauth=google";
            const { error } = await client.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo, scopes: "openid email profile", queryParams: { prompt: "select_account" } }
            });
            if (error) throw error;
            // Supabase redirects the browser. Leave the button disabled until
            // navigation, and restore it on pageshow if the person goes back.
        } catch {
            clearAttempt(); busy = false; hooks.notice(t("googleFailed"), true); render();
        }
    }
    async function loadApprovals() {
        const panel = $("googleApprovals");
        const admin = hooks.profile?.();
        panel.hidden = !window.HelpDeskAuthConfig?.googleDatabaseReady || admin?.role !== "admin";
        if (panel.hidden) return;
        const stamp = ++approvalsVersion;
        $("googleApprovalState").textContent = t("loading");
        $("googleApprovalRows").replaceChildren();
        $("googleApprovalRefresh").disabled = true;
        try {
            const { data, error } = await client.rpc("helpdesk_list_pending_google_access");
            if (stamp !== approvalsVersion || hooks.profile?.()?.id !== admin.id) return;
            if (error) throw error;
            $("googleApprovalState").textContent = data.length ? "" : t("googleNoPending");
            for (const request of data) {
                const row = document.createElement("article"); row.className = "ticket";
                const label = document.createElement("span");
                label.textContent = request.full_name + (request.email ? " · " + request.email : "");
                row.append(label);
                const actions = document.createElement("div"); actions.className = "actions";
                for (const decision of ["approved", "denied"]) {
                    const button = document.createElement("button"); button.type = "button";
                    button.className = decision === "approved" ? "" : "secondary";
                    button.textContent = t(decision === "approved" ? "googleApprove" : "googleDeny");
                    button.onclick = () => reviewAccess(request.user_id, decision);
                    actions.append(button);
                }
                row.append(actions); $("googleApprovalRows").append(row);
            }
        } catch { if (stamp === approvalsVersion) $("googleApprovalState").textContent = t("googleApprovalFailed"); }
        finally { if (stamp === approvalsVersion) $("googleApprovalRefresh").disabled = false; }
    }
    async function reviewAccess(id, decision) {
        const admin = hooks.profile?.();
        if (admin?.role !== "admin") return;
        const stamp = approvalsVersion;
        $("googleApprovals").querySelectorAll("button").forEach(button => { button.disabled = true; });
        $("googleApprovalState").textContent = t("loading");
        try {
            const { error } = await client.rpc("helpdesk_review_google_access", { p_user_id: id, p_decision: decision });
            if (error) throw error;
            if (stamp !== approvalsVersion || hooks.profile?.()?.id !== admin.id) return;
            hooks.notice(t(decision === "approved" ? "googleApproved" : "googleDenied"));
            await loadApprovals();
        } catch { if (stamp === approvalsVersion) $("googleApprovalState").textContent = t("googleApprovalFailed"); }
        finally { if (stamp === approvalsVersion) $("googleApprovals").querySelectorAll("button").forEach(button => { button.disabled = false; }); }
    }
    window.HelpDeskGoogle = {
        isCallback: () => callback,
        refresh() { render(); if (hooks?.profile?.()?.role === "admin") loadApprovals(); },
        loadApprovals,
        resetApprovals() { approvalsVersion++; $("googleApprovals").hidden = true; $("googleApprovalRows").replaceChildren(); $("googleApprovalState").textContent = ""; },
        onAuth: () => rejecting || exchanging || failed,
        async beforeSession(session) {
            const stamp = ++validationVersion;
            if (rejecting || exchanging || failed) return false;
            if (!session || !isOAuth(session)) return true;
            if (session.access_token && verifiedToken === session.access_token) return true;
            try {
                const { data, error } = await client.auth.getUser();
                if (stamp !== validationVersion) return false;
                if (error || data?.user?.id !== session.user.id) return reject("googleFailed");
                verifiedToken = session.access_token || null;
                return true;
            } catch { return stamp === validationVersion ? reject("googleFailed") : false; }
        },
        async acceptProfile(session, profile) {
            if (!isOAuth(session)) return true;
            if (profile.role !== "requester") return reject("googleStaffPassword");
            cleanUrl();
            callbackActive = false;
            return true;
        },
        missingProfile(session) { return session && isOAuth(session) ? "googleProfileMissing" : "inactive"; },
        async inactiveProfileMessage(session, profile) {
            if (window.HelpDeskAuthConfig?.googleDatabaseReady && profile?.role === "requester") {
                try {
                    const { data, error } = await client.from("google_access_requests").select("status").eq("user_id", profile.id).maybeSingle();
                    if (!error && data?.status === "pending") { cleanUrl(); return "googleAwaitingApproval"; }
                    if (!error && data?.status === "denied") { cleanUrl(); return "googleAccessDenied"; }
                } catch { /* No operational access is granted on failure. */ }
            }
            return session && isOAuth(session) ? "googleProfileMissing" : "inactive";
        },
        passwordLogin() { failed = false; callbackActive = false; validationVersion++; clearAttempt(); },
        start(authClient, ui) {
            client = authClient; hooks = ui; $("googleLogin").onclick = login;
            $("googleApprovalRefresh").onclick = loadApprovals;
            window.addEventListener("pageshow", () => { busy = false; render(); });
            checkProvider();
            if (callbackError) {
                cleanUrl(); hooks.clear(); hooks.view("auth"); hooks.notice(t("googleCancelled"), true);
            } else if (code) {
                exchanging = true;
                // Run outside the Auth callback lock, and never log the code.
                window.setTimeout(async () => {
                    try {
                        const { data, error } = await client.auth.exchangeCodeForSession(code);
                        cleanUrl(); exchanging = false;
                        if (error) { failed = true; hooks.view("auth"); hooks.notice(t("googleFailed"), true); }
                        else await hooks.session(data.session);
                    } catch { exchanging = false; failed = true; cleanUrl(); hooks.view("auth"); hooks.notice(t("googleFailed"), true); }
                }, 0);
            }
        }
    };
})();
