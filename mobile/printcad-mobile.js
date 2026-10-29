/* PrintCAD phone layout behaviour: page indicators, arrows, the two-row Modify page and camera framing. */
(function () {
  var root = document.documentElement;
  if (!root.classList.contains("printcad-phone")) return;
  var bar = null, prev, next, dots, secs = [], active = -1, raf = 0;
  function ui() {
    if (prev) return;
    prev = el("button", "pcm-ind pcm-arrow pcm-prev", "‹"); next = el("button", "pcm-ind pcm-arrow pcm-next", "›");
    dots = el("div", "pcm-ind pcm-dots", "");
    prev.setAttribute("aria-label", "Previous tools"); next.setAttribute("aria-label", "Next tools");
    prev.onclick = function () { go(active - 1); }; next.onclick = function () { go(active + 1); };
  }
  function el(t, c, txt) { var e = document.createElement(t); e.className = c; e.textContent = txt; if (t === "button") e.type = "button"; document.body.appendChild(e); return e; }
  function sections() { return bar ? [].slice.call(bar.querySelectorAll(".toolbar-section")).filter(function (s) { return s.offsetParent !== null; }) : []; }
  function go(i) { secs = sections(); if (!secs.length) return; i = Math.max(0, Math.min(secs.length - 1, i));
    bar.scrollTo({ left: secs[i].offsetLeft - parseFloat(getComputedStyle(bar).paddingLeft || 0), behavior: "smooth" }); }
  function modifyWidth() {
    var m = bar && bar.querySelector('.toolbar-section[data-group="modify"] .toolbar-section-tools'); if (!m || m.dataset.pcm) return;
    var kids = [].slice.call(m.children); if (kids.length < 2) return;
    var w = 0; kids.forEach(function (k) { w += k.getBoundingClientRect().width; });
    m.dataset.w = Math.ceil(w / 2 + 40) + "px"; m.style.width = m.dataset.w; m.dataset.pcm = "1";
  }
  function update() {
    raf = 0; if (!bar) return;
    secs = sections(); var x = bar.scrollLeft + parseFloat(getComputedStyle(bar).paddingLeft || 0) + 4, i = 0;
    secs.forEach(function (s, k) { if (s.offsetLeft <= x) i = k; });
    if (bar.scrollLeft + bar.clientWidth >= bar.scrollWidth - 2) { // at the end: the last fully visible section
      i = secs.length - 1; while (i > 0 && secs[i].offsetLeft > bar.scrollLeft + 20 && secs[i - 1].offsetLeft >= bar.scrollLeft) i--; i = Math.max(i, 0);
      i = secs.length - 1;
    }
    var tall = !!(secs[i] && secs[i].dataset.group === "modify");
    // Modify needs two rows while any part of it is on screen.
    var mt = bar.querySelector('.toolbar-section[data-group="modify"] .toolbar-section-tools');
    if (mt) { var wide = bar.clientWidth >= 600; mt.style.width = wide ? "" : (mt.dataset.w || ""); if (wide) tall = false; }
    root.classList.toggle("pcm-tall", tall);
    if (i !== active || dots.childElementCount !== secs.length) {
      active = i; dots.innerHTML = secs.map(function (_, k) { return "<i" + (k === i ? ' class="on"' : "") + "></i>"; }).join("");
    }
    prev.disabled = bar.scrollLeft <= 2; next.disabled = bar.scrollLeft + bar.clientWidth >= bar.scrollWidth - 2;
  }
  function sched() { if (!raf) raf = requestAnimationFrame(update); }
  var framed = new WeakSet();
  function frame() { // show the whole plate between the bars once the slim layout is in place
    var stage = document.querySelector(".workplane-stage"); if (!stage || framed.has(stage)) return; framed.add(stage);
    setTimeout(function () {
      window.dispatchEvent(new Event("resize"));
      var home = document.querySelector('.camera-controls button[aria-label*="home" i], .camera-controls button[title*="home" i]');
      if (home) home.click();
      // a narrow portrait view crops the plate's sides; step back until all of it fits
      var out = document.querySelector('.camera-controls button[aria-label="Zoom out"]');
      if (out && innerHeight > innerWidth) for (var k = 0; k < 5; k++) setTimeout(function () { out.click(); }, 300 + k * 150);
    }, 600);
  }
  function attach() {
    var b = document.querySelector(".secondary-toolbar .toolbar-mode-content");
    if (b !== bar) { if (bar) bar.removeEventListener("scroll", sched); bar = b; active = -1; if (bar) { ui(); bar.addEventListener("scroll", sched, { passive: true }); modifyWidth(); } }
    if (bar) { modifyWidth(); frame(); sched(); } else root.classList.remove("pcm-tall");
  }
  new MutationObserver(function () { attach(); }).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener("resize", sched);
  attach();
  window.PrintCADMobile = { go: function (i) { go(i); }, state: function () { return { active: active, count: sections().length, tall: root.classList.contains("pcm-tall") }; } };
})();
