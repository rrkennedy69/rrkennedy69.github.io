/* PrintCAD <-> Google Drive glue. Listens to the app's "printcad:design-saved" event
 * (fired after every local save of a design, i.e. after every edit) and mirrors the
 * .lyl bytes to the Drive appDataFolder via PrintCADSync. Also draws the sign-in /
 * backup / restore widget. The app exposes window.PrintCADApp (listDesigns,
 * designBytes, restoreDesigns) from the start page component. */
(function () {
  "use strict";
  var S = window.PrintCADSync;
  var cfg = window.PRINTCAD_CONFIG || {};
  if (!S) { console.warn("PrintCAD: Drive sync module missing"); return; }
  var MAP = "printcad.drive.names"; // projectId -> Drive file name last used
  var restoring = false;
  function safe(n) { return String(n || "Untitled").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 80).trim() || "Untitled"; }
  function fileName(id, name) { return safe(name) + "__" + id + ".lyl"; }
  function parseName(f) { var m = /^(.*)__([^_].*)\.lyl$/.exec(f); return m ? { name: m[1], id: m[2] } : { name: f.replace(/\.lyl$/, ""), id: null }; }
  function names() { try { return JSON.parse(localStorage.getItem(MAP) || "{}"); } catch (e) { return {}; } }
  function setName(id, f) { var m = names(); m[id] = f; try { localStorage.setItem(MAP, JSON.stringify(m)); } catch (e) {} }

  /* After a rename, delete the Drive copy stored under the old name once the new one is up. */
  function dropOld(oldName) {
    S.list().then(function (files) {
      var oldPng = oldName.replace(/\.lyl$/, ".png");
      files.forEach(function (f) { if (f.name === oldName || f.name === oldPng) S.remove(f.id).catch(function () {}); });
    }).catch(function () {});
  }

  function queue(id, name, bytes) {
    var f = fileName(id, name), old = names()[id];
    S.save(f, bytes);
    setName(id, f);
    // The card picture goes along as "<same name>.png", so the Drive list can show previews.
    var a = app();
    if (a && a.designThumbnail) a.designThumbnail(id).then(function (url) {
      var png = dataUrlBytes(url); if (png) S.save(f.replace(/\.lyl$/, ".png"), png);
    }).catch(function () {});
    if (old && old !== f) S.saveNow().then(function () { dropOld(old); }, function () {});
  }

  window.addEventListener("printcad:design-saved", function (e) {
    var d = e.detail || {};
    if (restoring || !d.projectId || !d.bytes) return;
    if (!S.isSignedIn()) return; // nothing queued while signed out; "Back up all" catches up
    queue(d.projectId, d.name, d.bytes);
  });

  function dataUrlBytes(url) {
    if (!url || url.indexOf("data:image/png;base64,") !== 0) return null;
    var bin = atob(url.slice(22)), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function app() { return window.PrintCADApp; }

  function backupAll() {
    var a = app(); if (!a) return Promise.reject(new Error("Open the start page first"));
    var list = a.listDesigns();
    return list.reduce(function (p, d) {
      return p.then(function () { return a.designBytes(d.id).then(function (b) { if (b) queue(d.id, d.name, b); }); });
    }, Promise.resolve()).then(function () { return S.saveNow(); }).then(function () { return list.length; });
  }

  function restore(files, pngs) {
    var a = app(); if (!a) return Promise.reject(new Error("Open the start page first"));
    pngs = pngs || {};
    return Promise.all(files.map(function (f) {
      var base = parseName(f.name).name + " (" + (parseName(f.name).id || f.id).slice(-6) + ")";
      var png = pngs[f.name.replace(/\.lyl$/, ".png")];
      return Promise.all([S.load(f.id, "arraybuffer"), png ? S.load(png.id, "arraybuffer").catch(function () { return null; }) : null])
        .then(function (r) {
          var out = [{ name: base + ".lyl", bytes: new Uint8Array(r[0]) }];
          if (r[1]) out.push({ name: base + ".png", bytes: new Uint8Array(r[1]) });
          return out;
        });
    })).then(function (lists) { return [].concat.apply([], lists); }).then(function (entries) {
      restoring = true;
      return Promise.resolve(a.restoreDesigns(entries)).finally(function () { setTimeout(function () { restoring = false; }, 3000); });
    });
  }

  /* ---------- UI ---------- */
  var el = {}, statusText = {
    "signed-out": "Not signed in", connecting: "Connecting…", "signed-in": "Google Drive on",
    pending: "Changes waiting…", saving: "Saving to Drive…", saved: "Saved to Drive", error: "Drive error", offline: "Offline – will retry"
  };
  function btn(label, fn, cls) { var b = document.createElement("button"); b.type = "button"; b.textContent = label; b.onclick = fn; if (cls) b.className = cls; return b; }
  function render(st) {
    if (!el.w) return;
    el.w.className = "pcs-w pcd-w pcs-" + st;
    el.txt.textContent = statusText[st] || st;
    var on = S.isSignedIn();
    el.inB.style.display = on ? "none" : "";
    el.outB.style.display = el.allB.style.display = el.resB.style.display = on ? "" : "none";
    var startPage = document.body.dataset.printcadView ? document.body.dataset.printcadView === "start" : !document.querySelector("canvas");
    el.allB.disabled = el.resB.disabled = !app();
    el.w.dataset.page = startPage ? "start" : "editor";
  }
  function dialog(all) {
    var files = all.filter(function (x) { return /\.lyl$/.test(x.name); }), pngs = {};
    all.forEach(function (x) { if (/\.png$/.test(x.name)) pngs[x.name] = x; });
    var d = document.createElement("div"); d.className = "pcs-dlg";
    var box = document.createElement("div"); box.className = "pcs-box";
    box.innerHTML = "<h3 style='margin:0 0 8px'>Your designs on Google Drive</h3>";
    if (!files.length) box.appendChild(document.createTextNode("No designs on Drive yet."));
    var ul = document.createElement("ul"); ul.style.cssText = "list-style:none;padding:0;margin:0 0 10px";
    files.forEach(function (f) {
      var li = document.createElement("li"), lab = document.createElement("label"), cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = true; cb.value = f.id; lab.appendChild(cb);
      var png = pngs[f.name.replace(/\.lyl$/, ".png")];
      if (png) {
        var img = document.createElement("img"); img.alt = ""; img.className = "pcd-thumb";
        S.load(png.id, "blob").then(function (b) { img.src = URL.createObjectURL(b); }).catch(function () {});
        lab.appendChild(img);
      }
      lab.appendChild(document.createTextNode(" " + parseName(f.name).name));
      var meta = document.createElement("span"); meta.style.color = "#777";
      meta.textContent = new Date(f.modifiedTime).toLocaleString() + " · " + Math.max(1, Math.round(f.size / 1024)) + " KB";
      li.appendChild(lab); li.appendChild(meta); ul.appendChild(li);
    });
    box.appendChild(ul);
    var msg = document.createElement("div"); msg.style.margin = "6px 0";
    var go = btn("Restore selected", function () {
      var ids = [].slice.call(ul.querySelectorAll("input:checked")).map(function (c) { return c.value; });
      var pick = files.filter(function (f) { return ids.indexOf(f.id) >= 0; });
      if (!pick.length) return;
      go.disabled = true; msg.textContent = "Downloading " + pick.length + "…";
      restore(pick, pngs).then(function () { d.remove(); }, function (e) { go.disabled = false; msg.textContent = "Failed: " + (e && e.message || e); });
    });
    box.appendChild(msg); box.appendChild(go); box.appendChild(document.createTextNode(" "));
    box.appendChild(btn("Close", function () { d.remove(); }));
    d.appendChild(box); d.onclick = function (e) { if (e.target === d) d.remove(); };
    document.body.appendChild(d);
  }
  function mount() {
    if (el.w) return;
    var w = el.w = document.createElement("div");
    w.setAttribute("role", "region"); w.setAttribute("aria-label", "Google Drive backup");
    var dot = document.createElement("span"); dot.className = "pcs-dot";
    el.txt = document.createElement("span"); el.txt.className = "pcd-txt";
    el.inB = btn("Sign in with Google", function () { S.signIn().catch(function (e) { console.warn("PrintCAD sign-in:", e); }); }, "pcd-signin");
    el.allB = btn("Back up all", function () {
      el.allB.disabled = true;
      backupAll().then(function (n) { el.txt.textContent = "Backed up " + n + " designs"; }, function (e) { el.txt.textContent = "Backup failed: " + (e && e.message || e); })
        .finally(function () { el.allB.disabled = false; });
    }, "pcd-all");
    el.resB = btn("Drive designs…", function () { S.list().then(function (f) { dialog(f); }, function (e) { el.txt.textContent = "List failed: " + (e && e.message || e); }); }, "pcd-restore");
    el.outB = btn("Sign out", function () { S.signOut(); }, "pcd-signout");
    [dot, el.txt, el.inB, el.allB, el.resB, el.outB].forEach(function (n) { w.appendChild(n); });
    document.body.appendChild(w);
    render("signed-out");
  }
  S.onStatus(function (st) { render(st); });
  window.addEventListener("printcad:app-ready", function () { render(S.isSignedIn() ? "signed-in" : "signed-out"); });

  function start() {
    mount();
    if (!cfg.googleClientId) { el.txt.textContent = "Drive sync not configured"; el.inB.disabled = true; return; }
    S.init({ clientId: cfg.googleClientId, appName: "PrintCAD", debounceMs: 2000 }).catch(function () {});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.PrintCADDrive = { backupAll: backupAll, restore: restore, fileName: fileName };
})();
