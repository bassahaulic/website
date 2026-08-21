/* Night Sky — pocket planetarium PWA.
 * Renders the local sky on a full-screen canvas with a stereographic projection.
 * Modes: drag/pinch exploration, or device-orientation "point at sky".
 */
(function () {
  'use strict';

  const A = window.Astro;
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;

  // ---------------- state ----------------

  const state = {
    lat: null, lon: null, locLabel: '',
    timeOffsetMs: 0,          // effective time = real now + offset
    az0: 180, alt0: 25,       // view center (deg): start looking due south
    fov: 100,                 // vertical field of view, deg
    compass: false,
    night: false,
    target: null,             // {kind, ...} being guided to
    targetAnim: null,         // view fly-to animation
    showConLines: true,
    needsRender: true,
  };

  const persisted = ['lat', 'lon', 'locLabel', 'night'];
  try {
    const saved = JSON.parse(localStorage.getItem('nightsky') || '{}');
    for (const k of persisted) if (saved[k] !== undefined) state[k] = saved[k];
  } catch (e) { /* fresh start */ }
  function persist() {
    try {
      const out = {};
      for (const k of persisted) out[k] = state[k];
      localStorage.setItem('nightsky', JSON.stringify(out));
    } catch (e) { /* private mode */ }
  }

  function now() { return Date.now() + state.timeOffsetMs; }
  function hasLocation() { return state.lat !== null && state.lon !== null; }
  // fallback so the sky still renders before a location is chosen
  function lat() { return hasLocation() ? state.lat : 39.5; }
  function lon() { return hasLocation() ? state.lon : -98.35; }

  // ---------------- catalog preprocessing ----------------

  const N_STARS = STAR_DATA.length;
  const starVec = new Float32Array(N_STARS * 3); // J2000 unit vectors
  const starMag = new Float32Array(N_STARS);
  const starColor = new Array(N_STARS);

  function bvColor(bv) {
    const anchors = [
      [-0.4, 155, 180, 255], [0.0, 175, 197, 255], [0.3, 208, 216, 255],
      [0.6, 255, 249, 240], [0.9, 255, 230, 192], [1.3, 255, 204, 148],
      [1.8, 255, 176, 116], [2.5, 255, 150, 90],
    ];
    let lo = anchors[0], hi = anchors[anchors.length - 1];
    for (let i = 0; i < anchors.length - 1; i++) {
      if (bv >= anchors[i][0] && bv <= anchors[i + 1][0]) { lo = anchors[i]; hi = anchors[i + 1]; break; }
    }
    const t = Math.min(1, Math.max(0, (bv - lo[0]) / (hi[0] - lo[0] || 1)));
    const r = Math.round(lo[1] + t * (hi[1] - lo[1]));
    const g = Math.round(lo[2] + t * (hi[2] - lo[2]));
    const b = Math.round(lo[3] + t * (hi[3] - lo[3]));
    return `rgb(${r},${g},${b})`;
  }

  for (let i = 0; i < N_STARS; i++) {
    const s = STAR_DATA[i];
    const v = A.raDecToVec(s[0], s[1]);
    starVec[i * 3] = v[0]; starVec[i * 3 + 1] = v[1]; starVec[i * 3 + 2] = v[2];
    starMag[i] = s[2];
    starColor[i] = bvColor(s[3]);
  }

  // constellation line vertices as J2000 vectors
  const conSegs = []; // {vecs: Float32Array(n*3), n}
  const conLabels = []; // {vec, name, rank}
  for (const c of CON_DATA) {
    for (const seg of c.lines) {
      const arr = new Float32Array(seg.length * 3);
      for (let i = 0; i < seg.length; i++) {
        const v = A.raDecToVec(seg[i][0], seg[i][1]);
        arr[i * 3] = v[0]; arr[i * 3 + 1] = v[1]; arr[i * 3 + 2] = v[2];
      }
      conSegs.push(arr);
    }
    conLabels.push({ vec: A.raDecToVec(c.label[0], c.label[1]), name: c.name, rank: c.rank });
  }

  const dsoVecs = DSO_DATA.map((d) => A.raDecToVec(d[0], d[1]));

  // ---------------- canvas & projection ----------------

  const canvas = document.getElementById('sky');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    state.needsRender = true;
  }
  window.addEventListener('resize', resize);
  resize();

  // per-frame view data
  const view = {
    M2000: null, Mdate: null,      // equatorial → horizon (N,E,U) matrices
    F: null, Rv: null, Uv: null,   // view basis in horizon frame
    S: 1, cx: 0, cy: 0, cosMax: -1,
  };

  function horizonMatrix(lstDeg, latDeg) {
    const ct = Math.cos(lstDeg * D2R), st = Math.sin(lstDeg * D2R);
    const cp = Math.cos(latDeg * D2R), sp = Math.sin(latDeg * D2R);
    return [
      -sp * ct, -sp * st, cp,   // N
      -st, ct, 0,               // E
      cp * ct, cp * st, sp,     // U
    ];
  }

  function matMul(a, b) {
    const o = new Array(9);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    }
    return o;
  }

  function azAltVec(azDeg, altDeg) {
    const ca = Math.cos(altDeg * D2R);
    return [ca * Math.cos(azDeg * D2R), ca * Math.sin(azDeg * D2R), Math.sin(altDeg * D2R)];
  }

  function setupView(jd) {
    const lstDeg = A.lst(jd, lon());
    const T = A.centuries(jd);
    view.Mdate = horizonMatrix(lstDeg, lat());
    view.M2000 = matMul(view.Mdate, A.precessionMatrix(T));

    const alt0 = Math.min(89.3, Math.max(-85, state.alt0));
    const F = azAltVec(state.az0, alt0);
    // screen-up toward zenith
    let Uv = [-F[0] * F[2], -F[1] * F[2], 1 - F[2] * F[2]];
    let n = Math.hypot(Uv[0], Uv[1], Uv[2]);
    if (n < 1e-6) { Uv = [-Math.cos(state.az0 * D2R), -Math.sin(state.az0 * D2R), 0]; n = 1; }
    Uv = [Uv[0] / n, Uv[1] / n, Uv[2] / n];
    const Rv = [
      Uv[1] * F[2] - Uv[2] * F[1],
      Uv[2] * F[0] - Uv[0] * F[2],
      Uv[0] * F[1] - Uv[1] * F[0],
    ]; // right = Uv × F  (right-handed: x right, y up, looking along F)
    view.F = F; view.Rv = Rv; view.Uv = Uv;
    view.S = (H / 2) / (2 * Math.tan(state.fov * D2R / 4));
    view.cx = W / 2; view.cy = H / 2;
    const diagHalf = Math.atan2(Math.hypot(W, H) / 2, view.S) * 1.6;
    view.cosMax = Math.cos(Math.min(Math.PI * 0.98, diagHalf * 2 + 0.3));
  }

  // project a horizon-frame unit vector → screen {x, y, f, alt}
  function project(v) {
    const f = v[0] * view.F[0] + v[1] * view.F[1] + v[2] * view.F[2];
    if (f < view.cosMax) return null;
    const x = v[0] * view.Rv[0] + v[1] * view.Rv[1] + v[2] * view.Rv[2];
    const y = v[0] * view.Uv[0] + v[1] * view.Uv[1] + v[2] * view.Uv[2];
    const k = 2 * view.S / (1 + f);
    return { x: view.cx + k * x, y: view.cy - k * y, f, alt: Math.asin(Math.max(-1, Math.min(1, v[2]))) * R2D };
  }

  function transform(M, v0, v1, v2) {
    return [
      M[0] * v0 + M[1] * v1 + M[2] * v2,
      M[3] * v0 + M[4] * v1 + M[5] * v2,
      M[6] * v0 + M[7] * v1 + M[8] * v2,
    ];
  }

  // ---------------- ephemeris cache ----------------

  const eph = { t: -1e18, sun: null, moon: null, planets: [] };

  function updateEphemeris(force) {
    const t = now();
    if (!force && Math.abs(t - eph.t) < 30000) return;
    eph.t = t;
    const jde = A.jdeFromJd(A.jdFromMs(t));
    eph.sun = A.sunPosition(jde);
    eph.moon = A.moonPosition(jde);
    eph.planets = A.planetPositions(jde);
  }

  const PLANET_STYLE = {
    Mercury: '#c9b8a8', Venus: '#f8f2d8', Mars: '#ff8757', Jupiter: '#f3ddb4',
    Saturn: '#eeda9f', Uranus: '#a5e0e0', Neptune: '#7fa8ff',
  };

  // ---------------- rendering ----------------

  const drawn = []; // hit-test registry for this frame

  function magLimit() {
    // deeper limit as you zoom in
    const f = state.fov;
    let lim;
    if (f >= 120) lim = 4.8;
    else if (f >= 90) lim = 4.8 + (120 - f) / 30 * 0.5;      // →5.3
    else if (f >= 60) lim = 5.3 + (90 - f) / 30 * 0.6;       // →5.9
    else if (f >= 30) lim = 5.9 + (60 - f) / 30 * 0.6;       // →6.5
    else lim = 6.5;
    // daytime washes out stars
    const sAlt = drawnSunAlt;
    if (sAlt > 0) lim = Math.min(lim, -1.5);
    else if (sAlt > -6) lim = Math.min(lim, 0.5 + (-sAlt / 6) * 1.5);
    else if (sAlt > -12) lim = Math.min(lim, 2 + (-sAlt - 6) / 6 * 2.0);
    else if (sAlt > -18) lim = Math.min(lim, 4 + (-sAlt - 12) / 6 * 2.5);
    return lim;
  }

  function skyGradient(sunAlt) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    function mix(c1, c2, t) {
      return `rgb(${Math.round(c1[0] + (c2[0] - c1[0]) * t)},${Math.round(c1[1] + (c2[1] - c1[1]) * t)},${Math.round(c1[2] + (c2[2] - c1[2]) * t)})`;
    }
    const night = [[4, 7, 18], [2, 3, 10]];
    const astro = [[8, 12, 28], [4, 6, 16]];
    const naut = [[18, 30, 62], [10, 14, 34]];
    const civil = [[70, 110, 170], [150, 110, 80]];
    const day = [[110, 165, 225], [175, 210, 240]];
    let top, bot;
    if (sunAlt <= -18) { top = night[0]; bot = night[1]; }
    else if (sunAlt <= -12) { const t = (sunAlt + 18) / 6; top = lerp3(night[0], astro[0], t); bot = lerp3(night[1], astro[1], t); }
    else if (sunAlt <= -6) { const t = (sunAlt + 12) / 6; top = lerp3(astro[0], naut[0], t); bot = lerp3(astro[1], naut[1], t); }
    else if (sunAlt <= 0) { const t = (sunAlt + 6) / 6; top = lerp3(naut[0], civil[0], t); bot = lerp3(naut[1], civil[1], t); }
    else { const t = Math.min(1, sunAlt / 10); top = lerp3(civil[0], day[0], t); bot = lerp3(civil[1], day[1], t); }
    g.addColorStop(0, mix(top, top, 0));
    g.addColorStop(1, mix(bot, bot, 0));
    return g;
  }
  function lerp3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  const WINDS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  function windName(az) { return WINDS[Math.round(A.rev(az) / 22.5) % 16]; }

  let drawnSunAlt = -30;

  function render() {
    const t = now();
    const jd = A.jdFromMs(t);
    updateEphemeris(false);
    setupView(jd);
    drawn.length = 0;

    // sun altitude drives sky brightness
    const sunH = transform(view.Mdate, ...A.raDecToVec(eph.sun.ra, eph.sun.dec));
    drawnSunAlt = Math.asin(Math.max(-1, Math.min(1, sunH[2]))) * R2D;

    ctx.fillStyle = skyGradient(drawnSunAlt);
    ctx.fillRect(0, 0, W, H);

    const lim = magLimit();
    drawConstellations(lim);
    drawStars(lim);
    drawDSOs(lim);
    drawPlanets(lim);
    drawSunMoon();
    drawHorizon();
    drawTarget();
  }

  function dimFor(alt) { return alt < -0.6 ? 0.13 : 1; }

  function drawConstellations(lim) {
    if (!state.showConLines || lim < 2) return;
    ctx.lineWidth = 1;
    for (const seg of conSegs) {
      ctx.strokeStyle = 'rgba(90,130,200,0.34)';
      ctx.beginPath();
      let prev = null;
      for (let i = 0; i < seg.length / 3; i++) {
        const v = transform(view.M2000, seg[i * 3], seg[i * 3 + 1], seg[i * 3 + 2]);
        const p = project(v);
        if (p && p.alt < -0.6) { prev = null; continue; }  // don't draw underground
        if (p && prev) { ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); }
        prev = p;
      }
      ctx.stroke();
    }
    if (state.fov < 110) {
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      for (const cl of conLabels) {
        if (state.fov > 70 && cl.rank > 2) continue;
        const v = transform(view.M2000, cl.vec[0], cl.vec[1], cl.vec[2]);
        const p = project(v);
        if (!p || p.alt < 0) continue;
        ctx.fillStyle = 'rgba(120,150,210,0.5)';
        ctx.fillText(cl.name.toUpperCase(), p.x, p.y);
      }
    }
  }

  function drawStars(lim) {
    const scale = Math.max(0.75, Math.min(1.6, 110 / state.fov * 0.75));
    ctx.textAlign = 'left';
    const labelLim = state.fov > 90 ? 1.6 : state.fov > 55 ? 2.6 : state.fov > 30 ? 3.6 : 6;
    for (let i = 0; i < N_STARS; i++) {
      const mag = starMag[i];
      if (mag > lim) break; // sorted brightest-first
      const v = transform(view.M2000, starVec[i * 3], starVec[i * 3 + 1], starVec[i * 3 + 2]);
      const p = project(v);
      if (!p || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) continue;
      const dim = dimFor(p.alt);
      const r = Math.max(0.7, (lim - mag) * 0.55 + 0.5) * scale;
      const fade = Math.min(1, 0.5 + (lim - mag) * 0.4) * dim;
      ctx.globalAlpha = fade;
      ctx.fillStyle = starColor[i];
      if (r < 1.05) {
        ctx.fillRect(p.x - r * 0.7, p.y - r * 0.7, r * 1.4, r * 1.4);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, 6.2832);
        ctx.fill();
        if (mag < 0.8) { // subtle glow on the very brightest
          ctx.globalAlpha = 0.16 * dim;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 2.6, 0, 6.2832);
          ctx.fill();
          ctx.globalAlpha = fade;
        }
      }
      const s = STAR_DATA[i];
      if (s.length > 4 && p.alt > -0.6) {
        drawn.push({ x: p.x, y: p.y, kind: 'star', i, pri: s[4] ? 2 : 1 });
        if (s[4] && mag < labelLim) {
          ctx.globalAlpha = 0.75 * dim;
          ctx.fillStyle = '#aebad6';
          ctx.font = '10.5px sans-serif';
          ctx.fillText(s[4], p.x + r + 3, p.y + 3);
        }
      } else if (p.alt > -0.6 && mag < 4) {
        drawn.push({ x: p.x, y: p.y, kind: 'star', i, pri: 0 });
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawDSOs(lim) {
    if (state.fov > 75) return;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < DSO_DATA.length; i++) {
      const d = DSO_DATA[i];
      if (d[2] > lim + 1.5) continue;
      const v = transform(view.M2000, dsoVecs[i][0], dsoVecs[i][1], dsoVecs[i][2]);
      const p = project(v);
      if (!p || p.alt < -0.6) continue;
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = '#8fa8c8';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, 6.2832);
      ctx.stroke();
      ctx.setLineDash([]);
      if (state.fov < 45) {
        ctx.fillStyle = 'rgba(150,175,210,0.75)';
        ctx.fillText(d[3], p.x, p.y - 9);
      }
      ctx.globalAlpha = 1;
      drawn.push({ x: p.x, y: p.y, kind: 'dso', i, pri: 2 });
    }
  }

  function drawPlanets(lim) {
    ctx.textAlign = 'center';
    for (const pl of eph.planets) {
      if (pl.mag > Math.max(lim, 1.8) && (pl.name === 'Uranus' || pl.name === 'Neptune') && state.fov > 40) continue;
      const v = transform(view.Mdate, ...A.raDecToVec(pl.ra, pl.dec));
      const p = project(v);
      if (!p) continue;
      const dim = dimFor(p.alt);
      const r = Math.max(2.2, (5.6 - pl.mag) * 0.55) * Math.max(0.8, Math.min(1.5, 100 / state.fov * 0.8));
      ctx.globalAlpha = dim;
      ctx.fillStyle = PLANET_STYLE[pl.name];
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, 6.2832);
      ctx.fill();
      ctx.globalAlpha = 0.2 * dim;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 2, 0, 6.2832);
      ctx.fill();
      ctx.globalAlpha = 0.9 * dim;
      ctx.fillStyle = '#d8c9a8';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(pl.name, p.x, p.y - r - 6);
      ctx.globalAlpha = 1;
      if (p.alt > -0.6) drawn.push({ x: p.x, y: p.y, kind: 'planet', pl, pri: 3 });
    }
  }

  function drawSunMoon() {
    // Sun
    const sv = transform(view.Mdate, ...A.raDecToVec(eph.sun.ra, eph.sun.dec));
    const sp = project(sv);
    const sunR = Math.max(7, view.S * 2 * Math.tan(0.267 * D2R / 2) * 2);
    if (sp) {
      const dim = dimFor(sp.alt);
      const g = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, sunR * 4);
      g.addColorStop(0, `rgba(255,240,190,${0.95 * dim})`);
      g.addColorStop(0.25, `rgba(255,220,140,${0.5 * dim})`);
      g.addColorStop(1, 'rgba(255,210,120,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sp.x - sunR * 4, sp.y - sunR * 4, sunR * 8, sunR * 8);
      ctx.globalAlpha = dim;
      ctx.fillStyle = '#fff6d8';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sunR, 0, 6.2832);
      ctx.fill();
      ctx.globalAlpha = 0.9 * dim;
      ctx.fillStyle = '#e8d9a0';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Sun', sp.x, sp.y - sunR - 8);
      ctx.globalAlpha = 1;
      if (sp.alt > -0.6) drawn.push({ x: sp.x, y: sp.y, kind: 'sun', pri: 3 });
    }

    // Moon
    const mv = transform(view.Mdate, ...A.raDecToVec(eph.moon.ra, eph.moon.dec));
    const mp = project(mv);
    if (mp) {
      const dim = dimFor(mp.alt);
      const angR = Math.asin(1737.4 / eph.moon.dist); // radians
      const r = Math.max(9, view.S * 2 * Math.tan(angR / 2) * 2);
      // light direction on screen: from moon toward sun's projection
      let lightAng = 0;
      if (sp) lightAng = Math.atan2(sp.y - mp.y, sp.x - mp.x);
      else {
        const sunBehind = transform(view.Mdate, ...A.raDecToVec(eph.sun.ra, eph.sun.dec));
        const x = sunBehind[0] * view.Rv[0] + sunBehind[1] * view.Rv[1] + sunBehind[2] * view.Rv[2];
        const y = sunBehind[0] * view.Uv[0] + sunBehind[1] * view.Uv[1] + sunBehind[2] * view.Uv[2];
        lightAng = Math.atan2(-y, x);
      }
      ctx.save();
      ctx.translate(mp.x, mp.y);
      ctx.globalAlpha = dim;
      // glow
      const gg = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 2.4);
      gg.addColorStop(0, `rgba(215,225,255,${0.3 * dim * eph.moon.illum})`);
      gg.addColorStop(1, 'rgba(215,225,255,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(-r * 2.4, -r * 2.4, r * 4.8, r * 4.8);
      ctx.rotate(lightAng);
      // dark side, barely visible (earthshine)
      ctx.fillStyle = 'rgba(110,120,150,0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, 6.2832);
      ctx.fill();
      // lit portion: semicircle toward light + elliptical terminator
      const ph = eph.moon.phaseAngle; // 0 = full, 180 = new
      const term = r * Math.abs(Math.cos(ph * D2R));
      ctx.fillStyle = '#e8ecf5';
      ctx.beginPath();
      ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); // lit semicircle facing +x (toward sun)
      if (ph < 90) ctx.ellipse(0, 0, term, r, 0, Math.PI / 2, -Math.PI / 2, false); // gibbous: bulge away
      else ctx.ellipse(0, 0, term, r, 0, Math.PI / 2, -Math.PI / 2, true);          // crescent: cut in
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 0.9 * dim;
      ctx.fillStyle = '#c9d2e8';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Moon', mp.x, mp.y - r - 8);
      ctx.globalAlpha = 1;
      if (mp.alt > -0.6) drawn.push({ x: mp.x, y: mp.y, kind: 'moon', pri: 3 });
    }
  }

  function drawHorizon() {
    ctx.strokeStyle = 'rgba(120,190,140,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let prev = null;
    for (let az = 0; az <= 360; az += 2) {
      const p = project(azAltVec(az, 0));
      if (p && prev) { ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); }
      prev = p;
    }
    ctx.stroke();
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < 8; i++) {
      const az = i * 45;
      const p = project(azAltVec(az, 0));
      if (!p) continue;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(150,220,170,0.9)' : 'rgba(150,220,170,0.55)';
      ctx.fillText(WINDS[i * 2], p.x, p.y + 16);
    }
  }

  // target highlight & guidance arrow
  function drawTarget() {
    if (!state.target) return;
    const tv = targetVector(state.target);
    if (!tv) return;
    const p = project(tv);
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 300);
    if (p && p.x > 20 && p.x < W - 20 && p.y > 20 && p.y < H - 20) {
      ctx.strokeStyle = `rgba(140,190,255,${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 16 + 4 * pulse, 0, 6.2832);
      ctx.stroke();
    } else {
      // edge arrow toward target
      const x = tv[0] * view.Rv[0] + tv[1] * view.Rv[1] + tv[2] * view.Rv[2];
      const y = tv[0] * view.Uv[0] + tv[1] * view.Uv[1] + tv[2] * view.Uv[2];
      const ang = Math.atan2(-y, x);
      const cxs = W / 2, cys = H / 2;
      const rr = Math.min(W, H) / 2 - 46;
      const ax = cxs + rr * Math.cos(ang), ay = cys + rr * Math.sin(ang);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = `rgba(140,190,255,${0.5 + 0.5 * pulse})`;
      ctx.beginPath();
      ctx.moveTo(16, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // horizon-frame unit vector of the current target
  function targetVector(tg) {
    if (tg.kind === 'sun') return transform(view.Mdate, ...A.raDecToVec(eph.sun.ra, eph.sun.dec));
    if (tg.kind === 'moon') return transform(view.Mdate, ...A.raDecToVec(eph.moon.ra, eph.moon.dec));
    if (tg.kind === 'planet') {
      const pl = eph.planets.find((p) => p.name === tg.name);
      return pl ? transform(view.Mdate, ...A.raDecToVec(pl.ra, pl.dec)) : null;
    }
    if (tg.kind === 'star') return transform(view.M2000, starVec[tg.i * 3], starVec[tg.i * 3 + 1], starVec[tg.i * 3 + 2]);
    if (tg.kind === 'dso') return transform(view.M2000, dsoVecs[tg.i][0], dsoVecs[tg.i][1], dsoVecs[tg.i][2]);
    if (tg.kind === 'con') {
      const cl = conLabels[tg.i];
      return transform(view.M2000, cl.vec[0], cl.vec[1], cl.vec[2]);
    }
    return null;
  }

  // ---------------- main loop ----------------

  let rafPending = false;
  function frame() {
    rafPending = false;
    const animating = state.compass || state.target || state.targetAnim;
    if (state.targetAnim) stepTargetAnim();
    if (state.compass) stepCompass();
    if (state.needsRender || animating) {
      render();
      state.needsRender = false;
    }
    if (animating) scheduleFrame();
  }
  function scheduleFrame() {
    if (!rafPending) { rafPending = true; requestAnimationFrame(frame); }
  }
  function invalidate() { state.needsRender = true; scheduleFrame(); }

  // clock tick: sky drifts + label updates
  setInterval(() => { updateTimeLabel(); invalidate(); }, 15000);

  // ---------------- interaction ----------------

  const pointers = new Map();
  let pinchStart = null;
  let tapCandidate = null;
  let lastTapTime = 0;

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      tapCandidate = { x: e.clientX, y: e.clientY, t: performance.now() };
    } else if (pointers.size === 2) {
      tapCandidate = null;
      const pts = [...pointers.values()];
      pinchStart = { d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), fov: state.fov };
    }
    closeSheets(false);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const cur = { x: e.clientX, y: e.clientY };
    pointers.set(e.pointerId, cur);
    if (pointers.size === 1) {
      const dx = cur.x - prev.x, dy = cur.y - prev.y;
      if (tapCandidate && Math.hypot(cur.x - tapCandidate.x, cur.y - tapCandidate.y) > 8) {
        tapCandidate = null;
        if (state.compass) { setCompass(false); toast('Compass paused — tap 🧭 to resume'); }
      }
      if (state.compass) return; // sensor owns the view until a real drag pauses it
      const degPerPx = R2D / view.S;
      const cosA = Math.max(0.12, Math.cos(state.alt0 * D2R));
      state.az0 = A.rev(state.az0 - dx * degPerPx / cosA);
      state.alt0 = Math.min(89.3, Math.max(-85, state.alt0 + dy * degPerPx));
      state.targetAnim = null;
      invalidate();
    } else if (pointers.size === 2 && pinchStart) {
      const pts = [...pointers.values()];
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (d > 10) {
        state.fov = Math.min(150, Math.max(8, pinchStart.fov * pinchStart.d / d));
        invalidate();
      }
    }
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (e.type === 'pointerup' && tapCandidate && performance.now() - tapCandidate.t < 400) {
      const nowT = performance.now();
      if (nowT - lastTapTime < 300) {
        state.fov = Math.min(150, Math.max(8, state.fov / 1.6)); // double-tap zoom
        invalidate();
      } else {
        handleTap(tapCandidate.x, tapCandidate.y);
      }
      lastTapTime = nowT;
    }
    tapCandidate = null;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  function handleTap(x, y) {
    let best = null, bestScore = 1e9;
    for (const d of drawn) {
      const dist = Math.hypot(d.x - x, d.y - y);
      if (dist > 32) continue;
      const score = dist - d.pri * 10;
      if (score < bestScore) { bestScore = score; best = d; }
    }
    if (best) showInfo(best);
    else { hideInfo(); closeSheets(true); }
  }

  // ---------------- info card ----------------

  const infoCard = document.getElementById('info-card');

  function objectAltAz(vec) {
    const alt = Math.asin(Math.max(-1, Math.min(1, vec[2]))) * R2D;
    const az = A.rev(Math.atan2(vec[1], vec[0]) * R2D);
    return { alt, az };
  }

  function kv(label, value) { return `<span class="kv">${label} <b>${value}</b></span>`; }

  function riseSetText(posFn, h0) {
    const t = now();
    const rise = A.nextEvent(t, lat(), lon(), posFn, h0, 'rise');
    const set = A.nextEvent(t, lat(), lon(), posFn, h0, 'set');
    const parts = [];
    if (rise !== null && (set === null || rise < set)) parts.push(`Rises ${fmtTime(rise)}`);
    if (set !== null) parts.push(`Sets ${fmtTime(set)}`);
    if (rise !== null && set !== null && rise > set) parts.push(`rises again ${fmtTime(rise)}`);
    if (!parts.length) return '';
    return parts.join(' · ');
  }

  function showInfo(hit) {
    setupView(A.jdFromMs(now()));
    const nameEl = document.getElementById('info-name');
    const subEl = document.getElementById('info-sub');
    const bodyEl = document.getElementById('info-body');
    let name = '', sub = '', rows = [], vec = null;

    if (hit.kind === 'star') {
      const s = STAR_DATA[hit.i];
      name = s[4] || s[5] || 'Star';
      const conFull = s[6] && typeof CON_NAMES === 'object' ? (CON_NAMES[s[6]] || s[6]) : '';
      sub = [s[4] && s[5] ? s[5] : '', conFull ? 'in ' + conFull : ''].filter(Boolean).join(' · ') || 'Star';
      vec = transform(view.M2000, starVec[hit.i * 3], starVec[hit.i * 3 + 1], starVec[hit.i * 3 + 2]);
      rows.push(kv('Magnitude', s[2].toFixed(1)));
      const pm = A.precessionMatrix(A.centuries(A.jdFromMs(now())));
      const rd = A.vecToRaDec(A.applyMat(pm, [starVec[hit.i * 3], starVec[hit.i * 3 + 1], starVec[hit.i * 3 + 2]]));
      rows.push(kv('', riseSetText(() => rd, -0.5667)));
    } else if (hit.kind === 'planet') {
      const pl = hit.pl || eph.planets.find((p) => p.name === hit.name);
      name = pl.name; sub = 'Planet';
      vec = transform(view.Mdate, ...A.raDecToVec(pl.ra, pl.dec));
      rows.push(kv('Magnitude', pl.mag.toFixed(1)));
      rows.push(kv('Distance', pl.dist.toFixed(2) + ' AU'));
      rows.push(kv('', riseSetText((jde) => {
        const p2 = A.planetPositions(jde).find((q) => q.name === pl.name);
        return { ra: p2.ra, dec: p2.dec };
      }, -0.5667)));
    } else if (hit.kind === 'moon') {
      name = 'Moon';
      sub = A.moonPhaseName(eph.moon.illum, eph.moon.waxing);
      vec = transform(view.Mdate, ...A.raDecToVec(eph.moon.ra, eph.moon.dec));
      rows.push(kv('Illuminated', Math.round(eph.moon.illum * 100) + '%'));
      rows.push(kv('Distance', Math.round(eph.moon.dist).toLocaleString() + ' km'));
      rows.push(kv('', riseSetText((jde) => A.moonPosition(jde), 0.125)));
    } else if (hit.kind === 'sun') {
      name = 'Sun'; sub = 'Our star';
      vec = transform(view.Mdate, ...A.raDecToVec(eph.sun.ra, eph.sun.dec));
      rows.push(kv('Distance', eph.sun.r.toFixed(3) + ' AU'));
      rows.push(kv('', riseSetText((jde) => A.sunPosition(jde), -0.8333)));
    } else if (hit.kind === 'dso') {
      const d = DSO_DATA[hit.i];
      name = d[3]; sub = d[4];
      vec = transform(view.M2000, dsoVecs[hit.i][0], dsoVecs[hit.i][1], dsoVecs[hit.i][2]);
      rows.push(kv('Magnitude', d[2].toFixed(1)));
    } else if (hit.kind === 'con') {
      const cl = conLabels[hit.i];
      name = cl.name; sub = 'Constellation';
      vec = transform(view.M2000, cl.vec[0], cl.vec[1], cl.vec[2]);
    }

    if (vec) {
      const aa = objectAltAz(vec);
      rows.splice(0, 0,
        kv('Direction', `${windName(aa.az)} ${Math.round(aa.az)}°`),
        kv('Altitude', (aa.alt >= 0 ? '' : 'below horizon, ') + Math.round(Math.abs(aa.alt)) + '°'));
    }
    nameEl.textContent = name;
    subEl.textContent = sub;
    bodyEl.innerHTML = rows.filter((r) => !r.endsWith('<b></b></span>')).join('');
    infoCard.classList.remove('hidden');
  }
  function hideInfo() { infoCard.classList.add('hidden'); }
  document.getElementById('info-close').addEventListener('click', hideInfo);

  // ---------------- compass (point-at-sky) mode ----------------

  const compass = { az: null, alt: null, smoothAz: null, smoothAlt: null, gotEvent: false, attached: false };

  function orientationHandler(e) {
    let az, alt;
    if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null) {
      // iOS: heading of the device top; combined with tilt from beta/gamma
      const b = (e.beta || 0) * D2R, g = (e.gamma || 0) * D2R;
      alt = Math.asin(Math.max(-1, Math.min(1, -Math.cos(b) * Math.cos(g)))) * R2D;
      az = e.webkitCompassHeading;
    } else {
      if (e.alpha === null || e.alpha === undefined) return;
      const _z = e.alpha * D2R, _x = (e.beta || 0) * D2R, _y = (e.gamma || 0) * D2R;
      const cX = Math.cos(_x), cY = Math.cos(_y), cZ = Math.cos(_z);
      const sX = Math.sin(_x), sY = Math.sin(_y), sZ = Math.sin(_z);
      // W3C ZXY intrinsic rotation; columns map device axes → earth (E, N, Up)
      const m13 = cY * sZ * sX + cZ * sY;
      const m23 = sZ * sY - cZ * cY * sX;
      const m33 = cX * cY;
      // direction the BACK of the phone points (device −z) in earth frame
      const dE = -m13, dN = -m23, dU = -m33;
      az = A.rev(Math.atan2(dE, dN) * R2D);
      alt = Math.asin(Math.max(-1, Math.min(1, dU))) * R2D;
    }
    compass.az = az;
    compass.alt = alt;
    compass.gotEvent = true;
  }

  function attachOrientation() {
    if (compass.attached) return;
    compass.attached = true;
    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', orientationHandler, true);
    } else {
      window.addEventListener('deviceorientation', orientationHandler, true);
    }
  }

  function stepCompass() {
    if (compass.az === null) return;
    if (compass.smoothAz === null) { compass.smoothAz = compass.az; compass.smoothAlt = compass.alt; }
    let d = compass.az - compass.smoothAz;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    compass.smoothAz = A.rev(compass.smoothAz + d * 0.18);
    compass.smoothAlt += (compass.alt - compass.smoothAlt) * 0.18;
    state.az0 = compass.smoothAz;
    state.alt0 = Math.min(89.3, Math.max(-85, compass.smoothAlt));
    state.needsRender = true;
  }

  let wakeLock = null;
  async function acquireWakeLock() {
    try {
      if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    } catch (e) { /* not critical */ }
  }
  function releaseWakeLock() {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (state.compass) acquireWakeLock();
      invalidate();
    }
  });

  const btnCompass = document.getElementById('btn-compass');
  async function setCompass(on) {
    if (on) {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
          const res = await DeviceOrientationEvent.requestPermission();
          if (res !== 'granted') { toast('Motion access denied'); return; }
        } catch (e) { toast('Motion access unavailable'); return; }
      }
      attachOrientation();
      compass.gotEvent = false;
      state.compass = true;
      btnCompass.classList.add('active');
      toast('Point your phone at the sky 🌌');
      acquireWakeLock();
      setTimeout(() => {
        if (state.compass && !compass.gotEvent) toast('No compass data — is this a phone?');
      }, 2500);
      scheduleFrame();
    } else {
      state.compass = false;
      btnCompass.classList.remove('active');
      releaseWakeLock();
    }
  }
  btnCompass.addEventListener('click', () => setCompass(!state.compass));

  // ---------------- night mode ----------------

  const btnNight = document.getElementById('btn-night');
  function applyNight() {
    document.documentElement.classList.toggle('night', state.night);
    btnNight.classList.toggle('active', state.night);
  }
  btnNight.addEventListener('click', () => {
    state.night = !state.night;
    applyNight();
    persist();
    toast(state.night ? 'Night vision on — eyes stay dark-adapted' : 'Night vision off');
  });
  applyNight();

  // ---------------- sheets ----------------

  const sheets = ['search-sheet', 'time-sheet', 'location-sheet', 'tonight-sheet'];
  function openSheet(id) {
    for (const s of sheets) document.getElementById(s).classList.toggle('hidden', s !== id);
    hideInfo();
  }
  function closeSheets(includeInfo) {
    for (const s of sheets) document.getElementById(s).classList.add('hidden');
    if (includeInfo) hideInfo();
  }
  function sheetOpen(id) { return !document.getElementById(id).classList.contains('hidden'); }
  function toggleSheet(id, onOpen) {
    if (sheetOpen(id)) closeSheets(false);
    else { openSheet(id); if (onOpen) onOpen(); }
  }

  // ---------------- time controls ----------------

  const timeLabel = document.getElementById('time-label');
  const timeSlider = document.getElementById('time-slider');
  const timeDate = document.getElementById('time-date');

  function fmtTime(ms) {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function updateTimeLabel() {
    if (Math.abs(state.timeOffsetMs) < 90000) timeLabel.textContent = 'Now';
    else {
      const d = new Date(now());
      timeLabel.textContent = d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  }

  document.getElementById('btn-time').addEventListener('click', () => {
    toggleSheet('time-sheet', () => {
      timeSlider.value = String(Math.max(-720, Math.min(720, state.timeOffsetMs / 60000)));
      syncDateInput();
    });
  });

  function syncDateInput() {
    const d = new Date(now());
    const pad = (n) => String(n).padStart(2, '0');
    timeDate.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  timeSlider.addEventListener('input', () => {
    state.timeOffsetMs = Number(timeSlider.value) * 60000;
    updateEphemeris(true);
    updateTimeLabel();
    syncDateInput();
    invalidate();
  });

  timeDate.addEventListener('change', () => {
    const t = new Date(timeDate.value).getTime();
    if (!isNaN(t)) {
      state.timeOffsetMs = t - Date.now();
      updateEphemeris(true);
      updateTimeLabel();
      timeSlider.value = String(Math.max(-720, Math.min(720, state.timeOffsetMs / 60000)));
      invalidate();
    }
  });

  document.getElementById('btn-time-now').addEventListener('click', () => {
    state.timeOffsetMs = 0;
    timeSlider.value = '0';
    updateEphemeris(true);
    updateTimeLabel();
    syncDateInput();
    invalidate();
  });

  // ---------------- location ----------------

  const locLabel = document.getElementById('location-label');
  const locStatus = document.getElementById('location-status');

  function updateLocLabel() {
    locLabel.textContent = hasLocation()
      ? (state.locLabel || `${state.lat.toFixed(2)}°, ${state.lon.toFixed(2)}°`)
      : 'Set location';
  }

  document.getElementById('btn-location').addEventListener('click', () => {
    toggleSheet('location-sheet', () => {
      if (hasLocation()) {
        document.getElementById('lat-input').value = state.lat.toFixed(4);
        document.getElementById('lon-input').value = state.lon.toFixed(4);
      }
      locStatus.textContent = '';
    });
  });

  document.getElementById('btn-geolocate').addEventListener('click', () => {
    if (!navigator.geolocation) { locStatus.textContent = 'Geolocation not supported on this device.'; return; }
    locStatus.textContent = 'Locating…';
    navigator.geolocation.getCurrentPosition((pos) => {
      state.lat = pos.coords.latitude;
      state.lon = pos.coords.longitude;
      state.locLabel = `${state.lat.toFixed(2)}°, ${state.lon.toFixed(2)}°`;
      persist();
      updateLocLabel();
      updateEphemeris(true);
      locStatus.textContent = 'Location set ✓';
      setTimeout(() => closeSheets(false), 600);
      invalidate();
    }, (err) => {
      locStatus.textContent = 'Could not get location (' + err.message + '). Enter it manually below.';
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
  });

  document.getElementById('btn-latlon-apply').addEventListener('click', () => {
    const la = parseFloat(document.getElementById('lat-input').value);
    const lo = parseFloat(document.getElementById('lon-input').value);
    if (isNaN(la) || isNaN(lo) || la < -90 || la > 90 || lo < -180 || lo > 180) {
      locStatus.textContent = 'Please enter a valid latitude (−90…90) and longitude (−180…180).';
      return;
    }
    state.lat = la; state.lon = lo;
    state.locLabel = `${la.toFixed(2)}°, ${lo.toFixed(2)}°`;
    persist();
    updateLocLabel();
    updateEphemeris(true);
    locStatus.textContent = 'Location set ✓';
    setTimeout(() => closeSheets(false), 600);
    invalidate();
  });

  // ---------------- search ----------------

  const searchIndex = [];
  function buildSearchIndex() {
    searchIndex.length = 0;
    searchIndex.push({ n: 'Moon', sub: 'Earth’s moon', kind: 'moon' });
    searchIndex.push({ n: 'Sun', sub: 'Our star', kind: 'sun' });
    for (const name of A.PLANET_NAMES) searchIndex.push({ n: name, sub: 'Planet', kind: 'planet', name });
    for (let i = 0; i < N_STARS; i++) {
      const s = STAR_DATA[i];
      if (s.length > 4 && s[4]) {
        searchIndex.push({ n: s[4], sub: `${s[5] || 'Star'} · mag ${s[2].toFixed(1)}`, kind: 'star', i });
      }
    }
    for (let i = 0; i < conLabels.length; i++) {
      searchIndex.push({ n: conLabels[i].name, sub: 'Constellation', kind: 'con', i });
    }
    for (let i = 0; i < DSO_DATA.length; i++) {
      searchIndex.push({ n: DSO_DATA[i][3], sub: DSO_DATA[i][4], kind: 'dso', i });
    }
  }
  buildSearchIndex();

  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');

  document.getElementById('btn-search').addEventListener('click', () => {
    toggleSheet('search-sheet', () => {
      searchInput.value = '';
      renderSearch('');
      setTimeout(() => searchInput.focus(), 50);
    });
  });

  searchInput.addEventListener('input', () => renderSearch(searchInput.value));

  function renderSearch(q) {
    q = q.trim().toLowerCase();
    let items;
    if (!q) {
      items = searchIndex.slice(0, 9); // Moon, Sun, planets
    } else {
      const starts = [], contains = [];
      for (const it of searchIndex) {
        const nl = it.n.toLowerCase();
        if (nl.startsWith(q)) starts.push(it);
        else if (nl.includes(q)) contains.push(it);
        if (starts.length > 12) break;
      }
      items = starts.concat(contains).slice(0, 12);
    }
    searchResults.innerHTML = '';
    for (const it of items) {
      const div = document.createElement('div');
      div.className = 'search-item';
      div.innerHTML = `<span class="si-name">${it.n}</span><span class="si-sub">${it.sub}</span>`;
      div.addEventListener('click', () => selectTarget(it));
      searchResults.appendChild(div);
    }
    if (q && !items.length) searchResults.innerHTML = '<div class="muted" style="padding:8px">No matches.</div>';
  }

  const targetChip = document.getElementById('target-chip');

  function selectTarget(it) {
    closeSheets(true);
    state.target = it;
    document.getElementById('target-chip-label').textContent = '→ ' + it.n;
    targetChip.classList.remove('hidden');
    if (!state.compass) {
      // fly the view there
      setupView(A.jdFromMs(now()));
      const tv = targetVector(it);
      if (tv) {
        const aa = objectAltAz(tv);
        state.targetAnim = {
          fromAz: state.az0, fromAlt: state.alt0,
          toAz: aa.az, toAlt: Math.max(-30, aa.alt),
          t0: performance.now(), dur: 700,
        };
        if (aa.alt < 0) toast(`${it.n} is below the horizon right now`);
      }
    }
    scheduleFrame();
  }

  function stepTargetAnim() {
    const an = state.targetAnim;
    if (!an) return;
    const t = Math.min(1, (performance.now() - an.t0) / an.dur);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    let dAz = an.toAz - an.fromAz;
    while (dAz > 180) dAz -= 360;
    while (dAz < -180) dAz += 360;
    state.az0 = A.rev(an.fromAz + dAz * e);
    state.alt0 = an.fromAlt + (an.toAlt - an.fromAlt) * e;
    state.needsRender = true;
    if (t >= 1) state.targetAnim = null;
  }

  document.getElementById('target-chip-close').addEventListener('click', () => {
    state.target = null;
    state.targetAnim = null;
    targetChip.classList.add('hidden');
    invalidate();
  });

  // ---------------- tonight panel ----------------

  document.getElementById('btn-tonight').addEventListener('click', () => {
    toggleSheet('tonight-sheet', renderTonight);
  });

  function renderTonight() {
    const body = document.getElementById('tonight-body');
    if (!hasLocation()) {
      body.innerHTML = '<p class="muted">Set your location first to get tonight’s forecast.</p>';
      return;
    }
    // "tonight" = the night following the most recent local noon
    const t = now();
    const local = new Date(t);
    const noonLocal = new Date(local.getFullYear(), local.getMonth(), local.getDate(), 12, 0, 0).getTime();
    const base = t < noonLocal ? noonLocal - 86400000 : noonLocal;

    const sunFn = (jde) => A.sunPosition(jde);
    const moonFn = (jde) => A.moonPosition(jde);
    const rows = [];
    const next = (from, posFn, h0, kind) => A.nextEvent(from, state.lat, state.lon, posFn, h0, kind);

    const sunset = next(base, sunFn, -0.8333, 'set');
    const sunrise = sunset !== null ? next(sunset, sunFn, -0.8333, 'rise') : null;
    if (sunset !== null) {
      rows.push(row('🌇', `Sunset ${fmtTime(sunset)}`, sunrise !== null ? `Sunrise ${fmtTime(sunrise)}` : ''));
    } else {
      rows.push(row('🌇', 'The Sun does not set today', 'Polar day at this latitude'));
    }
    const eveRef = sunset !== null ? sunset : base + 7 * 3600000;
    const darkStart = next(eveRef, sunFn, -18, 'set');
    const darkEnd = darkStart !== null ? next(darkStart, sunFn, -18, 'rise') : null;
    if (darkStart !== null && darkEnd !== null && darkStart - base < 86400000) {
      rows.push(row('🌌', `Truly dark ${fmtTime(darkStart)} – ${fmtTime(darkEnd)}`, 'Astronomical darkness — best stargazing'));
    } else {
      rows.push(row('🌌', 'No full astronomical darkness', 'The sky stays in twilight tonight'));
    }

    // Moon
    const m = A.moonPosition(A.jdeFromJd(A.jdFromMs(eveRef)));
    const moonrise = next(base, moonFn, 0.125, 'rise');
    const moonset = next(eveRef, moonFn, 0.125, 'set');
    const mBits = [];
    if (moonrise !== null) mBits.push(`rises ${fmtTime(moonrise)}`);
    if (moonset !== null) mBits.push(`sets ${fmtTime(moonset)}`);
    rows.push(row('🌙', `${A.moonPhaseName(m.illum, m.waxing)} · ${Math.round(m.illum * 100)}%`, mBits.join(' · ')));

    // Planets
    for (const name of ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']) {
      const posFn = (jde) => {
        const p = A.planetPositions(jde).find((q) => q.name === name);
        return { ra: p.ra, dec: p.dec };
      };
      const jdEve = A.jdFromMs(eveRef) + 40 / 1440; // ~40 min after sunset
      const pv = A.planetPositions(A.jdeFromJd(jdEve)).find((q) => q.name === name);
      const aaEve = A.altAz(pv.ra, pv.dec, A.lst(jdEve, state.lon), state.lat);
      let main = '', sub = '';
      if (pv.elong < 12) { main = `${name}: lost in the Sun’s glare`; }
      else if (aaEve.alt > 5) {
        const sets = next(eveRef, posFn, -0.5667, 'set');
        main = `${name}: up after sunset`;
        sub = `Look ${windName(aaEve.az)}, ${Math.round(aaEve.alt)}° high` + (sets !== null ? ` · sets ${fmtTime(sets)}` : '');
      } else {
        const rises = next(eveRef, posFn, -0.5667, 'rise');
        if (rises !== null && (sunrise === null || rises < sunrise + 3600000)) {
          main = `${name}: rises ${fmtTime(rises)}`;
          sub = `Look ${windName(A.altAz(pv.ra, pv.dec, A.lst(A.jdFromMs(rises), state.lon), state.lat).az)}, low at first`;
        } else {
          main = `${name}: not visible tonight`;
        }
      }
      const em = { Mercury: '☿️', Venus: '💛', Mars: '🔴', Jupiter: '🟠', Saturn: '🪐' }[name] || '•';
      rows.push(row(em, main, sub));
    }
    body.innerHTML = rows.join('');

    function row(icon, main, sub) {
      return `<div class="t-row"><div class="t-icon">${icon}</div><div class="t-main">${main}${sub ? `<div class="t-sub">${sub}</div>` : ''}</div></div>`;
    }
  }

  // ---------------- toast & help ----------------

  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    el.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.classList.add('hidden'), 450);
    }, 2600);
  }

  const helpOverlay = document.getElementById('help-overlay');
  document.getElementById('btn-help').addEventListener('click', () => helpOverlay.classList.remove('hidden'));
  document.getElementById('btn-help-close').addEventListener('click', () => {
    helpOverlay.classList.add('hidden');
    try { localStorage.setItem('nightsky_seen', '1'); } catch (e) { /* ok */ }
    if (!hasLocation()) openSheet('location-sheet');
  });

  // install prompt
  let installEvent = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    const card = helpOverlay.querySelector('.overlay-card');
    if (!document.getElementById('btn-install')) {
      const btn = document.createElement('button');
      btn.id = 'btn-install';
      btn.className = 'btn-primary';
      btn.textContent = '📲 Install on this phone';
      btn.addEventListener('click', async () => {
        if (installEvent) { installEvent.prompt(); installEvent = null; btn.remove(); }
      });
      card.insertBefore(btn, document.getElementById('btn-help-close'));
    }
  });

  // ---------------- boot ----------------

  let firstRun = true;
  try { firstRun = !localStorage.getItem('nightsky_seen'); } catch (e) { /* ok */ }
  if (firstRun) helpOverlay.classList.remove('hidden');
  else if (!hasLocation()) openSheet('location-sheet');

  updateLocLabel();
  updateTimeLabel();
  updateEphemeris(true);
  invalidate();

  // debug/testing hook
  window.NS = { state, drawn, eph, invalidate, render, setCompass, selectTarget, searchIndex };

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline support unavailable */ });
    });
  }
})();
