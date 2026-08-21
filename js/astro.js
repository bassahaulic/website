/* Astronomy engine — algorithms from Meeus, "Astronomical Algorithms" (2nd ed.)
 * and the JPL approximate planetary elements (Standish, 1800–2050).
 * Accuracy targets: Sun ~0.01°, Moon ~0.1°, planets ~0.1–0.3° — ample for naked-eye stargazing.
 */
(function (global) {
  'use strict';

  const D2R = Math.PI / 180;
  const R2D = 180 / Math.PI;
  const TAU = Math.PI * 2;

  function rev(deg) { deg %= 360; return deg < 0 ? deg + 360 : deg; }
  function sinD(d) { return Math.sin(d * D2R); }
  function cosD(d) { return Math.cos(d * D2R); }

  // ---------------- Time ----------------

  // Julian Date from a JS timestamp (ms since Unix epoch, which is UT).
  function jdFromMs(ms) { return ms / 86400000 + 2440587.5; }

  // ΔT ≈ 69 s in the mid-2020s; only the Moon moves fast enough to care, ~0.001°.
  function jdeFromJd(jd) { return jd + 69 / 86400; }

  function centuries(jd) { return (jd - 2451545.0) / 36525; }

  // Greenwich mean sidereal time in degrees (Meeus 12.4). jd is UT-based.
  function gmst(jd) {
    const T = centuries(jd);
    return rev(280.46061837 + 360.98564736629 * (jd - 2451545.0)
      + 0.000387933 * T * T - T * T * T / 38710000);
  }

  // Local sidereal time in degrees; east longitude positive.
  function lst(jd, lonDeg) { return rev(gmst(jd) + lonDeg); }

  // Mean obliquity of the ecliptic, degrees (Meeus 22.2 truncated).
  function obliquity(T) {
    return 23.43929111 - (46.8150 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600;
  }

  // Precession matrix rotating J2000 equatorial vectors to mean-of-date (Meeus ch. 21).
  function precessionMatrix(T) {
    const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) / 3600;
    const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) / 3600;
    const theta = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) / 3600;
    const cz = cosD(zeta), sz = sinD(zeta);
    const cZ = cosD(z), sZ = sinD(z);
    const ct = cosD(theta), st = sinD(theta);
    // R = Rz(-z) · Ry(theta) · Rz(-zeta)
    return [
      cZ * ct * cz - sZ * sz, -cZ * ct * sz - sZ * cz, -cZ * st,
      sZ * ct * cz + cZ * sz, -sZ * ct * sz + cZ * cz, -sZ * st,
      st * cz, -st * sz, ct,
    ];
  }

  function applyMat(m, v) {
    return [
      m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
      m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
      m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
    ];
  }

  function raDecToVec(raDeg, decDeg) {
    const cd = cosD(decDeg);
    return [cd * cosD(raDeg), cd * sinD(raDeg), sinD(decDeg)];
  }

  function vecToRaDec(v) {
    const r = Math.hypot(v[0], v[1], v[2]);
    return { ra: rev(Math.atan2(v[1], v[0]) * R2D), dec: Math.asin(v[2] / r) * R2D };
  }

  // Ecliptic (λ, β, of-date) → equatorial (RA, Dec, of-date), degrees.
  function eclToEq(lambda, beta, eps) {
    const sl = sinD(lambda), cl = cosD(lambda);
    const sb = sinD(beta), cb = cosD(beta);
    const se = sinD(eps), ce = cosD(eps);
    const ra = rev(Math.atan2(sl * ce - (sb / cb) * se, cl) * R2D);
    const dec = Math.asin(sb * ce + cb * se * sl) * R2D;
    return { ra, dec };
  }

  // ---------------- Sun (Meeus ch. 25, low precision) ----------------

  function sunPosition(jde) {
    const T = centuries(jde);
    const L0 = rev(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
    const M = rev(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
    const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sinD(M)
      + (0.019993 - 0.000101 * T) * sinD(2 * M)
      + 0.000289 * sinD(3 * M);
    const trueLong = rev(L0 + C);
    const nu = M + C;
    const R = 1.000001018 * (1 - e * e) / (1 + e * cosD(nu));
    const omega = 125.04 - 1934.136 * T;
    const lambda = rev(trueLong - 0.00569 - 0.00478 * sinD(omega)); // apparent
    const eps = obliquity(T) + 0.00256 * cosD(omega);
    const eq = eclToEq(lambda, 0, eps);
    return { ra: eq.ra, dec: eq.dec, lambda, r: R };
  }

  // ---------------- Moon (Meeus ch. 47, truncated series) ----------------

  // Terms: [D, M, Mp, F, sinCoeff(1e-6 deg), cosCoeff(1e-3 km)]
  const MOON_LR = [
    [0, 0, 1, 0, 6288774, -20905355],
    [2, 0, -1, 0, 1274027, -3699111],
    [2, 0, 0, 0, 658314, -2955968],
    [0, 0, 2, 0, 213618, -569925],
    [0, 1, 0, 0, -185116, 48888],
    [0, 0, 0, 2, -114332, -3149],
    [2, 0, -2, 0, 58793, 246158],
    [2, -1, -1, 0, 57066, -152138],
    [2, 0, 1, 0, 53322, -170733],
    [2, -1, 0, 0, 45758, -204586],
    [0, 1, -1, 0, -40923, -129620],
    [1, 0, 0, 0, -34720, 108743],
    [0, 1, 1, 0, -30383, 104755],
    [2, 0, 0, -2, 15327, 10321],
    [0, 0, 1, 2, -12528, 0],
    [0, 0, 1, -2, 10980, 79661],
    [4, 0, -1, 0, 10675, -34782],
    [0, 0, 3, 0, 10034, -23210],
    [4, 0, -2, 0, 8548, -21636],
    [2, 1, -1, 0, -7888, 24208],
    [2, 1, 0, 0, -6766, 30824],
    [1, 0, -1, 0, -5163, -8379],
    [1, 1, 0, 0, 4987, -16675],
    [2, -1, 1, 0, 4036, -12831],
    [2, 0, 2, 0, 3994, -10445],
    [4, 0, 0, 0, 3861, -11650],
    [2, 0, -3, 0, 3665, 14403],
    [0, 1, -2, 0, -2689, -7003],
    [2, 0, -1, 2, -2602, 0],
    [2, -1, -2, 0, 2390, 10056],
    [1, 0, 1, 0, -2348, 6322],
    [2, -2, 0, 0, 2236, -9884],
  ];

  // Terms: [D, M, Mp, F, sinCoeff(1e-6 deg)]
  const MOON_B = [
    [0, 0, 0, 1, 5128122],
    [0, 0, 1, 1, 280602],
    [0, 0, 1, -1, 277693],
    [2, 0, 0, -1, 173237],
    [2, 0, -1, 1, 55413],
    [2, 0, -1, -1, 46271],
    [2, 0, 0, 1, 32573],
    [0, 0, 2, 1, 17198],
    [2, 0, 1, -1, 9266],
    [0, 0, 2, -1, 8822],
    [2, -1, 0, -1, 8216],
    [2, 0, -2, -1, 4324],
    [2, 0, 1, 1, 4200],
    [2, 1, 0, -1, -3359],
    [2, -1, -1, 1, 2463],
    [2, -1, 0, 1, 2211],
    [2, -1, -1, -1, 2065],
    [0, 1, -1, -1, -1870],
    [4, 0, -1, -1, 1828],
    [0, 1, 0, 1, -1794],
    [0, 0, 0, 3, -1749],
    [0, 1, -1, 1, -1565],
    [1, 0, 0, 1, -1491],
    [0, 1, 1, 1, -1475],
    [0, 1, 1, -1, -1410],
    [0, 1, 0, -1, -1344],
    [1, 0, 0, -1, -1335],
    [0, 0, 3, 1, 1107],
    [4, 0, 0, -1, 1021],
    [4, 0, -1, 1, 833],
  ];

  function moonPosition(jde) {
    const T = centuries(jde);
    const Lp = rev(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T
      + T * T * T / 538841 - T * T * T * T / 65194000);
    const D = rev(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T
      + T * T * T / 545868 - T * T * T * T / 113065000);
    const M = rev(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + T * T * T / 24490000);
    const Mp = rev(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T
      + T * T * T / 69699 - T * T * T * T / 14712000);
    const F = rev(93.2720950 + 483202.0175233 * T - 0.0036539 * T * T
      - T * T * T / 3526000 + T * T * T * T / 863310000);
    const E = 1 - 0.002516 * T - 0.0000074 * T * T;
    const A1 = rev(119.75 + 131.849 * T);
    const A2 = rev(53.09 + 479264.290 * T);
    const A3 = rev(313.45 + 481266.484 * T);

    let sumL = 0, sumR = 0, sumB = 0;
    for (const [d, m, mp, f, sl, cr] of MOON_LR) {
      const arg = d * D + m * M + mp * Mp + f * F;
      let eFac = 1;
      if (m === 1 || m === -1) eFac = E; else if (m === 2 || m === -2) eFac = E * E;
      sumL += sl * eFac * sinD(arg);
      sumR += cr * eFac * cosD(arg);
    }
    sumL += 3958 * sinD(A1) + 1962 * sinD(Lp - F) + 318 * sinD(A2);
    for (const [d, m, mp, f, sb] of MOON_B) {
      const arg = d * D + m * M + mp * Mp + f * F;
      let eFac = 1;
      if (m === 1 || m === -1) eFac = E; else if (m === 2 || m === -2) eFac = E * E;
      sumB += sb * eFac * sinD(arg);
    }
    sumB += -2235 * sinD(Lp) + 382 * sinD(A3) + 175 * sinD(A1 - F)
      + 175 * sinD(A1 + F) + 127 * sinD(Lp - Mp) - 115 * sinD(Lp + Mp);

    const lambda = rev(Lp + sumL / 1e6);
    const beta = sumB / 1e6;
    const dist = 385000.56 + sumR / 1000; // km

    const eps = obliquity(T);
    const eq = eclToEq(lambda, beta, eps);

    // Illuminated fraction & phase (Meeus ch. 48).
    const sun = sunPosition(jde);
    const psi = Math.acos(cosD(beta) * cosD(lambda - sun.lambda)) * R2D; // elongation
    const sunDistKm = sun.r * 149597870.7;
    const i = Math.atan2(sunDistKm * sinD(psi), dist - sunDistKm * cosD(psi)) * R2D; // phase angle
    const illum = (1 + cosD(i)) / 2;
    const waxing = sinD(lambda - sun.lambda) > 0;

    return { ra: eq.ra, dec: eq.dec, lambda, beta, dist, illum, phaseAngle: i, waxing, elong: psi };
  }

  function moonPhaseName(illum, waxing) {
    if (illum < 0.03) return 'New Moon';
    if (illum > 0.97) return 'Full Moon';
    if (illum < 0.47) return waxing ? 'Waxing Crescent' : 'Waning Crescent';
    if (illum <= 0.53) return waxing ? 'First Quarter' : 'Last Quarter';
    return waxing ? 'Waxing Gibbous' : 'Waning Gibbous';
  }

  // ---------------- Planets (JPL approximate elements, 1800–2050) ----------------

  // [a, aDot, e, eDot, I, IDot, L, LDot, varpi, varpiDot, Omega, OmegaDot]
  const PLANET_ELEMENTS = {
    Mercury: [0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749,
      252.25032350, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081],
    Venus: [0.72333566, 0.00000390, 0.00677672, -0.00004107, 3.39467605, -0.00078890,
      181.97909950, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418],
    Earth: [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668,
      100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0.0, 0.0],
    Mars: [1.52371034, 0.00001847, 0.09339410, 0.00007882, 1.84969142, -0.00813131,
      -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343],
    Jupiter: [5.20288700, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714,
      34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106],
    Saturn: [9.53667594, -0.00125060, 0.05386179, -0.00050991, 2.48599187, 0.00193609,
      49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794],
    Uranus: [19.18916464, -0.00196176, 0.04725744, -0.00004397, 0.77263783, -0.00242939,
      313.23810451, 428.48202785, 170.95427630, 0.40805281, 74.01692503, 0.04240589],
    Neptune: [30.06992276, 0.00026291, 0.00859048, 0.00005105, 1.77004347, 0.00035372,
      -55.12002969, 218.45945325, 44.96476227, -0.32241464, 131.78422574, -0.00508664],
  };

  function keplerSolve(Mdeg, e) {
    const M = rev(Mdeg) * D2R;
    let E = e < 0.8 ? M : Math.PI;
    for (let k = 0; k < 20; k++) {
      const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= dE;
      if (Math.abs(dE) < 1e-9) break;
    }
    return E;
  }

  // Heliocentric ecliptic-of-J2000 rectangular coordinates, AU.
  function helioVec(name, T) {
    const el = PLANET_ELEMENTS[name];
    const a = el[0] + el[1] * T;
    const e = el[2] + el[3] * T;
    const I = el[4] + el[5] * T;
    const L = el[6] + el[7] * T;
    const varpi = el[8] + el[9] * T;
    const Omega = el[10] + el[11] * T;
    const omega = varpi - Omega;
    const M = L - varpi;
    const E = keplerSolve(M, e);
    const xp = a * (Math.cos(E) - e);
    const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const co = cosD(omega), so = sinD(omega);
    const cO = cosD(Omega), sO = sinD(Omega);
    const cI = cosD(I), sI = sinD(I);
    return [
      (co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp,
      (co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp,
      (so * sI) * xp + (co * sI) * yp,
    ];
  }

  const PLANET_NAMES = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];

  function planetMag(name, r, delta, iDeg) {
    const x = 5 * Math.log10(r * delta);
    switch (name) {
      case 'Mercury': return -0.42 + x + 0.0380 * iDeg - 0.000273 * iDeg * iDeg + 0.000002 * iDeg * iDeg * iDeg;
      case 'Venus': return -4.40 + x + 0.0009 * iDeg + 0.000239 * iDeg * iDeg - 0.00000065 * iDeg * iDeg * iDeg;
      case 'Mars': return -1.52 + x + 0.016 * iDeg;
      case 'Jupiter': return -9.40 + x + 0.005 * iDeg;
      case 'Saturn': return -8.95 + x + 0.044 * iDeg; // ring contribution folded into constant
      case 'Uranus': return -7.19 + x;
      case 'Neptune': return -6.87 + x;
    }
    return 0;
  }

  // Geocentric RA/Dec (of-date) for all planets. jde: Julian ephemeris date.
  function planetPositions(jde) {
    const T = centuries(jde);
    const eps = obliquity(T);
    const prec = precessionMatrix(T);
    const earth = helioVec('Earth', T);
    const out = [];
    for (const name of PLANET_NAMES) {
      let p = helioVec(name, T);
      // one light-time iteration
      let dx = p[0] - earth[0], dy = p[1] - earth[1], dz = p[2] - earth[2];
      let delta = Math.hypot(dx, dy, dz);
      const lightDays = delta * 0.0057755183;
      p = helioVec(name, T - lightDays / 36525);
      dx = p[0] - earth[0]; dy = p[1] - earth[1]; dz = p[2] - earth[2];
      delta = Math.hypot(dx, dy, dz);
      const r = Math.hypot(p[0], p[1], p[2]);

      // ecliptic J2000 → equatorial J2000 → precess to of-date
      const eps0 = 23.43929111;
      const eq2000 = [
        dx,
        dy * cosD(eps0) - dz * sinD(eps0),
        dy * sinD(eps0) + dz * cosD(eps0),
      ];
      const eqDate = applyMat(prec, eq2000);
      const { ra, dec } = vecToRaDec(eqDate);

      // phase angle: sun-planet-earth
      const rE = Math.hypot(earth[0], earth[1], earth[2]);
      let cosi = (r * r + delta * delta - rE * rE) / (2 * r * delta);
      cosi = Math.min(1, Math.max(-1, cosi));
      const iDeg = Math.acos(cosi) * R2D;
      // elongation: sun-earth-planet
      let cosE = (rE * rE + delta * delta - r * r) / (2 * rE * delta);
      cosE = Math.min(1, Math.max(-1, cosE));
      const elong = Math.acos(cosE) * R2D;

      out.push({ name, ra, dec, dist: delta, mag: planetMag(name, r, delta, iDeg), elong });
    }
    return out;
  }

  // ---------------- Horizontal coordinates ----------------

  // RA/Dec (deg, of-date) → altitude/azimuth (deg). Azimuth from North, through East.
  function altAz(raDeg, decDeg, lstDeg, latDeg) {
    const H = lstDeg - raDeg; // hour angle, degrees
    const sH = sinD(H), cH = cosD(H);
    const sphi = sinD(latDeg), cphi = cosD(latDeg);
    const sdec = sinD(decDeg), cdec = cosD(decDeg);
    const alt = Math.asin(sphi * sdec + cphi * cdec * cH) * R2D;
    const az = rev(Math.atan2(sH, cH * sphi - (sdec / cdec) * cphi) * R2D + 180);
    return { alt, az };
  }

  // Inverse: altitude/azimuth (deg, az from North through East) → RA/Dec (deg, of-date).
  function raDecFromAltAz(altDeg, azDeg, lstDeg, latDeg) {
    const A = azDeg - 180; // back to from-South convention
    const sA = sinD(A), cA = cosD(A);
    const salt = sinD(altDeg), calt = cosD(altDeg);
    const sphi = sinD(latDeg), cphi = cosD(latDeg);
    const H = Math.atan2(sA * calt, cA * calt * sphi + salt * cphi) * R2D;
    const dec = Math.asin(salt * sphi - calt * cphi * cA) * R2D;
    return { ra: rev(lstDeg - H), dec };
  }

  // Atmospheric refraction (Bennett), degrees, for apparent altitude computation.
  function refraction(altDeg) {
    if (altDeg < -1) return 0;
    return 1.02 / Math.tan((altDeg + 10.3 / (altDeg + 5.11)) * D2R) / 60;
  }

  // ---------------- Rise / set / transit ----------------

  // Generic rise/set for a body given by posFn(jde) → {ra, dec}.
  // h0: standard altitude (deg): sun −0.8333, moon +0.125, stars/planets −0.5667,
  // twilight −6/−12/−18. Searches the local day containing jdApprox (local midday given).
  // Returns {rise, set, transit} as ms timestamps or null when the event doesn't occur.
  function solveEvent(jdGuess, lat, lon, posFn, h0, kind) {
    let jd = jdGuess;
    for (let iter = 0; iter < 8; iter++) {
      const pos = posFn(jdeFromJd(jd));
      const theta = lst(jd, lon);
      if (kind === 'transit') {
        let dH = rev(pos.ra - theta);
        if (dH > 180) dH -= 360;
        jd += dH / 360.98565;
      } else {
        const cosH0 = (sinD(h0) - sinD(lat) * sinD(pos.dec)) / (cosD(lat) * cosD(pos.dec));
        if (cosH0 < -1 || cosH0 > 1) return null; // circumpolar or never rises
        const H0 = Math.acos(cosH0) * R2D;
        const Htarget = kind === 'rise' ? -H0 : H0;
        let H = rev(theta - pos.ra);
        if (H > 180) H -= 360;
        let dH = Htarget - H;
        while (dH > 180) dH -= 360;
        while (dH < -180) dH += 360;
        jd += dH / 360.98565;
      }
    }
    return jd;
  }

  function riseSetTransit(jdNoonUT, lat, lon, posFn, h0) {
    const transit = solveEvent(jdNoonUT, lat, lon, posFn, h0, 'transit');
    const rise = solveEvent(jdNoonUT - 0.25, lat, lon, posFn, h0, 'rise');
    const set = solveEvent(jdNoonUT + 0.25, lat, lon, posFn, h0, 'set');
    const toMs = (jd) => jd === null ? null : (jd - 2440587.5) * 86400000;
    return { rise: toMs(rise), set: toMs(set), transit: toMs(transit) };
  }

  // First rise/set/transit at or after msStart. Returns ms timestamp or null.
  function nextEvent(msStart, lat, lon, posFn, h0, kind) {
    const jdStart = jdFromMs(msStart);
    let jd = solveEvent(jdStart, lat, lon, posFn, h0, kind);
    for (let k = 0; k < 3 && jd !== null && jd < jdStart - 0.002; k++) {
      jd = solveEvent(jd + 1.0, lat, lon, posFn, h0, kind);
    }
    if (jd === null || jd < jdStart - 0.002) return null;
    return (jd - 2440587.5) * 86400000;
  }

  const Astro = {
    D2R, R2D, TAU, rev,
    jdFromMs, jdeFromJd, centuries, gmst, lst, obliquity,
    precessionMatrix, applyMat, raDecToVec, vecToRaDec, eclToEq,
    sunPosition, moonPosition, moonPhaseName, planetPositions,
    altAz, raDecFromAltAz, refraction, riseSetTransit, nextEvent,
    PLANET_NAMES,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Astro;
  else global.Astro = Astro;
})(typeof window !== 'undefined' ? window : globalThis);
