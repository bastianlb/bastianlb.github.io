/* ============================================================
   Flow-field + Delaunay tessellation background
   ------------------------------------------------------------
   A dependency-free canvas animation. Points drift along a
   smooth trigonometric vector field and are wired together by a
   live Delaunay triangulation — a moving simplicial complex.

   While the page is idle, a global "order" anneals upward: points
   push apart from their Delaunay neighbours toward an even local
   spacing — no fixed grid, and the target spacing varies with local
   density so triangle sizes stay heterogeneous — and the mesh settles
   into a clean, organic tessellation. Scrolling shatters it: points
   are kicked apart, harder the faster you scroll, and the order
   resets; then they drift and it re-anneals.

   Theme-aware (reads the site's CSS custom properties), DPR-
   aware, pauses on a hidden tab, single static frame for
   prefers-reduced-motion. Tunables live in CONFIG below.
   ============================================================ */
(function () {
  'use strict';

  var canvas = document.getElementById('bg-field');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  // ---- tunables -------------------------------------------------
  var CONFIG = {
    density:     6500,    // ~1 point per this many CSS px² (smaller = finer mesh)
    minCount:    40,
    maxCount:    220,
    speed:       0.35,    // base drift speed (CSS px per 60fps frame)
    fieldScale:  0.0016,  // spatial frequency of the flow field
    timeScale:   0.0011,  // how fast the field morphs (per 60fps frame)
    scrollPhase: 0.0012,  // how much page scroll gently rotates the flow field

    // ---- variable triangle size (breaks up homogeneity) ----
    coarseScale: 0.004,   // scale of the size-variation field (smaller = larger size-zones)
    speedLo:     0.55,    // drift speed where the field is low  → points dwell → denser → smaller triangles
    speedHi:     1.6,     // drift speed where the field is high → sparser → larger triangles
    latLo:       0.75,    // matching lattice spacing (× base) in the dense/fine zones
    latHi:       1.3,     // matching lattice spacing (× base) in the sparse/coarse zones

    // ---- idle anneal  ⇄  scroll shatter ----
    regionScale: 0.0034,  // spatial variation of the visual tessellation emphasis
    maxTess:     0.6,     // ceiling on the visual tessellation emphasis
    relax:       0.14,    // how firmly idle points push apart toward even spacing
    relaxCap:    1.5,     // max relaxation nudge per frame (CSS px)
    orderGrow:   0.0022,  // how fast "order" builds while idle (~7.5s, 0→full)
    orderBreak:  0.5,     // how hard scrolling tears the tessellation back down
    shatter:     3.5,     // outward kick strength on scroll (× scroll speed)
    shatterJitter: 0.7,   // randomness in shatter directions (shards, not a clean burst)
    damping:     0.86,    // how quickly the shatter velocity bleeds off
    maxVel:      7,       // cap on shatter velocity (CSS px per frame)

    // ---- mesh / draw ----
    edgeMax:     2.2,     // longest edge to draw, in *local* lattice units
    dotRadius:   1.4,
    dotAlpha:    0.5,
    edgeAlpha:   0.16,
    fillAlpha:   0.03,    // barely-there tint inside tessellated triangles
    fadeFrames:  46,      // spawn fade-in / pre-death fade-out length
    lifeMin:     720,     // particle lifespan range, in 60fps frames
    lifeMax:     1500
  };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var darkScheme   = window.matchMedia('(prefers-color-scheme: dark)');

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0;
  var particles = [];
  var color = { dot: '#62a8ef', link: '#8a8a8a' };

  // triangular lattice (spacing chosen so its density ≈ point density)
  var L = Math.sqrt(2 * CONFIG.density / Math.sqrt(3));
  var ROW = L * Math.sqrt(3) / 2;

  // scroll state
  var lastScrollY = window.pageYOffset || 0;
  var scrollEnergy = 0;   // unsigned, decays — recent scroll speed; drives the shatter

  // animation state
  var fieldT = 0;         // accumulated field time (only advances while running)
  var curT = 0;           // field phase used this frame (fieldT + scroll)
  var order = 0.2;        // tessellation "order": builds while idle, shattered by scroll
  var lastTime = null;
  var rafId = 0;
  var running = false;

  function rand(min, max) { return min + Math.random() * (max - min); }

  // Pull live colors from the stylesheet so we track the active theme.
  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    var dot    = cs.getPropertyValue('--bg-field-dot').trim();   // dedicated dot color…
    var accent = cs.getPropertyValue('--accent').trim();         // …falling back to the accent
    var faint  = cs.getPropertyValue('--faint').trim();
    if (dot)         color.dot = dot;
    else if (accent) color.dot = accent;
    if (faint)       color.link = faint;
  }

  function targetCount() {
    var n = Math.round((W * H) / CONFIG.density);
    return Math.max(CONFIG.minCount, Math.min(CONFIG.maxCount, n));
  }

  function spawn(p) {
    p = p || {};
    p.x = Math.random() * W;
    p.y = Math.random() * H;
    p.age = Math.random() * CONFIG.lifeMin;   // stagger so they don't blink in unison
    p.life = rand(CONFIG.lifeMin, CONFIG.lifeMax);
    p.tess = 0;
    p.vx = 0;                                 // decaying shatter velocity
    p.vy = 0;
    p.dx = 0;                                 // per-frame relaxation nudge
    p.dy = 0;
    p.ls = L;                                 // cached local spacing (set each frame)
    return p;
  }

  // Grow/shrink toward the target without wiping existing particles
  // (resize fires constantly on mobile as the URL bar moves).
  function syncCount() {
    var want = targetCount();
    while (particles.length < want) particles.push(spawn());
    if (particles.length > want) particles.length = want;
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    syncCount();
    if (!running) drawOnce();   // keep the static frame fresh when paused
  }

  // ---- fields ---------------------------------------------------
  // Flow direction at (x, y) for the current phase.
  function fieldAngle(x, y) {
    var s = CONFIG.fieldScale;
    return (
      Math.sin(x * s + curT) +
      Math.cos(y * s * 1.3 - curT * 0.85) +
      Math.sin((x + y) * s * 0.7 + curT * 1.1)
    ) * 1.4;
  }

  // Smooth, drifting [0,1] field: how strongly this spot wants to tessellate.
  function regionAt(x, y) {
    var s = CONFIG.regionScale;
    var v = Math.sin(x * s + curT * 0.6) +
            Math.cos(y * s * 1.1 - curT * 0.5) +
            Math.sin((x - y) * s * 0.6 + curT * 0.4);
    return (v + 3) / 6;
  }

  // Slow, smooth [0,1] field that sets *local* density / triangle size:
  // points drift slower where it's low (so they bunch up → smaller
  // triangles) and faster where it's high (sparser → larger triangles).
  function coarseAt(x, y) {
    var s = CONFIG.coarseScale;
    var v = Math.sin(x * s + curT * 0.3) +
            Math.cos(y * s * 0.9 + curT * 0.25) +
            Math.sin((x + y) * s * 0.5 - curT * 0.2);
    return (v + 3) / 6;
  }

  // Local lattice spacing, matched to local density so tessellated patches
  // inherit the same variable triangle size as the free-flowing mesh.
  function localSpacing(x, y) {
    return L * (CONFIG.latLo + (CONFIG.latHi - CONFIG.latLo) * coarseAt(x, y));
  }

  // How tessellated a spot is right now: the global `order` (built up
  // while idle, torn down by scrolling) scaled by maxTess and modulated
  // spatially by the region field. order=0 → free flow; order=1 → as
  // tessellated as it gets (still loose, capped at maxTess).
  function tessAt(x, y) {
    return order * CONFIG.maxTess * (0.5 + 0.5 * regionAt(x, y));
  }

  // Soft repulsion along a Delaunay edge: if two neighbours sit closer than
  // the local target spacing, nudge them apart. Grid-free — the mesh just
  // relaxes toward an even (but irregular) spacing wherever the points are,
  // so triangles never bridge across empty space.
  function relaxEdge(ia, ib, stiff) {
    var a = particles[ia], b = particles[ib];
    var dx = b.x - a.x, dy = b.y - a.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.001) return;
    var r = 0.5 * (localSpacing(a.x, a.y) + localSpacing(b.x, b.y));
    if (len >= r) return;                 // push apart only, never pull together
    var push = (r - len) * stiff * 0.5;   // px each, toward even spacing
    var ux = dx / len, uy = dy / len;
    a.dx -= ux * push; a.dy -= uy * push;
    b.dx += ux * push; b.dy += uy * push;
  }

  function fade(p) {
    if (p.age < CONFIG.fadeFrames) return p.age / CONFIG.fadeFrames;
    var left = p.life - p.age;
    if (left < CONFIG.fadeFrames) return left > 0 ? left / CONFIG.fadeFrames : 0;
    return 1;
  }

  function update(dt, tris) {
    // Global order: anneals upward while idle, torn down by scroll speed.
    order += (CONFIG.orderGrow - scrollEnergy * CONFIG.orderBreak) * dt;
    if (order > 1) order = 1; else if (order < 0) order = 0;

    // Relaxation: while ordered, points push apart from their Delaunay
    // neighbours toward an even local spacing — no lattice, no grid.
    for (var r0 = 0; r0 < particles.length; r0++) { particles[r0].dx = 0; particles[r0].dy = 0; }
    var stiff = CONFIG.relax * order;
    if (stiff > 0.0001 && tris) {
      for (var t = 0; t < tris.length; t++) {
        var T = tris[t];
        relaxEdge(T[0], T[1], stiff);
        relaxEdge(T[1], T[2], stiff);
        relaxEdge(T[2], T[0], stiff);
      }
    }

    var damp = Math.pow(CONFIG.damping, dt);
    var kicking = scrollEnergy > 0.001;
    var cap = CONFIG.maxVel;
    var rcap = CONFIG.relaxCap;

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.tess = tessAt(p.x, p.y);

      var f = coarseAt(p.x, p.y);
      p.ls = L * (CONFIG.latLo + (CONFIG.latHi - CONFIG.latLo) * f);   // cache local spacing for render
      var sp = CONFIG.speed * (CONFIG.speedLo + (CONFIG.speedHi - CONFIG.speedLo) * f);
      var a = fieldAngle(p.x, p.y);

      // clamp the accumulated relaxation nudge, then add it to the flow drift
      var rx = p.dx, ry = p.dy;
      if (rx > rcap) rx = rcap; else if (rx < -rcap) rx = -rcap;
      if (ry > rcap) ry = rcap; else if (ry < -rcap) ry = -rcap;
      var mx = Math.cos(a) * sp + rx;
      var my = Math.sin(a) * sp + ry;

      // Shatter: scrolling blows points apart — along the way their neighbours
      // are pushing them (else along the flow), plus jitter, harder the faster
      // you scroll.
      if (kicking) {
        var kick = scrollEnergy * CONFIG.shatter * (0.25 + p.tess);
        var dirx, diry;
        var dl = Math.sqrt(p.dx * p.dx + p.dy * p.dy);
        if (dl > 0.01) { dirx = p.dx / dl; diry = p.dy / dl; }
        else { dirx = Math.cos(a); diry = Math.sin(a); }
        var j = CONFIG.shatterJitter;
        p.vx += (dirx + (Math.random() * 2 - 1) * j) * kick;
        p.vy += (diry + (Math.random() * 2 - 1) * j) * kick;
      }

      // decaying shatter velocity (clamped)
      p.vx *= damp; p.vy *= damp;
      if (p.vx > cap) p.vx = cap; else if (p.vx < -cap) p.vx = -cap;
      if (p.vy > cap) p.vy = cap; else if (p.vy < -cap) p.vy = -cap;

      p.x += (mx + p.vx) * dt;
      p.y += (my + p.vy) * dt;

      // settled points hold still, so age them slowly
      p.age += dt * (1 - 0.92 * p.tess);
      if (p.age >= p.life ||
          p.x < -24 || p.x > W + 24 ||
          p.y < -24 || p.y > H + 24) {
        spawn(p);
      }
    }
  }

  // ---- Delaunay (Bowyer-Watson, self-contained) ----------------
  // Returns triangles as [i, j, k] indices into `pts`. Points are in
  // general position (always slightly off-lattice), so the usual
  // floating-point degeneracies are transient and self-correcting.
  function inCircle(p, a, b, c) {
    var ax = a.x - p.x, ay = a.y - p.y;
    var bx = b.x - p.x, by = b.y - p.y;
    var cx = c.x - p.x, cy = c.y - p.y;
    var det = (ax * ax + ay * ay) * (bx * cy - by * cx)
            - (bx * bx + by * by) * (ax * cy - ay * cx)
            + (cx * cx + cy * cy) * (ax * by - ay * bx);
    var ori = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    return det * ori > 0;   // orientation-independent "p inside circumcircle"
  }

  function sameEdge(e, f) {
    return (e[0] === f[0] && e[1] === f[1]) || (e[0] === f[1] && e[1] === f[0]);
  }

  function triangulate(pts) {
    var n = pts.length;
    if (n < 3) return [];
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (var i = 0; i < n; i++) {
      var q = pts[i];
      if (q.x < minx) minx = q.x;
      if (q.y < miny) miny = q.y;
      if (q.x > maxx) maxx = q.x;
      if (q.y > maxy) maxy = q.y;
    }
    var dmax = Math.max(maxx - minx, maxy - miny) || 1;
    var mx = (minx + maxx) / 2, my = (miny + maxy) / 2;
    var s0 = { x: mx - 20 * dmax, y: my - dmax };
    var s1 = { x: mx,            y: my + 20 * dmax };
    var s2 = { x: mx + 20 * dmax, y: my - dmax };
    function V(idx) {
      return idx < n ? pts[idx] : (idx === n ? s0 : (idx === n + 1 ? s1 : s2));
    }

    var tris = [[n, n + 1, n + 2]];
    for (var p = 0; p < n; p++) {
      var pt = pts[p];
      var edges = [];
      for (var t = tris.length - 1; t >= 0; t--) {
        var tr = tris[t];
        if (inCircle(pt, V(tr[0]), V(tr[1]), V(tr[2]))) {
          edges.push([tr[0], tr[1]], [tr[1], tr[2]], [tr[2], tr[0]]);
          tris.splice(t, 1);
        }
      }
      // edges shared by two removed triangles are interior → drop both
      for (var e1 = 0; e1 < edges.length; e1++) {
        if (!edges[e1]) continue;
        for (var e2 = e1 + 1; e2 < edges.length; e2++) {
          if (edges[e2] && sameEdge(edges[e1], edges[e2])) {
            edges[e1] = null;
            edges[e2] = null;
            break;
          }
        }
      }
      for (var e = 0; e < edges.length; e++) {
        if (edges[e]) tris.push([edges[e][0], edges[e][1], p]);
      }
    }

    var out = [];
    for (var k = 0; k < tris.length; k++) {
      var c = tris[k];
      if (c[0] < n && c[1] < n && c[2] < n) out.push(c);
    }
    return out;
  }

  // ---- render ---------------------------------------------------
  function render(tris) {
    ctx.clearRect(0, 0, W, H);

    // faint tint inside well-formed tessellated triangles
    ctx.fillStyle = color.dot;
    for (var f = 0; f < tris.length; f++) {
      var tr = tris[f];
      var a = particles[tr[0]], b = particles[tr[1]], c = particles[tr[2]];
      var avg = (a.tess + b.tess + c.tess) / 3;
      if (avg < 0.12) continue;
      var fAllow = CONFIG.edgeMax * Math.min(a.ls, b.ls, c.ls);   // cull by the finest vertex
      var fAllow2 = fAllow * fAllow;
      if (long2(a, b) > fAllow2 || long2(b, c) > fAllow2 || long2(c, a) > fAllow2) continue;
      ctx.globalAlpha = CONFIG.fillAlpha * avg * fade(a);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.closePath();
      ctx.fill();
    }

    // Delaunay edges (deduped), faded by length so hull slivers vanish
    ctx.strokeStyle = color.link;
    ctx.lineWidth = 1;
    var seen = {};
    for (var i = 0; i < tris.length; i++) {
      var T = tris[i];
      drawEdge(T[0], T[1], seen);
      drawEdge(T[1], T[2], seen);
      drawEdge(T[2], T[0], seen);
    }

    // points
    ctx.fillStyle = color.dot;
    for (var d = 0; d < particles.length; d++) {
      var pp = particles[d];
      ctx.globalAlpha = CONFIG.dotAlpha * (0.7 + 0.3 * pp.tess) * fade(pp);
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, CONFIG.dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function long2(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  function drawEdge(ia, ib, seen) {
    var key = ia < ib ? ia + '_' + ib : ib + '_' + ia;
    if (seen[key]) return;
    seen[key] = 1;
    var a = particles[ia], b = particles[ib];
    var len = Math.sqrt(long2(a, b));
    var allow = CONFIG.edgeMax * (a.ls < b.ls ? a.ls : b.ls);   // cull by the finer endpoint
    if (len > allow) return;
    var lenFactor = 1 - len / allow;                // shorter = stronger
    var te = (a.tess + b.tess) / 2;
    ctx.globalAlpha = CONFIG.edgeAlpha * lenFactor * (0.55 + 0.45 * te) * fade(a) * fade(b);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // A single static frame (reduced-motion visitors, or while paused).
  // Show a partly-annealed state so the mesh reads as intentional.
  function drawOnce() {
    curT = fieldT;
    var saved = order;
    if (order < 0.6) order = 0.6;
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.tess = tessAt(p.x, p.y);
      p.ls = localSpacing(p.x, p.y);
    }
    render(triangulate(particles));
    order = saved;
  }

  function frame(now) {
    if (!running) return;
    if (lastTime === null) lastTime = now;
    var dt = Math.min(2.5, (now - lastTime) / 16.6667);
    lastTime = now;

    // recent-scroll energy bleeds off so the field can re-anneal
    scrollEnergy *= 0.92;
    if (scrollEnergy < 0.001) scrollEnergy = 0;

    fieldT += CONFIG.timeScale * dt;
    curT = fieldT + (window.pageYOffset || 0) * CONFIG.scrollPhase;

    // one triangulation per frame, shared by relaxation (update) and drawing
    var tris = triangulate(particles);
    update(dt, tris);
    render(tris);
    rafId = window.requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduceMotion.matches) return;
    running = true;
    lastTime = null;             // avoid a dt spike after a pause
    rafId = window.requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // ---- events ---------------------------------------------------
  window.addEventListener('scroll', function () {
    var y = window.pageYOffset || 0;
    scrollEnergy = Math.min(1.3, scrollEnergy + Math.abs(y - lastScrollY) * 0.01);
    lastScrollY = y;
  }, { passive: true });

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resize, 150);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else start();
  });

  function onSchemeChange() { readColors(); if (!running) drawOnce(); }
  if (darkScheme.addEventListener) darkScheme.addEventListener('change', onSchemeChange);
  else if (darkScheme.addListener) darkScheme.addListener(onSchemeChange);

  function onMotionChange() {
    if (reduceMotion.matches) { stop(); drawOnce(); }
    else start();
  }
  if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', onMotionChange);
  else if (reduceMotion.addListener) reduceMotion.addListener(onMotionChange);

  // ---- go -------------------------------------------------------
  readColors();
  resize();
  canvas.classList.add('is-ready');   // CSS fades the canvas in
  if (reduceMotion.matches) drawOnce();
  else start();
})();
