/* "Import from Tinkercad" for PrintCAD. Runs entirely in the browser.
 * - Tinkercad STL / OBJ (+MTL or the OBJ .zip) / SVG / 3MF exports go to PrintCAD's own importer (meshes; SVG becomes an editable sketch body).
 * - A .lyl made by the "Export to PrintCAD" bookmark (community Tinkercad importer, MIT) opens directly:
 *   keeps groups, hole/solid state, colours, visibility and Boolean operands (each part a mesh).
 * - A JSON capture from that bookmark is converted here with its MIT-licensed converter (browser-convert.js). */
(function () {
  "use strict";
  var BASE = "/tinkercad/";
  var ACCEPT = ".stl,.obj,.mtl,.zip,.svg,.3mf,.lyl,.json";
  function loadScript(src) {
    return new Promise(function (ok, bad) {
      if (document.querySelector('script[src="' + src + '"]')) return ok();
      var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = function () { bad(new Error("Could not load " + src)); };
      document.head.appendChild(s);
    });
  }
  function converter() {
    if (window.convertTinkercadToLayerling) return Promise.resolve(window.convertTinkercadToLayerling);
    return loadScript(BASE + "browser-assemblies.js").then(function () { return loadScript(BASE + "browser-convert.js"); })
      .then(function () { return window.convertTinkercadToLayerling; });
  }
  /** Turns any JSON capture into a .lyl File; other files pass through untouched. */
  function prepare(files, say) {
    return Promise.all(files.map(function (f) {
      if (!/\.json$/i.test(f.name)) return f;
      say("Converting " + f.name + "…");
      return f.text().then(function (txt) {
        var capture = JSON.parse(txt);
        if (!capture || !capture.shapes || !capture.meshes) throw new Error(f.name + " is not a Tinkercad capture (no shapes/meshes).");
        var name = f.name.replace(/\.json$/i, "");
        return converter().then(function (convert) {
          return convert(capture, name, { onProgress: function (m) { if (typeof m === "string") say(m); } });
        }).then(function (blob) { return new File([blob], name + ".lyl", { type: "application/zip" }); });
      });
    }));
  }
  function open(opts) {
    opts = opts || {};
    var importFiles = opts.importFiles || function (files) { return window.PrintCADApp && window.PrintCADApp.importFiles(files); };
    var d = document.createElement("div"); d.className = "pcs-dlg pct-dlg";
    d.innerHTML =
      '<div class="pcs-box" role="dialog" aria-label="Import from Tinkercad" style="max-width:560px">' +
      '<h3 style="margin:0 0 8px">Import from Tinkercad</h3>' +
      '<p style="margin:0 0 8px"><b>Best (keeps groups, holes and colours):</b> use the free <a href="' + BASE + '" target="_blank" rel="noopener">Export to PrintCAD bookmark</a> ' +
      'in Tinkercad&rsquo;s editor, then pick the downloaded <code>.lyl</code> (or a <code>.json</code> capture) here.</p>' +
      '<p style="margin:0 0 8px"><b>Quick:</b> in Tinkercad choose <i>Export</i> &rarr; <code>.STL</code>, <code>.OBJ</code> (pick the .zip to keep colours) or <code>.SVG</code>, and pick that file here.</p>' +
      '<p style="margin:0 0 10px;color:#777;font-size:12px">STL/OBJ/3MF arrive as meshes you can move, scale, colour, group and cut with holes. SVG arrives as an editable sketch body. ' +
      'Tinkercad&rsquo;s own shape settings (e.g. a cylinder&rsquo;s sides) and its undo/version history are not available in any export.</p>' +
      '<p><button type="button" class="pct-pick">Choose Tinkercad file(s)…</button> <button type="button" class="pct-close">Close</button></p>' +
      '<div class="pct-msg" role="status" style="min-height:1.2em"></div>' +
      '<input type="file" multiple hidden accept="' + ACCEPT + '"></div>';
    var input = d.querySelector("input"), msg = d.querySelector(".pct-msg");
    function say(t) { msg.textContent = t; }
    d.querySelector(".pct-pick").onclick = function () { input.click(); };
    d.querySelector(".pct-close").onclick = function () { d.remove(); };
    d.onclick = function (e) { if (e.target === d) d.remove(); };
    input.onchange = function () {
      var files = [].slice.call(input.files || []); input.value = "";
      if (!files.length) return;
      prepare(files, say).then(function (ready) {
        say("Importing…");
        return Promise.resolve(importFiles(ready));
      }).then(function () { d.remove(); }, function (e) { say("Import failed: " + (e && e.message || e)); });
    };
    document.body.appendChild(d);
    return d;
  }
  window.PrintCADTinkercad = { open: open, prepare: prepare };
})();
