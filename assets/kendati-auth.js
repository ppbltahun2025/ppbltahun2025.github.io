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
  // aplikasi lama (sebelum 1.0.13) belum punya jembatan login
  var OLD_APP = IN_APP && !IS_ANDROID && !IS_IOS;
  var APK_URL = "https://github.com/ppbltahun2025/ppbltahun2025.github.io/releases/download/aplikasi/KENDATI.apk";
  var UNDUH_URL = "https://ppbltahun2025.github.io/KENDATI%20APPS/unduh.html";

  // ---------- perbarui aplikasi langsung dari dalam app ----------
  function updateApp() {
    var N = window.KendatiNative;
    if (N && N.download) {   // Android: unduh APK lewat pengunduh aplikasi + notifikasi
      try {
        if (N.postJson) N.postJson(SB_URL + "/rest/v1/rpc/record_download", SB_KEY, JSON.stringify({ p_platform: "android" }));
        else fetch(SB_URL + "/rest/v1/rpc/record_download", { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_platform: "android" }) });
      } catch (e) {}
      N.download(APK_URL, "KENDATI.apk");
      msg("Mengunduh… Setelah selesai, ketuk notifikasi \"Unduhan selesai\" lalu pilih Instal.");
    } else {                 // iOS / lainnya: halaman unduh di dalam app
      location.href = UNDUH_URL;
    }
  }

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
    "#kendatiGate h1{margin-bottom:26px}",
    "#kendatiGate .g-upd{display:none;width:100%;height:52px;margin-top:12px;border:0;border-radius:16px;font:inherit;font-size:15px;font-weight:800;color:#08182e;background:linear-gradient(160deg,#ffd873,#f0b429);cursor:pointer;box-shadow:0 10px 26px rgba(0,0,0,.3)}",
    "#kendatiGate.need-update .g-btn{display:none}",
    "#kendatiGate.need-update .g-upd{display:block}",
    "#kendatiGate.checking .g-btn,#kendatiGate.checking .g-upd{display:none}",
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
        '<div class="g-wait"></div>' +
        '<button type="button" class="g-btn">' + GOOGLE_SVG + "Masuk dengan Google</button>" +
        '<button type="button" class="g-upd">Perbarui aplikasi sekarang</button>' +
        '<div class="g-msg"></div>' +
        '<div class="g-foot">© 2026 CIPTA KARYA GRESIK</div>' +
      "</div>";
    (document.body || document.documentElement).appendChild(gate);
    gate.querySelector(".g-btn").addEventListener("click", login);
    gate.querySelector(".g-upd").addEventListener("click", updateApp);
    return gate;
  }
  function msg(t) { if (gate) gate.querySelector(".g-msg").textContent = t || ""; }
  function lock(checking) {
    if (!REQUIRED) return;
    document.documentElement.classList.add("kendati-locked");
    buildGate().className = checking ? "checking" : (OLD_APP ? "need-update" : "");
    if (OLD_APP && !checking) msg("Versi aplikasi ini belum mendukung login. Perbarui dulu, lalu buka lagi.");
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
      if (gate) gate.className = "need-update";
      msg("Versi aplikasi ini belum mendukung login. Perbarui dulu, lalu buka lagi.");
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
    window.kendatiLog("logout");
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

  // ---------- LOG KENDATI: semua kegiatan pengguna di portal ----------
  // Tercatat di tabel Supabase public.log_kendati (lihat view log_kendati_wib).
  var logToken = "", logQueue = [], loginPending = false, lastLogKey = "", lastLogAt = 0;
  var PLATFORM = IN_APP ? (/android/i.test(navigator.userAgent) ? "android" : "ios") : "web";
  var FILE_RE = /(\.(apk|ipa|zip|rar|7z|crx|xpi|exe|msi|pdf|xlsx?|docx?|pptx?|csv|kml|kmz|gpx|geojson|mp4|mp3)([?#]|$))|\/releases\/download\//i;
  var MENU_NAMES = { simbg: "SIMBG Gresik", ppbl: "Penataan Bangunan Gedung", dll: "Store" };
  function menuNow() {
    var h = (location.hash || "").replace("#", "");
    return MENU_NAMES[h] || document.title || location.pathname;
  }
  function sendLog(row) {
    try {
      fetch(SB_URL + "/rest/v1/rpc/record_activity", {
        method: "POST", keepalive: true,
        headers: { apikey: SB_KEY, Authorization: "Bearer " + logToken, "Content-Type": "application/json" },
        body: JSON.stringify(row)
      }).catch(function () {});
    } catch (e) {}
  }
  function flushLog() { while (logQueue.length && logToken) sendLog(logQueue.shift()); }
  window.kendatiLog = function (aksi, menu, detail, url) {
    var row = { p_aksi: String(aksi || ""), p_menu: menu || menuNow(), p_detail: detail ? String(detail) : null,
                p_url: url || location.href, p_platform: PLATFORM };
    var key = row.p_aksi + "|" + row.p_detail + "|" + row.p_url, now = Date.now();
    if (key === lastLogKey && now - lastLogAt < 1500) return;   // klik ganda
    lastLogKey = key; lastLogAt = now;
    if (logToken) sendLog(row); else if (logQueue.length < 30) logQueue.push(row);
  };
  function labelOf(el) {
    var lb = el.querySelector && el.querySelector(".hex-label");
    var t = (lb && lb.textContent) || el.getAttribute("aria-label") || el.getAttribute("title") ||
            el.innerText || el.value || el.getAttribute("alt") || "";
    t = String(t).replace(/\s+/g, " ").trim();
    return t.length > 120 ? t.slice(0, 117) + "…" : t;
  }
  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest && e.target.closest('a[href],button,[role="button"],.hex-item,.hex,input[type="submit"],input[type="button"],summary,select');
    if (!el || el.closest("#kendatiGate")) return;
    var href = el.getAttribute("href");
    var full = href && !/^(javascript:|#)/i.test(href) ? el.href : null;
    var label = labelOf(el) || href || el.tagName.toLowerCase();
    var aksi;
    if (full && (el.hasAttribute("download") || FILE_RE.test(full))) aksi = "unduh";
    else if (!full && /\b(unduh|download|ekspor|export|simpan file)\b/i.test(label)) aksi = "unduh";
    else if (full) aksi = /^https?:\/\/ppbltahun2025\.github\.io(\/|$)/i.test(full) ? "buka fitur" : "buka tautan luar";
    else aksi = "klik";
    window.kendatiLog(aksi, menuNow(), label, full || location.href);
  }, true);
  document.addEventListener("submit", function (e) {
    var f = e.target; window.kendatiLog("kirim formulir", menuNow(), labelOf(f.querySelector('[type="submit"],button') || f) || f.id || "formulir");
  }, true);
  // video & audio di halaman (putar, jeda, selesai)
  function mediaName(m) {
    var t = m.getAttribute("title") || m.getAttribute("aria-label") || m.id || "";
    var src = m.currentSrc || m.src || "";
    if (src) t = (t ? t + " · " : "") + decodeURIComponent(src.split("/").pop().split("?")[0]);
    return (m.tagName === "VIDEO" ? "Video " : "Audio ") + (t || "tanpa nama");
  }
  function mediaTime(m) {
    var x = Math.floor(m.currentTime || 0);
    return Math.floor(x / 60) + ":" + ("0" + (x % 60)).slice(-2);
  }
  ["play", "pause", "ended"].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      var m = e.target;
      if (!m || !/^(VIDEO|AUDIO)$/.test(m.tagName)) return;
      if (ev === "pause" && m.ended) return;
      var aksi = { play: "putar", pause: "jeda", ended: "selesai putar" }[ev] + (m.tagName === "VIDEO" ? " video" : " audio");
      window.kendatiLog(aksi, menuNow(), mediaName(m) + " @" + mediaTime(m));
    }, true);
  });
  window.addEventListener("hashchange", function () { if (location.hash) window.kendatiLog("buka menu", menuNow()); });
  try {   // pertama kali aplikasi dibuka (per sesi)
    if (IN_APP && !sessionStorage.getItem("kendatiAppOpen")) {
      sessionStorage.setItem("kendatiAppOpen", "1");
      window.kendatiLog("buka aplikasi", "Aplikasi KENDATI", PLATFORM);
    }
  } catch (e) {}
  window.kendatiLog("buka halaman", menuNow(), document.title || location.pathname);

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
    var wasIn = !!window.kendatiUser;
    window.kendatiUser = session ? session.user : null;
    logToken = session ? session.access_token : "";
    if (session) flushLog();
    if (session && !wasIn && loginPending) { loginPending = false; window.kendatiLog("login", null, "Google"); }
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
    if (event === "SIGNED_IN" && !window.kendatiUser) loginPending = true;
    onSession(session);
    // bersihkan ?code= dari alamat setelah login web
    if (event === "SIGNED_IN" && /[?&]code=/.test(location.search)) {
      try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {}
    }
  });
  sb.auth.getSession().then(function (r) { onSession(r.data && r.data.session); });
})();
