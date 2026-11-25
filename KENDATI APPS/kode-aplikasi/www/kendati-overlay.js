/*
 * KENDATI App Overlay
 * Disuntikkan oleh aplikasi (Android & iOS) ke SETIAP halaman yang dibuka,
 * jadi tidak perlu mengubah kode situs ppbltahun2025.github.io sama sekali.
 *
 *  - Tombol bulat kecil (bisa digeser) -> panel: Mode Mobile / Mode Web,
 *    Kembali, Beranda, Muat ulang.
 *  - Mode Web = tampilan desktop seperti "Situs desktop" di Chrome.
 *  - Garis progres tipis saat pindah halaman.
 *  - Link target="_blank" dibuka di dalam aplikasi (iOS).
 */
(function () {
  "use strict";
  var IS_IOS = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.kendati);
  var IS_ANDROID = !!window.KendatiNative;
  var kBinds = [], kHooks = [];
  setInterval(function () { rebind(); }, 400);
  document.addEventListener("readystatechange", function () { rebind(); });

  // =========== PASANG ULANG PENANGKAP ===========
  // Apps Script menulis ulang isi frame-nya (document.open/write) dan itu
  // menghapus semua event listener. Penangkap dipasang di <html> dan dicek
  // ulang terus, jadi otomatis terpasang lagi setiap kali halaman ditulis ulang.
  function bind(type, fn, opts) { kBinds.push({ t: type, f: fn, o: opts, w: false, on: null }); rebind(); }
  function bindWin(type, fn, opts) { kBinds.push({ t: type, f: fn, o: opts, w: true, on: null }); rebind(); }
  function onRebind(fn) { kHooks.push({ f: fn, on: null }); rebind(); }
  function rebind() {
    var de = document.documentElement;
    if (!de) return;
    kBinds.forEach(function (b) {
      if (b.on === de) return;
      (b.w ? window : de).addEventListener(b.t, b.f, b.o);
      b.on = de;
    });
    kHooks.forEach(function (h) {
      if (h.on === de) return;
      h.on = de;
      try { h.f(); } catch (e) {}
    });
  }

  // pesan singkat di layar (dari frame mana pun -> ditampilkan frame utama)
  function notify(msg) {
    if (window.top === window) { if (window.__kendatiToast) window.__kendatiToast(msg); }
    else { try { window.top.postMessage({ kendatiToast: String(msg) }, "*"); } catch (e) {} }
  }

  // =========== INGAT LOGIN (semua frame) ===========
  // Saat user login, nama & sandi disimpan terenkripsi oleh aplikasi (Android Keystore /
  // iOS Keychain), per situs. Saat halaman login muncul lagi, kolom diisi otomatis.
  function initLogin() {
    if (window.__kendatiLoginInit || !(IS_IOS || window.KendatiLogin)) return;
    if (location.protocol !== "https:") return;
    window.__kendatiLoginInit = true;
    var saved = null, filled = false, asked = false;
    function ask(msg) {
      if (window.KendatiLogin) window.KendatiLogin.postMessage(JSON.stringify(msg));
      else window.webkit.messageHandlers.kendati.postMessage({ action: "login", value: JSON.stringify(msg) });
    }
    window.__kendatiLoginReply = function (json) {
      try { saved = json ? JSON.parse(json) : null; } catch (e) { saved = null; }
      tryFill();
    };
    if (window.KendatiLogin) window.KendatiLogin.onmessage = function (e) { window.__kendatiLoginReply(e.data); };
    function visible(el) { return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); }
    function fields() {
      var pws = Array.prototype.filter.call(document.querySelectorAll('input[type="password"]'), visible);
      if (!pws.length) return null;
      var pw = pws[0], user = null;
      var all = Array.prototype.filter.call(document.querySelectorAll("input"), visible);
      for (var i = all.indexOf(pw) - 1; i >= 0; i--) {
        var t = (all[i].type || "text").toLowerCase();
        if (t === "text" || t === "email" || t === "tel" || t === "number" || t === "search") { user = all[i]; break; }
      }
      return { pw: pw, user: user };
    }
    function setVal(el, v) {
      var set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    function tryFill() {
      if (!saved || filled) return;
      var f = fields();
      if (!f || f.pw.value) return;
      if (f.user && !f.user.value && saved.u) setVal(f.user, saved.u);
      setVal(f.pw, saved.p || "");
      filled = true;
      notify("Akun tersimpan diisi otomatis");
    }
    function capture() {
      var f = fields();
      if (!f || !f.pw.value) return;
      var u = f.user ? f.user.value : "";
      if (saved && saved.u === u && saved.p === f.pw.value) return;
      saved = { u: u, p: f.pw.value };
      ask({ type: "save", u: u, p: f.pw.value });
    }
    bind("submit", capture, true);
    bind("click", function (e) {
      if (e.target && e.target.closest && e.target.closest('button,input[type="submit"],input[type="button"],[role="button"],a')) capture();
    }, true);
    bind("keydown", function (e) { if (e.key === "Enter") capture(); }, true);
    function watch() {
      if (!asked) { asked = true; ask({ type: "get" }); }
      filled = false;
      if (document.documentElement) {
        new MutationObserver(function () { if (!filled) tryFill(); })
          .observe(document.documentElement, { childList: true, subtree: true });
      }
      tryFill();
    }
    onRebind(watch);
  }
  initLogin();

  // =========== UNDUHAN & EKSPOR (semua frame, termasuk iframe Apps Script) ===========
  // WebView tidak bisa mengunduh file blob:/data: sendiri (ekspor PDF/Excel, tombol Unduh),
  // jadi file diambil di sini lalu dikirim ke aplikasi untuk disimpan
  // (Android: folder Download/KENDATI, iOS: lembar Bagikan -> Simpan ke File).
  if (!window.__kendatiDl && (IS_IOS || IS_ANDROID)) {
    window.__kendatiDl = true;
    var BLOBS = new Map();                 // url blob: -> Blob, dicatat saat dibuat
    var isFileUrl = function (u) { return /^(blob|data):/i.test(String(u || "")); };

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
    var grab = function (url, name) {
      url = String(url);
      notify("Menyiapkan file…");
      var p = BLOBS.has(url) ? Promise.resolve(BLOBS.get(url)) : fetch(url).then(function (res) { return res.blob(); });
      p.then(function (b) { saveBlob(b, name || "unduhan"); })
       .catch(function (err) { console.warn("[KENDATI] unduh gagal", err); notify("File tidak bisa diambil"); });
    };
    // unduh alamat http(s) lewat aplikasi (membawa cookie halaman)
    var nativeDownload = function (url, name) {
      notify("Mengunduh…");
      if (IS_ANDROID) window.KendatiNative.download(String(url), name || "");
      else window.webkit.messageHandlers.kendati.postMessage({ action: "download", value: String(url), name: name || "" });
    };
    var DL_URL = /drive\.google\.com\/uc\?|[?&]export=download|drive\.usercontent\.google\.com\/download|docs\.google\.com\/.+\/export|\/download\?|googleusercontent\.com\/.*download/i;
    window.__kendatiGrab = grab;

    // 1) catat setiap file yang dibuat halaman (URL.createObjectURL)
    var origCreate = URL.createObjectURL, origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = function (obj) {
      var u = origCreate.apply(URL, arguments);
      try { if (obj instanceof Blob) BLOBS.set(u, obj); } catch (e) {}
      return u;
    };
    URL.revokeObjectURL = function (u) {
      setTimeout(function () { BLOBS.delete(u); }, 120000);   // simpan sebentar, file mungkin masih diunduh
      return origRevoke.apply(URL, arguments);
    };

    var nameOf = function (a) { return a.getAttribute("download") || "unduhan"; };

    // 2) klik biasa pada link file / link unduhan
    bind("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a) return;
      if (isFileUrl(a.href)) {
        e.preventDefault(); e.stopImmediatePropagation();
        grab(a.href, nameOf(a));
      } else if (/^https?:/i.test(a.href) && (a.hasAttribute("download") || DL_URL.test(a.href))) {
        e.preventDefault(); e.stopImmediatePropagation();
        nativeDownload(a.href, a.getAttribute("download") || "");
      }
    }, true);

    // 3) a.click() pada link yang tidak ditempel ke halaman (SheetJS, dll.)
    var origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (!this.isConnected && isFileUrl(this.href)) { grab(this.href, nameOf(this)); return; }
      if (!this.isConnected && /^https?:/i.test(this.href) && (this.hasAttribute("download") || DL_URL.test(this.href))) {
        nativeDownload(this.href, this.getAttribute("download") || ""); return;
      }
      return origClick.apply(this, arguments);
    };

    // 4) a.dispatchEvent(new MouseEvent("click")) (FileSaver.js, jsPDF doc.save(), dll.)
    var origDispatch = EventTarget.prototype.dispatchEvent;
    EventTarget.prototype.dispatchEvent = function (ev) {
      if (ev && ev.type === "click" && this instanceof HTMLAnchorElement && !this.isConnected && isFileUrl(this.href)) {
        grab(this.href, nameOf(this));
        return true;
      }
      return origDispatch.apply(this, arguments);
    };

    // 5) window.open(fileUrl)
    var origOpen = window.open;
    window.open = function (url) {
      if (isFileUrl(url)) { grab(url, "unduhan"); return null; }
      if (url && DL_URL.test(String(url))) { nativeDownload(new URL(String(url), location.href).href, ""); return null; }
      return origOpen.apply(window, arguments);
    };

    // 6) halaman pindah langsung ke blob: -> aplikasi bertanya ke semua frame siapa pemilik filenya
    var forward = function (msg) {
      for (var i = 0; i < window.frames.length; i++) { try { window.frames[i].postMessage(msg, "*"); } catch (e) {} }
    };
    bindWin("message", function (e) {
      var d = e.data;
      if (!d || !d.kendatiGrab) return;
      if (BLOBS.has(d.kendatiGrab)) grab(d.kendatiGrab, d.name);
      else forward(d);
    });
    window.__kendatiGrabBlob = function (url, name) {
      url = String(url);
      if (BLOBS.has(url) || /^data:/i.test(url)) { grab(url, name); return; }
      // coba ambil di frame ini dulu; kalau bukan miliknya, tanya iframe-iframe di dalamnya
      fetch(url).then(function (r) { return r.blob(); })
        .then(function (b) { saveBlob(b, name || "unduhan"); })
        .catch(function () { forward({ kendatiGrab: url, name: name || "unduhan" }); });
    };
  }

  if (window.top !== window) { keepLinksInApp(); return; }   // tarik-refresh dimatikan (sering tidak sengaja)   // iframe: link + tarik-refresh; UI di frame utama
  if (window.__kendatiOverlay) return;          // jangan dobel
  window.__kendatiOverlay = true;

  var HOME = "https://ppbltahun2025.github.io/";
  // Supabase yang sama dengan penghitung pengunjung KENDATI (kunci publik)
  var SB_URL = "https://kvcnbyasnvpmnrbvkjjg.supabase.co";
  var SB_KEY = "sb_publishable_J9EFLRjCWE9gaLgsQLKeLQ_x-Wwu3wF";
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

  // =========== TARIK KE BAWAH UNTUK REFRESH (semua frame) ===========
  // Tarik dari atas saat halaman/elemen sudah di posisi paling atas -> lepas -> muat ulang.
  // Di dalam iframe, gerakan dikirim ke frame utama (indikator & reload ada di sana).
  function pullSignal(v) {
    if (window.top === window) { if (window.__kendatiPullUI) window.__kendatiPullUI(v); }
    else { try { window.top.postMessage({ kendatiPull: v }, "*"); } catch (e) {} }
  }
  function blocksPull(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var tag = n.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "CANVAS" || tag === "VIDEO" || n.isContentEditable) return true;
      if (n.id === "kendati-app-overlay" || n.hasAttribute("data-no-pull")) return true;
      var cls = typeof n.className === "string" ? n.className : "";
      if (/leaflet|mapboxgl|ol-viewport|gm-style|swiper|slick|carousel/i.test(cls)) return true;   // peta & slider
      if (n.scrollTop > 0) return true;                                // elemen yang sedang di-scroll
      var cs = getComputedStyle(n);
      if (cs.touchAction === "none" || cs.touchAction === "pan-x") return true;
    }
    var se = document.scrollingElement || document.documentElement;
    return se.scrollTop > 0 || window.scrollY > 0;
  }
  function initPull() {
    if (window.__kendatiPullInit) return;
    window.__kendatiPullInit = true;
    var y0 = null, x0 = 0, active = false, dist = 0;
    bind("touchstart", function (e) {
      active = false; dist = 0; y0 = null;
      if (e.touches.length !== 1) return;
      if (window.visualViewport && window.visualViewport.scale > 1.05) return;   // sedang di-zoom
      if (window.__kendatiSheetOpen) return;
      if (blocksPull(e.target)) return;
      y0 = e.touches[0].clientY; x0 = e.touches[0].clientX;
    }, { passive: true, capture: true });
    bind("touchmove", function (e) {
      if (y0 === null) return;
      var dy = e.touches[0].clientY - y0, dx = Math.abs(e.touches[0].clientX - x0);
      if (!active) {
        if (dy < 0 || dx > Math.abs(dy)) { y0 = null; return; }   // gerak ke atas / ke samping
        if (dy < 12) return;
        active = true;
      }
      // ubah ke piksel layar (di Mode Web halaman diperkecil)
      var kz = Math.max(1, window.innerWidth / ((window.screen && screen.width) || window.innerWidth));
      dist = Math.max(0, dy) / kz;
      pullSignal(dist);
    }, { passive: true, capture: true });
    function end() {
      if (active) pullSignal(dist >= 150 ? "release" : "cancel");
      y0 = null; active = false; dist = 0;
    }
    bind("touchend", end, { passive: true, capture: true });
    bind("touchcancel", end, { passive: true, capture: true });
  }

  // ---------- Mode Web: paksa viewport selebar desktop ----------
  // Mode Web: lebar 1280. Kembali ke Mobile: pulihkan viewport asli halaman.
  var VP_DESKTOP = "width=1280";
  function applyViewport() {
    if (!document.head) return;
    var m = document.querySelector('meta[name="viewport"]');
    if (MODE === "desktop") {
      if (!m) { m = document.createElement("meta"); m.name = "viewport"; m.setAttribute("data-kendati-added", "1"); document.head.appendChild(m); }
      if (!m.hasAttribute("data-kendati-orig") && m.content !== VP_DESKTOP) m.setAttribute("data-kendati-orig", m.content || "");
      if (m.content !== VP_DESKTOP) m.content = VP_DESKTOP;
    } else if (m && m.content === VP_DESKTOP) {
      var orig = m.getAttribute("data-kendati-orig") || "width=device-width, initial-scale=1";
      // paksa skala kembali 1 dulu, lalu kembalikan aturan asli halaman
      m.content = "width=device-width, initial-scale=1, maximum-scale=1";
      setTimeout(function () { if (MODE !== "desktop") m.content = orig; }, 400);
    }
  }

  // ---------- Link _blank & window.open tetap di dalam aplikasi (iOS) ----------
  function goInApp(href) {
    if (typeof showProgress === "function") showProgress();
    try { window.top.location.href = href; } catch (e) { location.href = href; }
  }

  function keepLinksInApp() {
    if (window.__kendatiLinks) return;
    window.__kendatiLinks = true;
    bind("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (e.defaultPrevented || !a || a.hasAttribute("download")) return;
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
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
    reload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/></svg>',
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
    ".rate{display:none}",
    ".sheet.rating .menu{display:none}",
    ".sheet.rating .rate{display:block}",
    ".rate p{margin:0 4px 10px;font-size:12.5px;opacity:.8;line-height:1.45}",
    ".stars{display:flex;justify-content:center;gap:6px;margin:4px 0 12px}",
    ".stars button{width:46px;height:46px;border:0;background:none;padding:4px;cursor:pointer;color:rgba(255,255,255,.25);transition:transform .15s ease,color .15s ease}",
    ".stars button.on{color:#ffd873}",
    ".stars button:active{transform:scale(.88)}",
    ".stars svg{width:100%;height:100%;fill:currentColor;stroke:none}",
    ".rate textarea{width:100%;min-height:84px;resize:vertical;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#eaf1ff;font:inherit;font-size:13px;padding:10px 12px;outline:none}",
    ".rate textarea:focus{border-color:rgba(240,180,41,.6)}",
    ".rbtns{display:grid;grid-template-columns:1fr 2fr;gap:8px;margin-top:10px}",
    ".rbtns button{height:44px;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#eaf1ff;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer}",
    ".rbtns .send{border:0;color:#08182e;background:linear-gradient(160deg,#ffd873,#f0b429)}",
    ".rbtns .send[disabled]{opacity:.45}",
    ".upd{position:fixed;inset:0;z-index:2147483647;display:none;align-items:center;justify-content:center;padding:24px;background:rgba(3,11,24,.82);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}",
    ".upd.on{display:flex}",
    ".upd-card{width:min(360px,100%);padding:26px 22px 20px;border-radius:26px;background:linear-gradient(180deg,#0b2a55,#071b3a);border:1px solid rgba(240,180,41,.4);box-shadow:0 24px 60px rgba(0,0,0,.55);color:#eaf1ff;text-align:center}",
    ".upd-ic{width:64px;height:64px;margin:0 auto 14px;border-radius:20px;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#ffd873,#f0b429);color:#08182e}",
    ".upd-ic svg{width:32px;height:32px}",
    ".upd h3{margin:0;font-size:19px;color:#ffd873}",
    ".upd .vv{margin:6px 0 14px;font-size:12px;opacity:.7}",
    ".upd ul{margin:0 0 16px;padding:12px 14px 12px 30px;text-align:left;border-radius:16px;background:rgba(255,255,255,.06);max-height:34vh;overflow:auto}",
    ".upd li{font-size:12.8px;line-height:1.5;margin:3px 0}",
    ".upd .go{display:block;width:100%;height:50px;border:0;border-radius:16px;font:inherit;font-size:15px;font-weight:800;color:#08182e;background:linear-gradient(160deg,#ffd873,#f0b429);cursor:pointer}",
    ".upd .alt{display:block;width:100%;margin-top:8px;height:42px;border:1px solid rgba(255,255,255,.18);border-radius:14px;background:none;font:inherit;font-size:13px;font-weight:700;color:#eaf1ff;cursor:pointer}",
    ".upd .hint{margin:12px 0 0;font-size:11.5px;line-height:1.5;opacity:.65}",
    ".toast{position:fixed;left:50%;bottom:max(28px,env(safe-area-inset-bottom));transform:translate(-50%,20px);padding:9px 16px;border-radius:999px;background:rgba(7,27,58,.92);border:1px solid rgba(240,180,41,.5);color:#ffd873;font-size:12.5px;font-weight:700;opacity:0;pointer-events:none;transition:opacity .25s ease,transform .25s ease;z-index:2147483647}",
    ".toast.on{opacity:1;transform:translate(-50%,0)}",
    ".ptr{position:fixed;top:0;left:50%;width:42px;height:42px;margin-left:-21px;border-radius:50%;background:rgba(7,27,58,.92);border:1px solid rgba(240,180,41,.55);box-shadow:0 8px 22px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;transform:translateY(-60px);opacity:0;z-index:2147483647;pointer-events:none}",
    ".ptr svg{width:20px;height:20px;color:#ffd873}",
    ".ptr.ready{border-color:#ffd873;background:rgba(240,180,41,.25)}",
    ".ptr.back{transition:transform .3s cubic-bezier(.22,1,.36,1),opacity .3s ease}",
    ".ptr.spin svg{animation:kspin .8s linear infinite}",
    "@keyframes kspin{to{transform:rotate(360deg)}}",
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
      '<div class="ptr">' + ICON.reload + '</div>' +
      '<div class="scrim"></div>' +
      '<div class="upd" role="alertdialog" aria-modal="true"><div class="upd-card">' +
        '<div class="upd-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/></svg></div>' +
        '<h3>Versi baru tersedia</h3><div class="vv"></div><ul></ul>' +
        '<button type="button" class="go">Perbarui sekarang</button>' +
        '<button type="button" class="alt">Buka halaman unduh</button>' +
        '<p class="hint">Aplikasi perlu diperbarui sebelum bisa digunakan lagi.</p>' +
      "</div></div>" +
      '<button class="fab" type="button" aria-label="Menu aplikasi KENDATI">' + ICON.menu + "</button>" +
      '<div class="sheet" role="dialog" aria-label="Menu aplikasi">' +
        '<div class="grip"></div>' +
        '<div class="head"><b>KENDATI</b></div>' +
        '<div class="menu">' +
        '<div class="seg ' + MODE + '"><i></i>' +
          '<button type="button" data-mode="mobile" class="' + (MODE === "mobile" ? "act" : "") + '">' + ICON.phone + "Mobile</button>" +
          '<button type="button" data-mode="desktop" class="' + (MODE === "desktop" ? "act" : "") + '">' + ICON.desktop + "Web</button>" +
        "</div>" +
        '<div class="grid">' +
          '<button type="button" data-act="back">' + ICON.back + "Kembali</button>" +
          '<button type="button" data-act="home">' + ICON.home + "Beranda</button>" +
          '<button type="button" data-act="reload">' + ICON.reload + "Muat ulang</button>" +
          '<button type="button" data-act="rate">' + ICON.star + "Rating</button>" +
        "</div>" +
        "</div>" +
        '<div class="rate">' +
          "<p>Seberapa membantu aplikasi KENDATI? Rating &amp; saran tampil di halaman unduh.</p>" +
          '<div class="stars">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-star="' + n + '" aria-label="' + n + ' bintang">' + ICON.star + "</button>"; }).join("") + "</div>" +
          '<textarea maxlength="1000" placeholder="Saran atau komentar (opsional)"></textarea>' +
          '<div class="rbtns"><button type="button" class="cancel">Batal</button><button type="button" class="send" disabled>Kirim</button></div>' +
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

    // ----- indikator tarik-refresh -----
    var ptr = $(".ptr"), ptrIcon = ptr.querySelector("svg"), reloading = false;
    window.__kendatiPullUI = function (v) {
      if (reloading) return;
      if (v === "release") {
        reloading = true;
        ptr.className = "ptr back spin ready";
        ptr.style.transform = "translateY(" + 70 + "px)"; ptr.style.opacity = "1";
        ptrIcon.style.transform = "";
        showProgress();
        setTimeout(function () { location.reload(); }, 250);
        return;
      }
      if (v === "cancel") {
        ptr.className = "ptr back";
        ptr.style.transform = "translateY(-60px)"; ptr.style.opacity = "0";
        return;
      }
      var d = Number(v), pullY = Math.min(d * 0.55, 110);
      ptr.className = "ptr" + (d >= 150 ? " ready" : "");
      ptr.style.transform = "translateY(" + (pullY - 50) + "px)";
      ptr.style.opacity = String(Math.min(1, d / 90));
      ptrIcon.style.transform = "rotate(" + (d * 1.6) + "deg)";
    };
    window.addEventListener("message", function (e) {
      if (e.data && e.data.kendatiPull !== undefined) window.__kendatiPullUI(e.data.kendatiPull);
      if (e.data && e.data.kendatiToast && window.__kendatiToast) window.__kendatiToast(e.data.kendatiToast);
    });

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

    // dipanggil aplikasi saat mode diganti: TANPA memuat ulang, tetap di halaman yang sama
    window.__kendatiApplyMode = function (m) {
      MODE = m === "desktop" ? "desktop" : "mobile";
      document.documentElement.classList.toggle("kendati-desktop", MODE === "desktop");
      document.documentElement.classList.toggle("kendati-mobile", MODE === "mobile");
      applyViewport();
      seg.className = "seg " + MODE;
      seg.querySelectorAll("button").forEach(function (x) { x.classList.toggle("act", x.dataset.mode === MODE); });
      setTimeout(restore, 450);       // ukuran tombol menu menyesuaikan skala baru
      toast(MODE === "desktop" ? "Mode Web" : "Mode Mobile");
    };

    var sleepT;
    function wake() { fab.classList.add("awake"); clearTimeout(sleepT); sleepT = setTimeout(function () { fab.classList.remove("awake"); }, 2600); }

    var start = null, moved = false, openedAt = 0, suppressClick = false;
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
        suppressClick = true;           // habis digeser: jangan dianggap tap
      }
      wake();
    }
    // buka menu lewat "click" (bukan pointerup): di HP, tap diubah jadi click setelah
    // jari diangkat. Kalau menu dibuka di pointerup, click itu jatuh ke lapisan gelap
    // dan langsung menutup menu lagi.
    fab.addEventListener("click", function (e) {
      e.stopPropagation();
      if (suppressClick) { suppressClick = false; return; }
      toggle(true);
    });
    fab.addEventListener("pointerup", end);
    fab.addEventListener("pointercancel", end);

    function toggle(on) {
      if (on) openedAt = Date.now();
      window.__kendatiSheetOpen = !!on;
      if (!on) sheet.classList.remove("rating");
      sheet.classList.toggle("on", on);
      scrim.classList.toggle("on", on);
      fab.style.opacity = on ? "0" : "";
      fab.style.pointerEvents = on ? "none" : "";
    }
    scrim.addEventListener("click", function () {
      if (Date.now() - openedAt < 450) return;   // abaikan sisa tap yang membuka menu
      toggle(false);
    });
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
      setTimeout(function () { send("setMode", b.dataset.mode); }, 260);
    });

    root.querySelector(".grid").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-act]");
      if (!b) return;
      var act = b.dataset.act;
      if (act !== "rate") toggle(false);
      if (act === "back") {
        if (history.length > 1) history.back(); else location.href = HOME;
      } else if (act === "home") {
        showProgress(); location.href = HOME;
      } else if (act === "reload") {
        showProgress(); send("hardReload");
      } else if (act === "rate") {
        openRating();
      }
    });

    // ----- rating & saran -----
    var rateEl = $(".rate"), stars = rateEl.querySelectorAll("[data-star]"), note = rateEl.querySelector("textarea"),
        sendBtn = rateEl.querySelector(".send"), chosen = 0;
    var PLATFORM = IS_IOS ? "ios" : "android";
    function paint(n) { stars.forEach(function (b, i) { b.classList.toggle("on", i < n); }); }
    function deviceId() {
      var id = store.get("kendatiDevice");
      if (!id) {
        id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
        store.set("kendatiDevice", id);
      }
      return id;
    }
    function openRating() {
      try { var last = JSON.parse(store.get("kendatiRating") || "null"); } catch (e) { last = null; }
      chosen = last ? last.r : 0; note.value = last ? (last.c || "") : "";
      paint(chosen); sendBtn.disabled = !chosen;
      sheet.classList.add("rating");
    }
    function closeRating() { sheet.classList.remove("rating"); }
    stars.forEach(function (b) {
      b.addEventListener("click", function () { chosen = Number(b.dataset.star); paint(chosen); sendBtn.disabled = false; });
    });
    rateEl.querySelector(".cancel").addEventListener("click", function () { closeRating(); });
    sendBtn.addEventListener("click", function () {
      if (!chosen) return;
      sendBtn.disabled = true; sendBtn.textContent = "Mengirim…";
      var body = JSON.stringify({ p_platform: PLATFORM, p_rating: chosen, p_comment: note.value.trim() });
      var url = SB_URL + "/rest/v1/rpc/submit_feedback";
      window.__kendatiRatingDone = function (status) {
        window.__kendatiRatingDone = null;
        status = Number(status) || 0;
        if (status >= 200 && status < 300) {
          store.set("kendatiRating", JSON.stringify({ r: chosen, c: note.value.trim() }));
          closeRating(); toggle(false); toast("Terima kasih atas rating Anda!");
        } else if (status === 401 || status === 403) {
          toast("Masuk akun Google dulu: buka Beranda, lalu coba lagi");
        } else {
          toast("Rating belum terkirim (" + (status || "tidak ada koneksi") + ")");
        }
        sendBtn.disabled = !chosen; sendBtn.textContent = "Kirim";
      };
      // dikirim lewat aplikasi: halaman seperti Apps Script memblokir kiriman ke situs lain (CSP)
      if (IS_ANDROID && window.KendatiNative.postJson) {
        window.KendatiNative.postJson(url, SB_KEY, body);
      } else if (IS_IOS) {
        window.webkit.messageHandlers.kendati.postMessage({ action: "postJson", value: body, url: url, key: SB_KEY });
      } else {
        fetch(url, { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: body })
          .then(function (r) { window.__kendatiRatingDone(r.status); }, function () { window.__kendatiRatingDone(0); });
      }
    });

    // ----- wajib update: layar dikunci bila ada versi baru -----
    var UNDUH = "https://ppbltahun2025.github.io/KENDATI%20APPS/unduh.html";
    var APK = "https://github.com/ppbltahun2025/ppbltahun2025.github.io/releases/download/aplikasi/KENDATI.apk";
    var upd = $(".upd");
    function showUpdate(info) {
      if (!info || !info.latest) return;
      if (/unduh\.html$/i.test(decodeURIComponent(location.pathname))) return;   // halaman unduh tetap bisa dibuka
      upd.querySelector(".vv").textContent = "Versi " + info.latest + " · versi Anda " + (info.current || "-");
      var ul = upd.querySelector("ul"), notes = info.notes || [];
      ul.innerHTML = "";
      notes.forEach(function (n) { var li = document.createElement("li"); li.textContent = n; ul.appendChild(li); });
      ul.style.display = notes.length ? "" : "none";
      upd.querySelector(".go").textContent = IS_ANDROID ? "Unduh & pasang" : "Perbarui sekarang";
      upd.classList.add("on");
      toggle(false);
      fab.style.display = "none";
    }
    upd.querySelector(".go").addEventListener("click", function () {
      if (IS_ANDROID && window.KendatiNative.download) {
        try {   // catat unduhan di Supabase (log + jumlah)
          if (window.KendatiNative.postJson) window.KendatiNative.postJson(SB_URL + "/rest/v1/rpc/record_download", SB_KEY, JSON.stringify({ p_platform: "android" }));
        } catch (e) {}
        window.KendatiNative.download(APK, "KENDATI.apk");
        upd.querySelector(".hint").textContent = "Mengunduh… Setelah selesai, ketuk notifikasi \"Unduhan selesai\" lalu pilih Instal.";
      } else {
        location.href = UNDUH;
      }
    });
    upd.querySelector(".alt").addEventListener("click", function () { location.href = UNDUH; });
    window.__kendatiOnUpdate = showUpdate;
    try {
      var pending = IS_ANDROID && window.KendatiNative.getUpdate ? window.KendatiNative.getUpdate() : "";
      if (pending) showUpdate(JSON.parse(pending));
      else if (window.__kendatiUpdateInfo) showUpdate(window.__kendatiUpdateInfo);
    } catch (e) {}

    var toastEl = document.createElement("div");
    toastEl.className = "toast";
    root.appendChild(toastEl);
    var toastT;
    function toast(msg) {
      toastEl.textContent = msg; toastEl.classList.add("on");
      clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("on"); }, 2200);
    }
    window.__kendatiToast = toast;

    wake();
    hideProgress();
  }

  // pantau viewport (situs bisa menulis ulang meta) & progres
  window.addEventListener("beforeunload", showProgress);
  window.addEventListener("pageshow", hideProgress);
  keepLinksInApp();

  function boot() {
    build();
    if (document.head && window.MutationObserver) {
      new MutationObserver(applyViewport).observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ["content"] });
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
