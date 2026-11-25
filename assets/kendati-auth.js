/*
 * KENDATI — Login Google (Supabase Auth)
 * Dipakai index.html (WAJIB login) dan KENDATI APPS/unduh.html (opsional).
 *
 *   <script src=".../supabase.min.js"></script>
 *   <script src="assets/kendati-auth.js" data-required="true"></script>
 *
 * Di aplikasi Android/iOS, Google tidak mengizinkan login di dalam WebView, jadi
 * halaman login Google dibuka di tab login sistem (Custom Tab / ASWebAuthenticationSession)
 * lalu kembali ke aplikasi lewat com.ciptakaryagresik.kendati://auth.
 */
(function () {
  "use strict";
  var SB_URL = "https://kvcnbyasnvpmnrbvkjjg.supabase.co";
  var SB_KEY = "sb_publishable_J9EFLRjCWE9gaLgsQLKeLQ_x-Wwu3wF";
  var APP_REDIRECT = "com.ciptakaryagresik.kendati://auth";

  var me = document.currentScript;
  var REQUIRED = !me || me.getAttribute("data-required") !== "false";
  var LOGO = (me && me.getAttribute("data-logo")) || "assets/icon-menu.png";

  if (!window.supabase || !window.supabase.createClient) { console.error("[KENDATI] supabase-js belum dimuat"); return; }

  var sb = window.supabase.createClient(SB_URL, SB_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" }
  });
  window.kendatiSB = sb;

  var IS_ANDROID = !!(window.KendatiNative && window.KendatiNative.openAuth);
  var IS_IOS = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.kendati);
  var IN_APP = /KendatiApp/.test(navigator.userAgent || "");

  // ---------- tampilan layar login ----------
  var css = document.createElement("style");
  css.textContent = [
    "html.kendati-locked body > *:not(#kendatiGate){visibility:hidden!important}",
    "#kendatiGate{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:24px;",
    "  font-family:'Segoe UI',system-ui,-apple-system,Roboto,Arial,sans-serif;color:#eaf1ff;",
    "  background:radial-gradient(120% 80% at 50% 0%,#0b4b91 0%,#071b3a 55%,#040f20 100%)}",
    "#kendatiGate .g-card{width:min(360px,100%);text-align:center}",
    "#kendatiGate .g-orb{position:relative;width:108px;height:108px;margin:0 auto 22px;border-radius:50%;background:#f6f3ea;display:flex;align-items:center;justify-content:center;",
    "  box-shadow:0 12px 34px rgba(0,0,0,.45),0 0 0 5px rgba(240,180,41,.45)}",
    "#kendatiGate .g-orb::before{content:'';position:absolute;inset:-12px;border-radius:50%;border:2px solid rgba(240,180,41,.55);animation:kgp 2.4s ease-out infinite}",
    "#kendatiGate .g-orb img{width:76%;height:76%;object-fit:contain}",
    "#kendatiGate h1{margin:0;font-size:20px;color:#ffd873;letter-spacing:.02em}",
    "#kendatiGate p{margin:8px auto 24px;max-width:300px;font-size:13.5px;line-height:1.55;opacity:.82}",
    "#kendatiGate .g-btn{display:flex;align-items:center;justify-content:center;gap:12px;width:100%;height:52px;border:0;border-radius:16px;",
    "  background:#fff;color:#1f2937;font:inherit;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 10px 26px rgba(0,0,0,.3)}",
    "#kendatiGate .g-btn:active{transform:scale(.98)}",
    "#kendatiGate .g-btn[disabled]{opacity:.6}",
    "#kendatiGate .g-btn svg{width:20px;height:20px}",
    "#kendatiGate .g-msg{min-height:1.3em;margin-top:14px;font-size:12.5px;color:#ffd873}",
    "#kendatiGate .g-wait{display:none;width:30px;height:30px;margin:6px auto;border-radius:50%;border:3px solid rgba(255,255,255,.18);border-top-color:#ffd873;animation:kgs .8s linear infinite}",
    "#kendatiGate.checking .g-wait{display:block}",
    "#kendatiGate.checking .g-btn,#kendatiGate.checking p{display:none}",
    "#kendatiGate .g-foot{margin-top:26px;font-size:11px;opacity:.45}",
    "@keyframes kgp{0%{transform:scale(1);opacity:.6}75%{transform:scale(1.35);opacity:0}100%{opacity:0}}",
    "@keyframes kgs{to{transform:rotate(360deg)}}"
  ].join("\n");
  document.head.appendChild(css);

  var GOOGLE_SVG = '<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

  var gate = null;
  function buildGate() {
    if (gate) return gate;
    gate = document.createElement("div");
    gate.id = "kendatiGate";
    gate.className = "checking";
    gate.innerHTML =
      '<div class="g-card">' +
        '<div class="g-orb"><img src="' + LOGO + '" alt="KENDATI"></div>' +
        "<h1>Masuk ke KENDATI</h1>" +
        "<p>Masuk dengan akun Google sekali saja. Akun dipakai untuk rating, saran, dan catatan unduhan aplikasi.</p>" +
        '<div class="g-wait"></div>' +
        '<button type="button" class="g-btn">' + GOOGLE_SVG + "Masuk dengan Google</button>" +
        '<div class="g-msg"></div>' +
        '<div class="g-foot">© 2026 CIPTA KARYA GRESIK</div>' +
      "</div>";
    (document.body || document.documentElement).appendChild(gate);
    gate.querySelector(".g-btn").addEventListener("click", login);
    return gate;
  }
  function msg(t) { if (gate) gate.querySelector(".g-msg").textContent = t || ""; }
  function lock(checking) {
    if (!REQUIRED) return;
    document.documentElement.classList.add("kendati-locked");
    buildGate().className = checking ? "checking" : "";
  }
  function unlock() {
    document.documentElement.classList.remove("kendati-locked");
    if (gate) { gate.remove(); gate = null; }
    // tata letak Home dihitung ulang setelah halaman terlihat
    if (typeof window.fitHomeToViewport === "function") setTimeout(window.fitHomeToViewport, 60);
    window.dispatchEvent(new Event("resize"));
  }

  // ---------- login ----------
  function login() {
    msg("");
    var btn = gate && gate.querySelector(".g-btn");
    if (btn) btn.disabled = true;
    if (IN_APP && (IS_ANDROID || IS_IOS)) {
      sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: APP_REDIRECT, skipBrowserRedirect: true } })
        .then(function (r) {
          if (r.error || !r.data || !r.data.url) throw r.error || new Error("no url");
          if (IS_ANDROID) window.KendatiNative.openAuth(r.data.url);
          else window.webkit.messageHandlers.kendati.postMessage({ action: "openAuth", value: r.data.url });
          msg("Lanjutkan login di jendela Google…");
        })
        .catch(function (e) { msg("Login gagal: " + (e && e.message || e)); })
        .then(function () { if (btn) btn.disabled = false; });
    } else if (IN_APP) {
      msg("Perbarui aplikasi KENDATI ke versi terbaru untuk login.");
      if (btn) btn.disabled = false;
    } else {
      var back = location.origin + location.pathname;
      sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: back } })
        .then(function (r) { if (r.error) throw r.error; })
        .catch(function (e) { msg("Login gagal: " + (e && e.message || e)); if (btn) btn.disabled = false; });
    }
  }

  // aplikasi memanggil ini setelah kembali dari tab login Google
  window.__kendatiAuthCallback = function (url) {
    try {
      var u = new URL(url);
      var code = u.searchParams.get("code");
      var err = u.searchParams.get("error_description") || new URLSearchParams((u.hash || "").slice(1)).get("error_description");
      if (err) { lock(false); msg("Login gagal: " + err); return; }
      if (code) {
        lock(true);
        sb.auth.exchangeCodeForSession(code).then(function (r) {
          if (r.error) { lock(false); msg("Login gagal: " + r.error.message); }
        });
        return;
      }
      var h = new URLSearchParams((u.hash || "").slice(1));
      if (h.get("access_token")) {
        sb.auth.setSession({ access_token: h.get("access_token"), refresh_token: h.get("refresh_token") });
      }
    } catch (e) { msg("Login gagal"); }
  };

  window.kendatiLogout = function () {
    sb.auth.signOut().then(function () { pushToken(null); if (REQUIRED) lock(false); });
  };

  // ---------- kirim token ke aplikasi (dipakai rating dari halaman mana pun) ----------
  function pushToken(session) {
    var tok = session ? session.access_token : "";
    try {
      if (window.KendatiNative && window.KendatiNative.setAuth) window.KendatiNative.setAuth(tok);
      else if (IS_IOS) window.webkit.messageHandlers.kendati.postMessage({ action: "setAuth", value: tok });
    } catch (e) {}
  }

  // ---------- info akun + tombol Keluar (di panel statistik pengunjung) ----------
  function showUser(user) {
    var panel = document.getElementById("visitorPanel");
    if (!panel || !user) return;
    var row = document.getElementById("kendatiUserRow");
    if (!row) {
      row = document.createElement("div");
      row.id = "kendatiUserRow";
      row.style.cssText = "display:flex;align-items:center;gap:8px;margin:-2px 0 12px;padding:8px 10px;border-radius:14px;background:rgba(255,255,255,.07);font-size:12px";
      panel.insertBefore(row, panel.firstChild);
    }
    var m = user.user_metadata || {};
    var name = m.full_name || m.name || user.email || "Akun";
    row.innerHTML = (m.avatar_url ? '<img src="' + m.avatar_url + '" alt="" referrerpolicy="no-referrer" style="width:26px;height:26px;border-radius:50%">' : "") +
      '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span>' +
      '<button type="button" style="border:1px solid rgba(255,255,255,.25);background:none;color:#ffd873;border-radius:999px;padding:4px 10px;font:inherit;font-size:11px;font-weight:700;cursor:pointer">Keluar</button>';
    row.querySelector("span").textContent = name;
    row.querySelector("button").addEventListener("click", function (e) { e.stopPropagation(); window.kendatiLogout(); });
  }

  // ---------- mulai ----------
  var ready;
  window.kendatiAuthReady = new Promise(function (res) { ready = res; });

  // Gate hanya aktif bila login Google sudah dinyalakan di Supabase
  // (Authentication -> Providers -> Google). Kalau belum, KENDATI tetap terbuka.
  var googleOn = fetch(SB_URL + "/auth/v1/settings", { headers: { apikey: SB_KEY } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { return !!(j && j.external && j.external.google); })
    .catch(function () { return false; });

  function onSession(session) {
    window.kendatiUser = session ? session.user : null;
    pushToken(session);
    if (session) { unlock(); showUser(session.user); ready(window.kendatiUser); return; }
    if (!REQUIRED) { ready(null); return; }
    googleOn.then(function (on) {
      if (window.kendatiUser) return;
      if (on) lock(false);
      else { console.warn("[KENDATI] Login Google belum diaktifkan di Supabase; gate dilewati."); unlock(); }
      ready(null);
    });
  }

  if (REQUIRED) {
    if (document.body) lock(true);
    else document.addEventListener("DOMContentLoaded", function () { if (!window.kendatiUser) lock(true); });
  }

  sb.auth.onAuthStateChange(function (event, session) {
    if (event === "INITIAL_SESSION") return;
    onSession(session);
    // bersihkan ?code= dari alamat setelah login web
    if (event === "SIGNED_IN" && /[?&]code=/.test(location.search)) {
      try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {}
    }
  });
  sb.auth.getSession().then(function (r) { onSession(r.data && r.data.session); });
})();
