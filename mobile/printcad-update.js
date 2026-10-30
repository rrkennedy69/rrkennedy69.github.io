/* PrintCaddy updates: notice a newer published build and switch to it without clearing site data.
   Start page: reloads straight away. Editor: reloads when the tab comes back, or right away via the "Reload" button. */
(function () {
  var BUILD = "202610300117-b122f6ef", busy = false, pending = false;
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
