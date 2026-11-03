/* PrintCaddy updates: notice a newer published build and switch to it without clearing site data.
   Start page: reloads straight away. Editor: reloads when the tab comes back, or right away via the "Reload" button. */
(function () {
  var BUILD = "202611030155-1cbf1624", busy = false, pending = false;
  function inEditor() { return !!document.querySelector(".secondary-toolbar"); }
  function reload() { try { sessionStorage.setItem("printcad-updated", BUILD); } catch (e) {} location.reload(); }
  function note() {
    if (document.querySelector(".pcup")) return;
    var d = document.createElement("div"); d.className = "pcup"; d.setAttribute("role", "status");
    d.innerHTML = '<span>A new version of PrintCaddy is ready.</span><button type="button">Reload</button>';
    d.querySelector("button").onclick = reload;
    d.style.cssText = "position:fixed;z-index:2147483000;left:50%;bottom:calc(56px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:flex;gap:10px;align-items:center;padding:8px 10px 8px 14px;border-radius:10px;background:#2b2218;color:#fff;font:13px system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.3);max-width:calc(100vw - 20px)";
    d.querySelector("button").style.cssText = "border:0;border-radius:7px;padding:6px 12px;background:#e8892c;color:#fff;font:600 13px system-ui,sans-serif";
    document.body.appendChild(d);
  }
  function check() {
    if (busy || BUILD.indexOf("__") === 0) return; busy = true;
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) navigator.serviceWorker.getRegistration().then(function (r) { if (r) r.update().catch(function () {}); }).catch(function () {});
    fetch("/version.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
      busy = false; if (!v || !v.build || v.build === BUILD) return;
      pending = true; if (!inEditor()) reload(); else note();
    }).catch(function () { busy = false; });
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") return;
    if (pending && !inEditor()) reload(); else check();
  });
  addEventListener("pageshow", function (e) { if (e.persisted) check(); });
  addEventListener("online", check);
  setInterval(check, 5 * 60 * 1000);
  setTimeout(check, 1500);
  window.PrintCADUpdate = { build: BUILD, check: check };
})();

/* Build label + "Check for updates" button: fixed bottom-left on the Home screen only (never in the editor,
   whose bottom-left holds the layer slider / view cube). The button opens a small modal; in the iPad app it uses the
   app's in-app updater (window.PrintCaddyApp, from ios-shim.js), on the website it compares the live /version.json. */
(function () {
  var BUILD = "202611030155-1cbf1624", VERSION = "1.0.13", desk = "", el = null, txt = null;
  function b() { return BUILD.indexOf("__") === 0 ? "dev" : BUILD; }
  function v() { return desk || (VERSION.indexOf("__") === 0 ? "dev" : VERSION); }
  function label() { return "Version " + v() + "\nBuild " + b(); }
  function h(tag, css, text) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; }
  var BTN = "min-height:40px;padding:8px 16px;border-radius:9px;font:600 14px system-ui,sans-serif;cursor:pointer;touch-action:manipulation;";
  function openModal() {
    if (document.querySelector(".pc-update-modal")) return;
    var app = window.PrintCaddyApp;
    var ov = h("div", "position:fixed;inset:0;z-index:2147483100;background:rgba(30,22,14,.38);display:flex;align-items:center;justify-content:center;padding:16px");
    ov.className = "pc-update-modal"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Check for updates");
    var card = h("div", "background:#fffdf9;color:#2b2218;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.3);width:min(380px,100%);padding:20px 20px 16px;font:14px/1.45 system-ui,sans-serif");
    var title = h("div", "font:700 17px system-ui,sans-serif;margin-bottom:6px", "Check for updates");
    var info = h("div", "color:#6e6050;font-size:13px;white-space:pre-line");
    var ai = app && app.info ? app.info() : null;
    info.textContent = ai ? "Version " + v() + " · app " + (ai.nativeVersion || "?") + "\nBuild " + (ai.webBuild || b()) : label();
    var status = h("div", "margin:14px 0 4px;font-weight:600;min-height:20px", "Checking…"); status.setAttribute("role", "status");
    var row = h("div", "display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;align-items:center;margin-top:14px");
    var close = h("button", BTN + "border:1px solid #d9cfc2;background:#fff;color:#2b2218", "Close"); close.type = "button";
    function done() { ov.remove(); document.removeEventListener("keydown", esc); }
    function esc(e) { if (e.key === "Escape") done(); }
    close.onclick = done; ov.addEventListener("click", function (e) { if (e.target === ov) done(); }); document.addEventListener("keydown", esc);
    function action(text, fn) { var a = h("button", BTN + "border:0;background:#e8892c;color:#fff", text); a.type = "button"; a.className = "pc-update-action"; a.onclick = fn; row.insertBefore(a, close); return a; }
    row.appendChild(close); card.appendChild(title); card.appendChild(info); card.appendChild(status);
    var nat = h("div", "font-size:13px;color:#6e6050"); card.appendChild(nat); card.appendChild(row);
    function link(text, href, css) { var a = h("a", css || "color:#a85d12;font-size:13px", text); a.href = href; a.target = "_blank"; a.rel = "noreferrer"; return a; }
    if (app && app.checkNative) {
      app.checkNative().then(function (r) {
        if (r && r.available) {
          var box = h("div", "margin-top:12px;padding:10px 12px;border-radius:10px;background:#fbefe1;color:#2b2218");
          box.appendChild(h("div", "font-weight:600", "New app version available: " + r.version + " (you have " + r.current + ")"));
          box.appendChild(h("div", "font-size:13px;margin:4px 0 8px;color:#6e6050", "Download the .ipa, then install it with Sideloadly from your computer. Your designs stay on the iPad."));
          box.appendChild(link("Download .ipa", r.ipaUrl, BTN + "display:inline-flex;align-items:center;text-decoration:none;border:0;background:#e8892c;color:#fff"));
          nat.appendChild(box);
        }
        var sec = h("div", "margin-top:8px;display:flex;gap:14px;flex-wrap:wrap");
        sec.appendChild(link("Release notes", (r && r.releaseUrl) || app.nativeUpdateUrl));
        if (app.altStoreSourceUrl) sec.appendChild(link("AltStore source", app.altStoreSourceUrl, "color:#8a7a68;font-size:12px"));
        nat.appendChild(sec);
      }).catch(function () {});
    }
    if (app && app.provisioning) {
      app.provisioning().then(function (p) {
        if (!p || !p.expires) return; var d = new Date(p.expires), left = d - Date.now();
        var line = h("div", "margin-top:8px;font-size:12px;color:" + (left < 36 * 3600e3 ? "#b4441c;font-weight:600" : "#8a7a68"),
          left > 0 ? "App signing expires " + d.toLocaleString() + (left < 36 * 3600e3 ? " – re-sign with Sideloadly before then." : " (free Apple ID: re-sign with Sideloadly every 7 days).") : "App signing has expired – re-install with Sideloadly.");
        nat.insertBefore(line, nat.firstChild);
      }).catch(function () {});
    } ov.appendChild(card); document.body.appendChild(ov); close.focus();
    function fail(e) { status.textContent = "Couldn't check: " + (e && e.message ? e.message : e || "offline?"); }
    if (app && app.check) {
      app.check().then(function (r) {
        if (r.error) return fail(r.error);
        if (!r.available) { status.textContent = "You're up to date."; return; }
        status.textContent = "Update available: build " + r.build;
        var a = action("Install", function () { a.disabled = true; close.disabled = true; status.textContent = "Downloading update… PrintCaddy restarts when it's ready.";
          app.install().catch(function (e) { a.disabled = false; close.disabled = false; status.textContent = "Update failed: " + (e && e.message ? e.message : e); }); });
      }).catch(fail);
    } else {
      fetch("/version.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)); }).then(function (j) {
        if (!j || !j.build || b() === "dev" || j.build === BUILD) { status.textContent = "You're up to date."; return; }
        status.textContent = "Update available: build " + j.build;
        action("Reload", function () { try { sessionStorage.setItem("printcad-updated", BUILD); } catch (e) {} location.reload(); });
      }).catch(fail);
    }
  }
  window.PrintCADUpdateDialog = openModal;
  function sync() {
    var home = !document.querySelector(".secondary-toolbar") && !!document.body;
    if (!home) { if (el) { el.remove(); el = null; document.documentElement.classList.remove("pc-has-build"); } return; }
    if (!el) {
      el = h("div", "position:fixed;z-index:5;left:calc(8px + env(safe-area-inset-left,0px));bottom:calc(6px + env(safe-area-inset-bottom,0px));display:flex;align-items:flex-end;gap:8px;max-width:calc(100vw - 16px)");
      el.className = "pc-build-bar";
      txt = h("div", "pointer-events:none;user-select:none;-webkit-user-select:none;font:11px/1.3 system-ui,sans-serif;color:rgba(110,96,80,.75);background:rgba(250,247,242,.85);padding:1px 6px;border-radius:6px;white-space:pre;overflow:hidden;text-overflow:ellipsis");
      txt.className = "pc-build-label"; txt.setAttribute("aria-label", "App version");
      var btn = h("button", "min-height:32px;padding:4px 11px;border-radius:8px;border:1px solid #d9cfc2;background:rgba(255,253,249,.95);color:#6e5a44;font:600 12px system-ui,sans-serif;cursor:pointer;touch-action:manipulation;white-space:nowrap", "Check for updates");
      btn.type = "button"; btn.className = "pc-check-updates"; btn.onclick = openModal;
      el.appendChild(txt); el.appendChild(btn); document.body.appendChild(el); document.documentElement.classList.add("pc-has-build");
      if (!document.getElementById("pc-build-style")) { var st = document.createElement("style"); st.id = "pc-build-style"; st.textContent = ".pc-has-build .dashboard-shell::after{content:\"\";display:block;height:calc(44px + env(safe-area-inset-bottom,0px))}@media (pointer:coarse){.pc-check-updates{min-height:40px!important;font-size:13px!important}}"; document.head.appendChild(st); }
    }
    var t = label(); if (txt.textContent !== t) txt.textContent = t;
  }
  function start() {
    sync(); new MutationObserver(sync).observe(document.body, { childList: true, subtree: true });
    var d = window.printcaddyDesktop;
    if (d && d.info) d.info().then(function (i) { if (i && i.version) { desk = i.version; sync(); } }).catch(function () {});
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
