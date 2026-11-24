/*
 * KENDATI App Overlay
 * Disuntikkan oleh aplikasi (Android & iOS) ke SETIAP halaman yang dibuka,
 * jadi tidak perlu mengubah kode situs ppbltahun2025.github.io sama sekali.
 *
 *  - Tombol bulat kecil (bisa digeser) -> panel: Mode Mobile / Mode Web,
 *    Kembali, Beranda, Muat ulang, Salin link.
 *  - Mode Web = tampilan desktop seperti "Situs desktop" di Chrome.
 *  - Garis progres tipis saat pindah halaman.
 *  - Link target="_blank" dibuka di dalam aplikasi (iOS).
 */
(function () {
  "use strict";
  var IS_IOS = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.kendati);
  var IS_ANDROID = !!window.KendatiNative;

  // =========== UNDUHAN (semua frame, termasuk iframe Apps Script) ===========
  // WebView tidak bisa mengunduh file blob:/data: sendiri (mis. ekspor PDF/Excel),
  // jadi file dikirim ke aplikasi untuk disimpan (Android: folder Download,
  // iOS: lembar Bagikan -> Simpan ke File).
  if (!window.__kendatiDl && (IS_IOS || IS_ANDROID)) {
    window.__kendatiDl = true;
    var saveBlob = function (blob, name) {
      var r = new FileReader();
      r.onload = function () {
        var s = String(r.result), b64 = s.slice(s.indexOf(",") + 1);
        var mime = blob.type || "application/octet-stream";
        if (IS_ANDROID) window.KendatiNative.saveFile(name || "unduhan", mime, b64);
        else window.webkit.messageHandlers.kendati.postMessage({ action: "saveFile", value: b64, name: name || "unduhan", mime: mime });
      };
      r.readAsDataURL(blob);
    };
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a) return;
      var href = a.href || "";
      if (!/^(blob|data):/i.test(href)) return;
      e.preventDefault(); e.stopPropagation();
      var name = a.getAttribute("download") || "unduhan";
      fetch(href).then(function (res) { return res.blob(); }).then(function (b) { saveBlob(b, name); })
        .catch(function (err) { console.warn("[KENDATI] unduh gagal", err); });
    }, true);
    // banyak skrip membuat <a download> lalu memanggil a.click() tanpa menempelkannya ke halaman
    var origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (!this.isConnected && /^(blob|data):/i.test(this.href || "")) {
        var name = this.getAttribute("download") || "unduhan";
        fetch(this.href).then(function (res) { return res.blob(); }).then(function (b) { saveBlob(b, name); });
        return;
      }
      return origClick.apply(this, arguments);
    };
  }

  if (window.top !== window) { keepLinksInApp(); return; }   // iframe: hanya urus link; UI di frame utama
  if (window.__kendatiOverlay) return;          // jangan dobel
  window.__kendatiOverlay = true;

  var HOME = "https://ppbltahun2025.github.io/";
  var UA = navigator.userAgent || "";
  var MODE = /KendatiDesktop/.test(UA) ? "desktop" : "mobile";

  function send(action, value) {
    try {
      if (IS_ANDROID) {
        if (action === "setMode") window.KendatiNative.setMode(value);
        else if (action === "openExternal") window.KendatiNative.openExternal(value);
        else if (action === "hardReload") window.KendatiNative.hardReload();
      } else if (IS_IOS) {
        window.webkit.messageHandlers.kendati.postMessage({ action: action, value: value || "" });
      } else if (action === "openExternal") {
        window.open(value, "_blank");
      } else if (action === "hardReload") {
        location.reload();
      }
    } catch (e) { console.warn("[KENDATI]", e); }
  }

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  // ---------- Mode Web: paksa viewport selebar desktop ----------
  function applyViewport() {
    if (MODE !== "desktop" || !document.head) return;
    var m = document.querySelector('meta[name="viewport"]');
    if (!m) { m = document.createElement("meta"); m.name = "viewport"; document.head.appendChild(m); }
    if (m.content !== "width=1280") m.content = "width=1280";
  }

  // ---------- Link _blank & window.open tetap di dalam aplikasi (iOS) ----------
  function goInApp(href) {
    if (typeof showProgress === "function") showProgress();
    try { window.top.location.href = href; } catch (e) { location.href = href; }
  }

  function keepLinksInApp() {
    if (window.__kendatiLinks) return;
    window.__kendatiLinks = true;
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a || a.hasAttribute("download")) return;
      var t = (a.getAttribute("target") || "").toLowerCase();
      if (t !== "_blank" && t !== "_new") return;
      var href = a.href;
      if (!/^https?:/i.test(href)) return;
      e.preventDefault();
      goInApp(href);                           // tetap di dalam aplikasi
    }, true);

    if (IS_IOS) {
      var nativeOpen = window.open;
      window.open = function (url, target, feat) {
        if (url && /^https?:/i.test(String(url))) { goInApp(new URL(String(url), location.href).href); return window; }
        return nativeOpen.call(window, url, target, feat);
      };
    }
  }

  // ---------- Garis progres tipis ----------
  var bar;
  function showProgress() {
    if (!bar) return;
    bar.style.transition = "none"; bar.style.opacity = "1"; bar.style.transform = "scaleX(0)";
    void bar.offsetWidth;
    bar.style.transition = "transform 8s cubic-bezier(.1,.7,.1,1)";
    bar.style.transform = "scaleX(.92)";
  }
  function hideProgress() {
    if (!bar) return;
    bar.style.transition = "transform .25s ease, opacity .4s ease .25s";
    bar.style.transform = "scaleX(1)"; bar.style.opacity = "0";
  }

  var ICON = {
    menu: '<svg viewBox="0 0 24 24"><circle cx="7" cy="7" r="2.2"/><circle cx="17" cy="7" r="2.2"/><circle cx="7" cy="17" r="2.2"/><circle cx="17" cy="17" r="2.2"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>',
    desktop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 11L12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/></svg>',
    reload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/></svg>'
  };

  var CSS = [
    ":host{all:initial}",
    "*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;font-family:'Segoe UI',system-ui,-apple-system,Roboto,Arial,sans-serif}",
    ".bar{position:fixed;top:0;left:0;right:0;height:2.5px;background:linear-gradient(90deg,#ffd873,#f0b429);transform-origin:left;transform:scaleX(0);opacity:0;z-index:2147483647;pointer-events:none;box-shadow:0 0 8px rgba(240,180,41,.6)}",
    ".fab{position:fixed;width:44px;height:44px;border-radius:50%;border:1px solid rgba(240,180,41,.55);background:rgba(7,27,58,.62);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:0 8px 24px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:2147483646;touch-action:none;user-select:none;-webkit-user-select:none;opacity:.5;transition:opacity .3s ease,transform .2s ease,left .3s cubic-bezier(.22,1,.36,1),top .3s cubic-bezier(.22,1,.36,1)}",
    ".fab.awake{opacity:1}",
    ".fab.drag{transition:opacity .2s ease;transform:scale(1.08)}",
    ".fab svg{width:16px;height:16px;fill:#ffd873}",
    ".scrim{position:fixed;inset:0;background:rgba(2,10,24,.35);opacity:0;pointer-events:none;transition:opacity .3s ease;z-index:2147483646}",
    ".scrim.on{opacity:1;pointer-events:auto}",
    ".sheet{position:fixed;left:50%;bottom:max(14px,env(safe-area-inset-bottom));width:min(380px,calc(100vw - 24px));transform:translate(-50%,calc(100% + 40px));transition:transform .45s cubic-bezier(.22,1,.36,1);z-index:2147483647;padding:10px 14px 14px;border-radius:24px;background:rgba(7,27,58,.84);-webkit-backdrop-filter:blur(20px) saturate(130%);backdrop-filter:blur(20px) saturate(130%);border:1px solid rgba(255,255,255,.16);box-shadow:0 20px 50px rgba(0,0,0,.45);color:#eaf1ff}",
    ".sheet.on{transform:translate(-50%,0)}",
    ".grip{width:36px;height:4px;border-radius:4px;background:rgba(255,255,255,.25);margin:0 auto 12px}",
    ".head{display:flex;align-items:baseline;justify-content:space-between;margin:0 4px 10px}",
    ".head b{font-size:12px;letter-spacing:.16em;color:#ffd873}",
    ".head span{font-size:10.5px;opacity:.6}",
    ".seg{position:relative;display:grid;grid-template-columns:1fr 1fr;padding:4px;border-radius:999px;background:rgba(255,255,255,.08);margin-bottom:12px}",
    ".seg i{position:absolute;top:4px;bottom:4px;left:4px;width:calc(50% - 4px);border-radius:999px;background:linear-gradient(160deg,#ffd873,#f0b429);transition:transform .35s cubic-bezier(.22,1,.36,1)}",
    ".seg.desktop i{transform:translateX(100%)}",
    ".seg button{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:7px;height:38px;border:0;background:none;color:rgba(234,241,255,.8);font-size:13px;font-weight:700;cursor:pointer;transition:color .3s ease}",
    ".seg button svg{width:17px;height:17px}",
    ".seg button.act{color:#08182e}",
    ".grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}",
    ".grid button{display:flex;flex-direction:column;align-items:center;gap:6px;padding:11px 2px 9px;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:rgba(255,255,255,.05);color:#eaf1ff;font-size:10.5px;font-weight:600;cursor:pointer;transition:background .2s ease,transform .15s ease}",
    ".grid button:active{transform:scale(.95);background:rgba(240,180,41,.18)}",
    ".grid button svg{width:20px;height:20px;color:#ffd873}",
    ".toast{position:fixed;left:50%;bottom:max(28px,env(safe-area-inset-bottom));transform:translate(-50%,20px);padding:9px 16px;border-radius:999px;background:rgba(7,27,58,.92);border:1px solid rgba(240,180,41,.5);color:#ffd873;font-size:12.5px;font-weight:700;opacity:0;pointer-events:none;transition:opacity .25s ease,transform .25s ease;z-index:2147483647}",
    ".toast.on{opacity:1;transform:translate(-50%,0)}",
    "@media (prefers-reduced-motion:reduce){.sheet,.fab,.seg i,.scrim{transition-duration:.01s!important}}"
  ].join("");

  function build() {
    if (document.getElementById("kendati-app-overlay") || !document.body) return;
    document.documentElement.classList.add("kendati-app", "kendati-" + MODE);
    applyViewport();

    var host = document.createElement("div");
    host.id = "kendati-app-overlay";
    host.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647";
    var root = host.attachShadow ? host.attachShadow({ mode: "closed" }) : host;
    root.innerHTML =
      "<style>" + CSS + "</style>" +
      '<div class="bar"></div>' +
      '<div class="scrim"></div>' +
      '<button class="fab" type="button" aria-label="Menu aplikasi KENDATI">' + ICON.menu + "</button>" +
      '<div class="sheet" role="dialog" aria-label="Menu aplikasi">' +
        '<div class="grip"></div>' +
        '<div class="head"><b>KENDATI</b><span>Live · otomatis update</span></div>' +
        '<div class="seg ' + MODE + '"><i></i>' +
          '<button type="button" data-mode="mobile" class="' + (MODE === "mobile" ? "act" : "") + '">' + ICON.phone + "Mobile</button>" +
          '<button type="button" data-mode="desktop" class="' + (MODE === "desktop" ? "act" : "") + '">' + ICON.desktop + "Web</button>" +
        "</div>" +
        '<div class="grid">' +
          '<button type="button" data-act="back">' + ICON.back + "Kembali</button>" +
          '<button type="button" data-act="home">' + ICON.home + "Beranda</button>" +
          '<button type="button" data-act="reload">' + ICON.reload + "Muat ulang</button>" +
          '<button type="button" data-act="copy">' + ICON.copy + "Salin link</button>" +
        "</div>" +
      "</div>";
    document.body.appendChild(host);

    // Mode Web: halaman diperkecil (lebar 1280), jadi menu ini diperbesar
    // dengan faktor yang sama supaya tetap seukuran jari.
    var K = 1;
    function calcZoom() {
      var sw = (window.screen && screen.width) || window.innerWidth;
      K = MODE === "desktop" ? Math.max(1, window.innerWidth / sw) : 1;
      host.style.zoom = K === 1 ? "" : String(K);
    }
    calcZoom();

    var $ = function (s) { return root.querySelector(s); };
    var fab = $(".fab"), sheet = $(".sheet"), scrim = $(".scrim"), seg = $(".seg");
    bar = $(".bar");

    // ----- posisi tombol: bisa digeser, menempel ke tepi kiri/kanan -----
    var SIZE = 44, EDGE = 10;
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function place(x, y, snap) {
      var W = window.innerWidth / K, H = window.innerHeight / K;
      if (snap) x = (x + SIZE / 2 < W / 2) ? EDGE : W - SIZE - EDGE;
      x = clamp(x, EDGE, W - SIZE - EDGE);
      y = clamp(y, 70, H - SIZE - 24);
      fab.style.left = x + "px"; fab.style.top = y + "px";
      return { x: x, y: y };
    }
    var saved = null;
    try { saved = JSON.parse(store.get("kendatiFab") || "null"); } catch (e) {}
    var side = saved && saved.side === "left" ? "left" : "right";
    var ratio = saved && typeof saved.ratio === "number" ? saved.ratio : 0.78;
    function restore() {
      calcZoom();
      var W = window.innerWidth / K, H = window.innerHeight / K;
      place(side === "left" ? EDGE : W - SIZE - EDGE, ratio * H, false);
    }
    restore();
    window.addEventListener("resize", restore);

    var sleepT;
    function wake() { fab.classList.add("awake"); clearTimeout(sleepT); sleepT = setTimeout(function () { fab.classList.remove("awake"); }, 2600); }

    var start = null, moved = false;
    fab.addEventListener("pointerdown", function (e) {
      start = { px: e.clientX, py: e.clientY, x: parseFloat(fab.style.left) || 0, y: parseFloat(fab.style.top) || 0 };
      moved = false; wake();
      try { fab.setPointerCapture(e.pointerId); } catch (er) {}
    });
    fab.addEventListener("pointermove", function (e) {
      if (!start) return;
      var dx = (e.clientX - start.px) / K, dy = (e.clientY - start.py) / K;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 8) return;
      moved = true; fab.classList.add("drag");
      place(start.x + dx, start.y + dy, false);
    });
    function end() {
      if (!start) return;
      start = null; fab.classList.remove("drag");
      if (moved) {
        var p = place(parseFloat(fab.style.left) || 0, parseFloat(fab.style.top) || 0, true);
        side = p.x < window.innerWidth / K / 2 ? "left" : "right";
        ratio = p.y / (window.innerHeight / K);
        store.set("kendatiFab", JSON.stringify({ side: side, ratio: ratio }));
      } else {
        toggle(true);
      }
      wake();
    }
    fab.addEventListener("pointerup", end);
    fab.addEventListener("pointercancel", end);

    function toggle(on) {
      sheet.classList.toggle("on", on);
      scrim.classList.toggle("on", on);
      fab.style.opacity = on ? "0" : "";
      fab.style.pointerEvents = on ? "none" : "";
    }
    scrim.addEventListener("click", function () { toggle(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") toggle(false); });

    // swipe ke bawah untuk menutup panel
    var sy = null;
    sheet.addEventListener("touchstart", function (e) { sy = e.touches[0].clientY; }, { passive: true });
    sheet.addEventListener("touchmove", function (e) { if (sy !== null && e.touches[0].clientY - sy > 50) { sy = null; toggle(false); } }, { passive: true });

    seg.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-mode]");
      if (!b || b.dataset.mode === MODE) return;
      seg.className = "seg " + b.dataset.mode;
      seg.querySelectorAll("button").forEach(function (x) { x.classList.toggle("act", x === b); });
      setTimeout(function () { showProgress(); send("setMode", b.dataset.mode); }, 260);
    });

    root.querySelector(".grid").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-act]");
      if (!b) return;
      var act = b.dataset.act;
      toggle(false);
      if (act === "back") {
        if (history.length > 1) history.back(); else location.href = HOME;
      } else if (act === "home") {
        showProgress(); location.href = HOME;
      } else if (act === "reload") {
        showProgress(); send("hardReload");
      } else if (act === "copy") {
        copyLink(location.href);
      }
    });

    var toastEl = document.createElement("div");
    toastEl.className = "toast";
    root.appendChild(toastEl);
    var toastT;
    function toast(msg) {
      toastEl.textContent = msg; toastEl.classList.add("on");
      clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("on"); }, 1800);
    }
    function copyLink(text) {
      function fallback() {
        var t = document.createElement("textarea");
        t.value = text; t.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(t); t.select();
        try { document.execCommand("copy"); } catch (e) {}
        t.remove(); toast("Link disalin");
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { toast("Link disalin"); }, fallback);
      } else { fallback(); }
    }

    wake();
    hideProgress();
  }

  // pantau viewport (situs bisa menulis ulang meta) & progres
  window.addEventListener("beforeunload", showProgress);
  window.addEventListener("pageshow", hideProgress);
  keepLinksInApp();

  function boot() {
    build();
    if (MODE === "desktop" && document.head && window.MutationObserver) {
      new MutationObserver(applyViewport).observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ["content"] });
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
