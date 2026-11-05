(function () {
  'use strict';
  var E = 1e-6;
  var C = {
    tbasse: { d: { p: [0.8, 0.5, 0.4], m: [1.1, 0.6, 0.45], g: [1.4, 0.8, 0.45] }, o: 'upBack', kg: 20, c: 'meuble', top: 1, grp: 4, ar: 'la' },
    meubletv: { d: { p: [1.0, 0.4, 0.5], m: [1.5, 0.45, 0.55], g: [2.0, 0.5, 0.6] }, o: 'upBack', kg: 35, c: 'meuble', top: 1, grp: 2, ar: 'le', tip: 'portes et tiroirs fermés' },
    tv: { d: { p: [0.9, 0.12, 0.6], m: [1.25, 0.15, 0.8], g: [1.5, 0.15, 0.95] }, o: 'up', kg: 15, c: 'fragile', grp: 5, ar: 'la', tip: 'debout, jamais à plat, calée entre deux meubles ou matelas' },
    chaise: { d: { p: [0.45, 0.5, 0.85], m: [0.45, 0.5, 0.9], g: [0.55, 0.6, 1.0] }, o: 'up', kg: 6, c: 'meuble', grp: 4, ar: 'la' },
    buffet: { d: { p: [1.1, 0.45, 0.85], m: [1.5, 0.5, 0.9], g: [2.0, 0.5, 0.95] }, o: 'upBack', kg: 60, c: 'meuble', top: 1, grp: 1, ar: 'le', tip: 'tiroirs fermés' },
    biblio: { d: { p: [0.8, 0.3, 1.0], m: [0.9, 0.35, 1.8], g: [1.2, 0.4, 2.0] }, o: 'upBack', kg: 45, c: 'meuble', top: 1, grp: 1, ar: 'la', tip: 'vidée, étagères calées' },
    vitrine: { d: { p: [0.7, 0.35, 1.2], m: [0.9, 0.4, 1.8], g: [1.2, 0.45, 1.95] }, o: 'up', kg: 50, c: 'fragile', grp: 2, ar: 'la', tip: 'debout contre une paroi pleine' },
    tapis: { d: { p: [1.4, 0.25, 0.25], m: [2.0, 0.3, 0.3], g: [2.5, 0.35, 0.35] }, o: 'any', kg: 10, c: 'divers', grp: 4, ar: 'le', tip: 'roulé et ficelé' },
    coiffeuse: { d: { p: [0.8, 0.4, 1.3], m: [1.0, 0.45, 1.5], g: [1.2, 0.5, 1.7] }, o: 'up', kg: 35, c: 'fragile', grp: 2, ar: 'la', tip: 'miroir démonté si possible' },
    commode: { d: { p: [0.8, 0.45, 0.8], m: [1.0, 0.5, 0.85], g: [1.3, 0.55, 1.0] }, o: 'upBack', kg: 45, c: 'meuble', top: 1, grp: 2, ar: 'la', tip: 'tiroirs fermés' },
    chevet: { d: { p: [0.4, 0.35, 0.45], m: [0.45, 0.4, 0.55], g: [0.55, 0.45, 0.65] }, o: 'upBack', kg: 12, c: 'meuble', top: 1, grp: 4, ar: 'la' },
    bureau: { d: { p: [1.0, 0.55, 0.75], m: [1.3, 0.65, 0.76], g: [1.6, 0.8, 0.76] }, o: 'upBack', kg: 40, c: 'meuble', top: 1, grp: 2, ar: 'le' },
    frigo: { d: { p: [0.55, 0.6, 0.85], m: [0.6, 0.65, 1.6], g: [0.9, 0.75, 1.85] }, o: 'up', kg: { p: 30, m: 65, g: 110 }, c: 'elec', top: 1, hv: 1, grp: 1, ar: 'le', tip: 'toujours debout, sanglé ; rebrancher 3 h après' },
    congel: { d: { p: [0.6, 0.55, 0.85], m: [1.0, 0.65, 0.85], g: [1.3, 0.7, 0.9] }, o: 'up', kg: { p: 35, m: 50, g: 70 }, c: 'elec', top: 1, hv: 1, grp: 1, ar: 'le', tip: 'debout, sanglé' },
    cuisiniere: { d: { p: [0.6, 0.4, 0.15], m: [0.6, 0.6, 0.85], g: [0.9, 0.6, 0.9] }, o: 'up', kg: { p: 8, m: 45, g: 60 }, c: 'elec', top: 1, hv: 1, grp: 1, ar: 'la', tip: 'gaz débranché, grilles calées' },
    mal: { d: { p: [0.4, 0.6, 0.85], m: [0.6, 0.6, 0.85], g: [0.6, 0.65, 0.85] }, o: 'up', kg: { p: 55, m: 70, g: 80 }, c: 'elec', top: 1, hv: 1, grp: 1, ar: 'la', tip: 'tambour bloqué, debout' },
    micro: { d: { m: [0.5, 0.4, 0.3] }, o: 'up', kg: 12, c: 'elec', top: 1, grp: 4, ar: 'le' },
    clim: { d: { p: [0.7, 0.3, 0.5], m: [0.85, 0.35, 0.6], g: [0.95, 0.4, 0.75] }, o: 'up', kg: { p: 30, m: 40, g: 55 }, c: 'elec', top: 1, hv: 1, grp: 1, ar: 'le', tip: 'unité extérieure debout' },
    ventilo: { d: { m: [0.45, 0.45, 1.3] }, o: 'any', kg: 5, c: 'divers', grp: 6, ar: 'le' },
    gaz: { d: { m: [0.32, 0.32, 0.6] }, o: 'up', kg: 25, c: 'divers', grp: 7, ar: 'la', tip: 'debout, robinet fermé, près des portes' },
    velo: { d: { m: [1.7, 0.45, 1.0] }, o: 'up', kg: 15, c: 'divers', grp: 7, ar: 'le', tip: 'sanglé contre la paroi' },
    pot: { d: { p: [0.3, 0.3, 0.4], m: [0.45, 0.45, 0.7], g: [0.6, 0.6, 1.1] }, o: 'up', kg: { p: 8, m: 20, g: 40 }, c: 'fragile', grp: 7, ar: 'le', tip: 'dans un bac, chargé en dernier' },
    custom: { d: { p: [0.75, 0.5, 0.8], m: [0.9, 0.6, 0.9], g: [1.1, 0.7, 1.05] }, o: 'any', kg: 25, c: 'divers', top: 1, grp: 3, ar: '' },
    carton: { d: { p: [0.4, 0.3, 0.3], m: [0.55, 0.35, 0.35], g: [0.6, 0.4, 0.45] }, kg: { p: 12, m: 15, g: 18 }, c: 'carton', stack: 4 },
    sac: { d: { p: [0.5, 0.35, 0.25], m: [0.7, 0.45, 0.3], g: [0.8, 0.5, 0.35] }, kg: { p: 8, m: 12, g: 18 }, c: 'carton', stack: 3 }
  };
  ['buffet', 'meubletv', 'bureau', 'tbasse'].forEach(function (k) { C[k].end = 1; }); C.chaise.o = 'any';
  var COLORS = { elec: '#6FA8DC', meuble: '#C9A27E', literie: '#B7A6E0', salon: '#E39A6E', carton: '#D8B46A', fragile: '#F28CA0', divers: '#9DB7A8' };
  var LEG = [['elec', 'Électroménager'], ['meuble', 'Meubles'], ['literie', 'Literie'], ['salon', 'Salon'], ['carton', 'Cartons et sacs'], ['fragile', 'Fragile'], ['divers', 'Divers']];
  var SOFA = { 1: [1], 2: [2], 3: [3], 4: [2, 2], 5: [3, 2], 6: [3, 2, 1], 7: [3, 2, 1, 1], 8: [3, 3, 1, 1], 9: [3, 3, 2, 1], 10: [3, 3, 2, 2] };
  var WARD = { 1: [1], 2: [2], 3: [3], 4: [2, 2], 5: [3, 2], 6: [3, 3], 7: [3, 2, 2], 8: [3, 3, 2] };
  var cap = function (s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };
  var defOf = function (ar, n) { n = String(n || '').toLowerCase(); if (!ar) return 'l’objet « ' + n + ' »'; if (ar === 'les') return 'les ' + n; return /^[aeiouyéèêàâh]/i.test(n) ? 'l’' + n : ar + ' ' + n; };
  var kgOf = function (c, g) { return typeof c.kg === 'number' ? c.kg : (c.kg[g] || c.kg.m); };
  var dimOf = function (c, g) { return (c.d[g] || c.d.m).slice(); };

  function fitVol(d, target) {
    var v = d[0] * d[1] * d[2]; if (!(target > 0) || !(v > 0)) return d; var r = target / v; if (Math.abs(r - 1) < 0.005) return d;
    var ix = [0, 1, 2].sort(function (a, b) { return d[a] - d[b]; }), o = d.slice(), a = ix[0], b = ix[1], c = ix[2];
    if (r > 1) {
      if (o[a] * r <= o[b]) { o[a] *= r; return o; }
      var need = r / (o[b] / o[a]); o[a] = o[b];
      var s = Math.sqrt(need); if (o[a] * s <= o[c]) { o[a] *= s; o[b] *= s; return o; }
      var f2 = o[c] / o[a]; o[a] *= f2; o[b] *= f2; need /= f2 * f2; var u = Math.cbrt(need); return [o[0] * u, o[1] * u, o[2] * u];
    }
    var rem = r; [a, b, c].forEach(function (i, n) { if (rem >= 1 - 1e-9) return; var f = n < 2 ? Math.max(0.5, rem) : rem; o[i] *= f; rem /= f; });
    return o;
  }
  function units(input) {
    var out = [], pools = [], uid = 0;
    var pieces = [], push = function (u) { pieces.push(u); };
    var flush = function (q, v) { if (!pieces.length) return; var S = pieces.reduce(function (s, p) { return s + p.dims[0] * p.dims[1] * p.dims[2]; }, 0), r = v > 0 && S > 0 ? v / S : 1;
      pieces.forEach(function (p) { var dd = r === 1 ? p.dims : fitVol(p.dims, p.dims[0] * p.dims[1] * p.dims[2] * r); for (var i = 0; i < q; i++) out.push(Object.assign({ id: 'u' + (uid++) }, p, { dims: dd.slice() })); }); pieces = []; };
    (input.lines || []).forEach(function (l) {
      var q = Math.max(0, Math.round(+l.q || 0)); if (!q) return; var lv = +l.v || 0;
      var k = l.k, g = l.g || 'm', n = l.n || k, s = +l.s || 0;
      if (k === 'salon') {
        var n0 = Math.max(1, Math.min(10, s || 5)), pcs = SOFA[n0] || [3, 2];
        pcs.forEach(function (p) {
          var dm = p === 3 ? [2.1, 0.9, 0.85] : p === 2 ? [1.6, 0.9, 0.85] : [0.95, 0.9, 0.85];
          push({ seats: p, shape: 'sofa', k: k, label: p === 1 ? 'Fauteuil (salon ' + n0 + ' places)' : 'Canapé ' + p + ' places (salon ' + n0 + ' places)', def: p === 1 ? 'le fauteuil' : 'le canapé ' + p + ' places', dims: dm, o: 'any', kg: 20 + p * 12, c: 'salon', grp: 2, sofa: 1 });
        });
        flush(q, lv); return;
      }
      if (k === 'tablem') {
        var np = Math.max(2, s || 6), L = Math.min(3, 0.8 + 0.15 * np), W = np <= 4 ? 0.8 : np <= 8 ? 0.9 : 1.0;
        if (l.dm) push({ k: k, label: 'Table à manger ' + np + ' places (démontée)', def: 'le plateau de table', dims: [L, W, 0.12], o: 'edge', kg: 25 + 3 * np, c: 'meuble', grp: 2, tip: 'plateau sur la tranche, pieds en sachet', shape: 'panels' });
        else push({ k: k, label: 'Table à manger ' + np + ' places', def: 'la table à manger', dims: [L, W, 0.76], o: 'upBack', kg: 25 + 3 * np, c: 'meuble', top: 1, grp: 2, shape: 'table', end: 1 });
        flush(q, lv); return;
      }
      if (k === 'lit') {
        var nl = Math.max(1, Math.min(4, s || 2)), wl = [0.9, 1.4, 1.6, 1.8][nl - 1] + 0.1;
        if (l.dm) push({ k: k, label: 'Lit ' + nl + ' place' + (nl > 1 ? 's' : '') + ' (démonté)', def: 'le lit démonté', dims: [2.05, 1.0, 0.3], o: 'edge', kg: 30 + 10 * nl, c: 'literie', grp: 2, tip: 'panneaux sur la tranche, visserie en sachet', shape: 'panels', top: 1 });
        else push({ k: k, label: 'Lit ' + nl + ' place' + (nl > 1 ? 's' : '') + ' (monté)', def: 'le lit', dims: [2.05, wl, 0.9], o: 'any', kg: 30 + 10 * nl, c: 'literie', grp: 2, tip: 'debout sur le côté contre la paroi, sanglé', shape: 'bed', bedUp: 1 });
        flush(q, lv); return;
      }
      if (k === 'matelas') {
        var nm = Math.max(1, Math.min(4, s || 2)), wm = [0.9, 1.4, 1.6, 1.8][nm - 1];
        push({ k: k, label: 'Matelas ' + nm + ' place' + (nm > 1 ? 's' : ''), def: 'le matelas', dims: [1.95, wm, 0.22], o: 'edge', flex: 1, kg: 10 + 8 * nm, c: 'literie', grp: 3, tip: 'sur la tranche le long de la paroi, sert de tampon', shape: 'mattress' });
        flush(q, lv); return;
      }
      if (k === 'armoire') {
        var nb = Math.max(1, Math.min(8, s || 3)), mods = WARD[nb] || [3];
        mods.forEach(function (m, i) {
          var mw = 0.5 * m + 0.05, lab = 'Armoire ' + nb + ' battant' + (nb > 1 ? 's' : '') + (mods.length > 1 ? ' · module ' + (i + 1) : '');
          if (l.dm) push({ k: k, label: lab + ' (démontée)', def: 'les panneaux d’armoire', dims: [1.95, 0.6, 0.12 + 0.06 * m], o: 'edge', kg: 25 + 20 * m, c: 'meuble', grp: 1, tip: 'panneaux sur la tranche, portes à part, visserie en sachet', shape: 'panels', top: 1 });
          else push({ k: k, label: lab, def: 'l’armoire', dims: [mw, 0.6, 1.95], o: 'upBack', kg: 30 + 25 * m, c: 'meuble', top: 1, grp: 1, tip: 'vidée, portes scotchées', shape: 'armoire', bat: m });
        });
        flush(q, lv); return;
      }
      var c = C[k] || C.custom;
      if (c.stack) { pools.push({ k: k, g: g, n: q, dims: lv > 0 ? fitVol(dimOf(c, g), lv) : dimOf(c, g), kg: kgOf(c, g), name: k === 'carton' ? 'carton' : 'sac', max: c.stack }); return; }
      var gl = l.gl ? ' (' + l.gl + ')' : '';
      push({ k: k, label: cap(n) + gl + (l.dm && k === 'bureau' ? ' (démonté)' : ''), def: defOf(c.ar, n), dims: dimOf(c, g), o: k === 'bureau' && l.dm ? 'edge' : c.o, kg: kgOf(c, g), c: c.c, top: c.top, hv: c.hv, grp: c.grp, tip: c.tip, end: c.end, shape: k === 'bureau' && l.dm ? 'panels' : k, sz: g });
      flush(q, lv);
    });
    var ax = +input.annex || 0;
    if (ax > 0.03) { var cm = C.carton.d.m, nA = Math.max(1, Math.round(ax / (cm[0] * cm[1] * cm[2]))); if (nA > 0) pools.push({ k: 'carton', g: 'm', n: nA, dims: fitVol(cm.slice(), ax / nA), kg: 15, name: 'carton', max: 4, annex: 1 }); }
    out.forEach(function (u) { if (u.kg > 40 && !u.sofa && u.shape !== 'panels' && u.shape !== 'bed' && u.shape !== 'mattress' && u.shape !== 'table') u.hv = 1; u.vol = u.dims[0] * u.dims[1] * u.dims[2]; u.oris = oris(u); });
    return { units: out, pools: pools };
  }
  function oris(u) {
    var l = u.dims[0], w = u.dims[1], h = u.dims[2], out = [];
    var add = function (dx, dy, dz, t, pen) { for (var i = 0; i < out.length; i++) if (Math.abs(out[i].dx - dx) < E && Math.abs(out[i].dy - dy) < E && Math.abs(out[i].dz - dz) < E) return; out.push({ dx: dx, dy: dy, dz: dz, t: t, pen: pen }); };
    if (u.bedUp) { add(l, w, h, 'dos', 0); add(h, w, l, 'dos', 0.05); add(l, h, w, 'nat', 1.5); add(w, h, l, 'nat', 1.5); return out; }
    if (u.o === 'edge') { add(l, w, h, 'tranche', 0); add(h, w, l, 'tranche', 0.05); add(w, l, h, 'debout', 0.1); add(h, l, w, 'debout', 0.15); add(l, h, w, 'plat', 1.2); add(w, h, l, 'plat', 1.2); }
    else {
      add(l, h, w, 'nat', 0); add(w, h, l, 'nat', 0.02);
      if (u.o === 'upBack' || u.o === 'any') { add(l, w, h, 'dos', 0.5); add(h, w, l, 'dos', 0.5); }
      if (u.o === 'any') { add(w, l, h, 'cote', u.sofa ? 0.12 : 0.3); add(h, l, w, 'cote', u.sofa ? 0.12 : 0.3); }
      if (u.end && u.o === 'upBack') { add(w, l, h, 'cote', 0.35); add(h, l, w, 'cote', 0.35); }
    }
    return out;
  }
  function Bin(V) {
    this.V = V; this.boxes = []; this.kgL = 0; this.kgR = 0; this.eps = [{ x: 0, y: 0, z: 0 }];
    var self = this; (V.arches || []).forEach(function (a) { self.put(Object.assign({ arch: 1, top: 1 }, a)); });
  }
  Bin.prototype.ov = function (a) { var B = this.boxes; for (var i = 0; i < B.length; i++) { var b = B[i]; if (a.x < b.x + b.dx - E && b.x < a.x + a.dx - E && a.z < b.z + b.dz - E && b.z < a.z + a.dz - E && a.y < b.y + b.dy - E && b.y < a.y + a.dy - E) return true; } return false; };
  Bin.prototype.sup = function (a, rq, u) {
    var need = a.dx * a.dz, area = 0, main = null, best = 0, B = this.boxes, cx = a.x + a.dx / 2, cz = a.z + a.dz / 2, cg = false;
    for (var i = 0; i < B.length; i++) {
      var b = B[i]; if (Math.abs(b.y + b.dy - a.y) > 0.004) continue;
      var ox = Math.min(a.x + a.dx, b.x + b.dx) - Math.max(a.x, b.x), oz = Math.min(a.z + a.dz, b.z + b.dz) - Math.max(a.z, b.z);
      if (ox <= E || oz <= E) continue; if (!b.top) return null; if (u && b.kg != null && u.kg > 15 && u.kg > b.kg * 1.5) return null;
      area += ox * oz; if (ox * oz > best) { best = ox * oz; main = b; } if (cx >= b.x - E && cx <= b.x + b.dx + E && cz >= b.z - E && cz <= b.z + b.dz + E) cg = true;
    }
    return cg && area >= need * (rq || 0.75) - E ? (main || true) : null;
  };
  Bin.prototype.pd = function (p) { var y = 0, B = this.boxes; for (var i = 0; i < B.length; i++) { var b = B[i]; if (p.x >= b.x - E && p.x < b.x + b.dx - E && p.z >= b.z - E && p.z < b.z + b.dz - E) { var t = b.y + b.dy; if (t <= p.y + E && t > y) y = t; } } return y; };
  Bin.prototype.pb = function (p) { var x = 0, B = this.boxes; for (var i = 0; i < B.length; i++) { var b = B[i]; if (p.y >= b.y - E && p.y < b.y + b.dy - E && p.z >= b.z - E && p.z < b.z + b.dz - E) { var t = b.x + b.dx; if (t <= p.x + E && t > x) x = t; } } return x; };
  Bin.prototype.pl = function (p) { var z = 0, B = this.boxes; for (var i = 0; i < B.length; i++) { var b = B[i]; if (p.x >= b.x - E && p.x < b.x + b.dx - E && p.y >= b.y - E && p.y < b.y + b.dy - E) { var t = b.z + b.dz; if (t <= p.z + E && t > z) z = t; } } return z; };
  Bin.prototype.put = function (b) {
    this.boxes.push(b); if (!b.arch && b.kg) { var lf0 = Math.max(0, Math.min(1, (this.V.W / 2 - b.z) / b.dz)); this.kgL += b.kg * lf0; this.kgR += b.kg * (1 - lf0); }
    var V = this.V, self = this, cs = [{ x: b.x + b.dx, y: b.y, z: b.z }, { x: b.x, y: b.y + b.dy, z: b.z }, { x: b.x, y: b.y, z: b.z + b.dz }], add = [];
    cs.forEach(function (p) { add.push(p, { x: p.x, y: self.pd(p), z: p.z }, { x: self.pb(p), y: p.y, z: p.z }, { x: p.x, y: p.y, z: self.pl(p) }); });
    var all = this.eps.concat(add), seen = {}, B = this.boxes, keep = [];
    for (var i = 0; i < all.length; i++) {
      var p = all[i]; if (p.x >= V.L - E || p.y >= V.H - E || p.z >= V.W - E) continue;
      var key = Math.round(p.x * 1000) + ',' + Math.round(p.y * 1000) + ',' + Math.round(p.z * 1000); if (seen[key]) continue; seen[key] = 1;
      var inside = false; for (var j = 0; j < B.length; j++) { var q = B[j]; if (p.x >= q.x - E && p.x < q.x + q.dx - E && p.y >= q.y - E && p.y < q.y + q.dy - E && p.z >= q.z - E && p.z < q.z + q.dz - E) { inside = true; break; } }
      if (!inside) keep.push(p);
    }
    this.eps = keep;
  };
  Bin.prototype.find = function (u, oList) {
    var V = this.V, best = null, P = this.eps;
    for (var i = 0; i < P.length; i++) {
      var p = P[i]; if (u.hv && p.y > E) continue;
      for (var j = 0; j < oList.length; j++) {
        var o = oList[j]; if (u.flex && p.y + o.dy > V.H + E && p.y + o.dy <= V.H + 0.08) o = Object.assign({}, o, { dy: V.H - p.y }); if (p.x + o.dx > V.L + E || p.y + o.dy > V.H + E || p.z + o.dz > V.W + E) continue;
        var s = p.x * 3 + p.y * 0.9 + Math.min(p.z, V.W - p.z - o.dz) * 0.15 + o.pen + (u.grp === 7 ? -p.x * 6 : 0);
        var wd = Math.min(p.z, V.W - p.z - o.dz); if (u.o === 'edge') s += wd * 0.5;
        
        var frag = u.c === 'fragile';
        if (best && s - (frag ? 0.8 : 0) >= best.s) continue;
        var a = { x: p.x, y: p.y, z: p.z, dx: o.dx, dy: o.dy, dz: o.dz };
        if (this.ov(a)) continue;
        var m = p.y > E ? this.sup(a, u.flex ? 0.5 : 0.75, u) : true; if (!m) continue;
        if (frag) { var bonus = 0, Bx0 = this.boxes; if (a.z < 0.01 || a.z + a.dz > V.W - 0.01) bonus = 0.3;
          for (var ci = 0; ci < Bx0.length; ci++) { var cb = Bx0[ci]; if (!cb.u || !(cb.u.sofa || cb.u.shape === 'mattress' || cb.u.shape === 'matelas')) continue;
            var oy = Math.min(a.y + a.dy, cb.y + cb.dy) - Math.max(a.y, cb.y); if (oy <= 0.05) continue;
            var tx = (Math.abs(a.x - cb.x - cb.dx) < 0.01 || Math.abs(cb.x - a.x - a.dx) < 0.01) && Math.min(a.z + a.dz, cb.z + cb.dz) - Math.max(a.z, cb.z) > 0.05, tz = (Math.abs(a.z - cb.z - cb.dz) < 0.01 || Math.abs(cb.z - a.z - a.dz) < 0.01) && Math.min(a.x + a.dx, cb.x + cb.dx) - Math.max(a.x, cb.x) > 0.05;
            if (tx || tz) { bonus = 0.8; break; } }
          s -= bonus; if (best && s >= best.s) continue; }
        best = { a: a, s: s, o: o, on: m === true ? null : m };
      }
    }
    if (u.sofa) {
      var Bx = this.boxes;
      for (var qi = 0; qi < Bx.length; qi++) { var q = Bx[qi]; if (!q.u || !q.u.sofa || q.t !== 'nat' || q.nested || q.nest) continue;
        for (var oj = 0; oj < oList.length; oj++) { var o = oList[oj]; var oL = Math.max(o.dx, o.dz), qL = Math.max(q.dx, q.dz); if (o.t !== 'nat' || (o.dx >= o.dz) !== (q.dx >= q.dz) || o.dx > q.dx + E || o.dz > q.dz + E || oL < qL - 0.15) continue;
          var y = q.y + Math.max(0.7 * q.dy, q.dy - 0.3 * o.dy); if (y + o.dy > V.H + E) continue;
          var a = { x: q.x + (q.dx - o.dx) / 2, y: y, z: q.z + (q.dz - o.dz) / 2, dx: o.dx, dy: o.dy, dz: o.dz }, bad = false;
          for (var k = 0; k < Bx.length; k++) { var c = Bx[k]; if (c === q) continue; if (a.x < c.x + c.dx - E && c.x < a.x + a.dx - E && a.y < c.y + c.dy - E && c.y < a.y + a.dy - E && a.z < c.z + c.dz - E && c.z < a.z + a.dz - E) { bad = true; break; } }
          if (bad || (u.kg > 15 && u.kg > q.kg * 1.5)) continue;
          var sN = a.x * 3 + a.y * 0.9 - 2; if (!best || sN < best.s) best = { a: a, s: sN, o: { dx: o.dx, dy: o.dy, dz: o.dz, t: 'inv', pen: 0 }, on: q, nest: true };
        }
      }
    }
    return best;
  };
  Bin.prototype.place = function (u, f) { var b = Object.assign({}, f.a, { u: u, t: f.o.t, on: f.on, top: f.nest ? 1 : u.top, kg: u.kg, nest: !!f.nest }); if (f.nest) f.on.nested = true; this.put(b); return b; };

  function vehicle(dm) {
    var L = +dm.L || 0, W = +dm.W || 0, H = +dm.H || 0, P = Math.min(+dm.P || W, W), aH = +dm.archH || 0.3, aL = Math.min(+dm.archL || 0.95, L);
    var arches = [];
    if (W - P > 0.01 && L > 0) { var ax = Math.max(0, Math.min(L - aL, L * 0.58 - aL / 2)), aw = (W - P) / 2; arches.push({ x: ax, y: 0, z: 0, dx: aL, dy: aH, dz: aw }, { x: ax, y: 0, z: W - aw, dx: aL, dy: aH, dz: aw }); }
    var net = L * W * H - arches.reduce(function (s, a) { return s + a.dx * a.dy * a.dz; }, 0);
    return { L: L, W: W, H: H, P: P, arches: arches, net: net, stock: dm.stock == null ? 20 : +dm.stock, blkL: +dm.blkL || BLK.L, blkW: +dm.blkW || BLK.W };
  }

  function balanceBin(bn, V) {
    var bx = bn.boxes.filter(function (b) { return !b.arch; }).sort(function (a, b) { return a.x - b.x; }), cl = [], cur = null;
    bx.forEach(function (b) { if (cur && b.x < cur.x1 - 1e-6) { cur.b.push(b); cur.x1 = Math.max(cur.x1, b.x + b.dx); } else { cur = { b: [b], x1: b.x + b.dx }; cl.push(cur); } });
    if (cl.length > 12) return;
    cl.forEach(function (c) { c.l = 0; c.r = 0; c.b.forEach(function (b) { var lf = Math.max(0, Math.min(1, (V.W / 2 - b.z) / b.dz)); c.l += (b.kg || 0) * lf; c.r += (b.kg || 0) * (1 - lf); }); });
    var best = -1, bestD = Infinity;
    for (var m = 0; m < (1 << cl.length); m++) { var L = 0, Rr = 0; for (var i = 0; i < cl.length; i++) { if (m & (1 << i)) { L += cl[i].r; Rr += cl[i].l; } else { L += cl[i].l; Rr += cl[i].r; } } var d = Math.abs(L - Rr) + (m ? 1e-3 : 0) * cl.length; if (d < bestD - 1e-6) { bestD = d; best = m; } }
    cl.forEach(function (c, i) { if (best & (1 << i)) c.b.forEach(function (b) { b.z = V.W - b.z - b.dz; }); });
  }
  function packWith(list, pools, V) {
    var bins = [], out = [];
    var tryAll = function (u) { for (var i = 0; i < bins.length; i++) { var f = bins[i].find(u, u.oris); if (f) { bins[i].place(u, f); return true; } } var nb = new Bin(V), f2 = nb.find(u, u.oris); if (f2) { nb.place(u, f2); bins.push(nb); return true; } return false; };
    var late = list.filter(function (u) { return (u.grp || 3) >= 6; });
    list.filter(function (u) { return (u.grp || 3) < 6; }).forEach(function (u) { if (!tryAll(u)) out.push(u); });
    var cid = 0;
    pools.forEach(function (pl) {
      var n = pl.n, l = pl.dims[0], w = pl.dims[1], h = pl.dims[2], kmax = Math.max(1, Math.min(pl.max, Math.floor((V.H - 0.02) / h)));
      var mk = function (k) { var u = { id: 'c' + (cid++), k: pl.k, stackOf: k, ph: h, label: k > 1 ? 'Pile de ' + k + ' ' + pl.name + 's' : '1 ' + pl.name, def: k > 1 ? 'la pile de ' + pl.name + 's' : 'le ' + pl.name, dims: [l, w, h * k], c: 'carton', top: 1, kg: pl.kg * k, grp: 5, tip: pl.annex ? 'affaires annexes (linge, vaisselle…), lourds en bas' : 'lourds en bas, légers en haut' }; u.shape = pl.k; u.oris = [{ dx: l, dy: h * k, dz: w, t: 'nat', pen: 0 }, { dx: w, dy: h * k, dz: l, t: 'nat', pen: 0.02 }]; return u; };
      var guard = 0;
      while (n > 0 && guard++ < 2000) {
        var done = false;
        for (var i = 0; i < bins.length && !done; i++) for (var k = Math.min(kmax, n); k >= 1; k--) { var u = mk(k), f = bins[i].find(u, u.oris); if (f) { bins[i].place(u, f); n -= k; done = true; break; } }
        if (!done) { var nb = new Bin(V), u2 = mk(Math.min(kmax, n)), f2 = nb.find(u2, u2.oris); if (!f2) { out.push(mk(n)); break; } nb.place(u2, f2); bins.push(nb); n -= u2.stackOf; }
      }
    });
    var retry = out.filter(function (u) { return !u.stackOf; }); out = out.filter(function (u) { return u.stackOf; });
    retry.concat(late).forEach(function (u) { if (!tryAll(u)) out.push(u); });
    bins.forEach(function (bn) { balanceBin(bn, V); });
    return { bins: bins, out: out };
  }

  function orientTxt(b) {
    var u = b.u, t = b.t, long = Math.max(b.dx, b.dz) >= 1 ? (b.dx >= b.dz ? ', dans la longueur' : ', en travers') : '';
    if (u.stackOf) return 'empilés';
    if (t === 'inv') return 'retourné à l’envers, assise contre assise';
    if (t === 'tranche') return 'sur la tranche' + long;
    if (t === 'debout') return 'debout sur la largeur';
    if (t === 'plat') return 'à plat' + long;
    if (t === 'dos') return u.bedUp ? 'debout sur le côté' + long : 'couché sur le dos' + long;
    if (t === 'cote') return u.sofa ? 'à la verticale sur l’accoudoir' : u.end ? 'debout sur l’extrémité' : 'sur le côté';
    if (u.sofa) return 'sur ses pieds' + long;
    if (u.o === 'up') return 'debout' + long;
    return (b.dy >= 0.9 * Math.max(b.dx, b.dz) ? 'debout' : 'à l’endroit') + long;
  }

  var BLK = { L: 2.04, W: 1.84 }, BLK_A = BLK.L * BLK.W, BLK_OV = 1.15;
  function blkNeed(mode, dx, dy, dz, A) { A = A > 0.05 ? A : BLK_A;
    var big = Math.max(dx, dz), sm = Math.min(dx, dz), a;
    if (mode === 'full') a = dx * dz + 2 * (dx * dy + dz * dy);
    else if (mode === 'front') a = big * dy + 2 * sm * dy;
    else if (mode === 'top3') a = dx * dz + big * dy + 2 * sm * dy * 0.5;
    else if (mode === 'top') a = dx * dz + 2 * (dx + dz) * Math.min(dy, 0.25);
    else if (mode === 'fold') a = 2 * big * dy;
    else if (mode === 'between') a = Math.max(dx * dy, dz * dy, dx * dz);
    else a = Math.max(dx * dy, dz * dy);
    return { n: Math.max(1, Math.ceil(a * BLK_OV / A - 0.05)), a: a };
  }
  var PROT = {
    tv: [1, 'fold', 'écran enveloppé dans une serviette pliée en deux, côté écran contre la paroi'], vitrine: [1, 'front', 'serviettes sur toutes les vitres, portes fermées'], coiffeuse: [1, 'fold', 'miroir enveloppé dans une serviette pliée en deux'],
    frigo: [2, 'front', 'serviette sur la façade et les côtés, sangle par-dessus'], congel: [2, 'top3', 'serviette sur le couvercle et la façade'], mal: [2, 'top3', 'serviette sur le hublot et le dessus'], cuisiniere: [2, 'top3', 'serviette sur la vitre du four et les plaques'],
    armoire: [2, 'full', 'enveloppée entièrement, angles d’abord, portes fermées'], buffet: [2, 'full', 'enveloppé entièrement, angles d’abord'], panels: [3, 'between', 'une serviette entre les panneaux, faces finies l’une contre l’autre'],
    biblio: [3, 'full', 'enveloppée entièrement, angles d’abord'], commode: [3, 'full', 'enveloppée entièrement, angles d’abord'], meubletv: [3, 'top3', 'dessus et façade couverts'], bureau: [3, 'top', 'plateau et angles couverts'], table: [3, 'top', 'plateau enveloppé, pieds couverts'], tbasse: [3, 'top', 'plateau enveloppé'],
    sofa3: [3, 'full', 'accoudoirs et dossier couverts ; serviette entre deux canapés empilés'], sofa2: [3, 'full', 'accoudoirs et dossier couverts ; serviette entre deux canapés empilés'], sofa1: [4, 'full', 'accoudoirs et dossier couverts'],
    micro: [4, 'full', 'enveloppé dans une serviette'], clim: [4, 'front', 'serviette sur la grille et les raccords'], chevet: [4, 'full', 'enveloppée'], bed: [4, 'face', 'serviette sur la tête de lit'], custom: [4, 'full', 'enveloppé'],
    chaise: [5, 'face', 'serviette entre les chaises voisines'], velo: [5, 'face', 'serviette entre le vélo et les meubles voisins']
  };
  function protOf(u) { if (u.stackOf) return null; var k = u.sofa ? 'sofa' + (u.seats || 1) : u.shape === 'panels' ? 'panels' : u.shape === 'bed' ? 'bed' : u.shape === 'table' ? 'table' : u.k; return PROT[k] || null; }
  function describe(bin, V, ti) {
    var items = bin.boxes.filter(function (b) { return !b.arch; }), nT = Math.max(1, Math.round(V.L / 0.65)), T = V.L / nT;
    items.forEach(function (b) {
      b.wall = Math.min(nT, Math.floor((b.x + E) / T) + 1);
      b.deps = (b.nest && b.on ? [b.on] : []).concat(bin.boxes.filter(function (q) { return q !== b && !q.arch && Math.abs(q.y + q.dy - b.y) < 0.004 && Math.min(b.x + b.dx, q.x + q.dx) - Math.max(b.x, q.x) > E && Math.min(b.z + b.dz, q.z + q.dz) - Math.max(b.z, q.z) > E; }));
    });
    var rest = items.slice(), seq = [], doneSet = new Set();
    rest.sort(function (a, b) { return a.wall - b.wall || a.y - b.y || a.z - b.z || a.x - b.x; });
    while (rest.length) {
      var idx = rest.findIndex(function (b) { return b.deps.every(function (q) { return doneSet.has(q); }); }); if (idx < 0) idx = 0;
      var b = rest.splice(idx, 1)[0]; doneSet.add(b); seq.push(b);
    }
    var kg = 0, kL = 0, kF = 0, vol = 0;
    seq.forEach(function (b, i) {
      b.step = i + 1; b.id = 't' + ti + '-' + i;
      var zc = b.z + b.dz / 2, side = b.dz >= 0.8 * V.W ? 'sur toute la largeur' : zc < V.W / 3 ? 'côté gauche' : zc > 2 * V.W / 3 ? 'côté droit' : 'au centre';
      var where = b.y < E ? 'au sol' : b.on && b.on.arch ? 'sur le passage de roue' : b.on && b.on.u ? 'sur ' + b.on.u.def : 'en hauteur';
      b.txt = cap(orientTxt(b)) + ', ' + side + ', ' + where + '.';
      b.tip = b.u.tip || ''; if ((b.u.hv || b.u.grp === 1) && b.y < E && b.x > V.L * 0.45) b.tip = (b.tip ? b.tip + ' ; ' : '') + 'lourd placé vers les portes pour gagner un aller-retour : sanglé fermement à la paroi';
      var pr = protOf(b.u), bn = pr ? blkNeed(pr[1], b.dx, b.dy, b.dz, (+V.blkL || 0) * (+V.blkW || 0)) : null; b.pPrio = pr ? pr[0] : 9; b.need = bn ? bn.n : 0; b.blkA = bn ? bn.a : 0; b.how = pr ? pr[2] : ''; b.prot = 0;
      kg += b.kg; vol += b.dx * b.dy * b.dz;
      var lf = Math.max(0, Math.min(1, (V.W / 2 - b.z) / b.dz)); kL += b.kg * lf; kF += b.kg * Math.max(0, Math.min(1, (V.L / 2 - b.x) / b.dx));
    });
    var left = Math.max(0, +V.stock || 0), byP = seq.filter(function (b) { return b.need > 0; }).sort(function (a, b) { return a.pPrio - b.pPrio || b.dx * b.dy * b.dz - a.dx * a.dy * a.dz; });
    byP.forEach(function (b) { var g = Math.min(b.need, left); b.prot = g; left -= g; });
    seq.forEach(function (b) { b.protTxt = b.need ? (b.prot ? 'Couvert par ' + b.prot + ' serviette' + (b.prot > 1 ? 's' : '') + ' : ' + b.how + (b.prot < b.need ? ' (il en faudrait ' + b.need + ')' : '') : 'Sans serviette (stock épuisé) : caler contre un matelas ou des cartons') : ''; });
    var walls = [];
    seq.forEach(function (b) { var w = walls[walls.length - 1]; if (!w || w.n !== b.wall) { w = { n: b.wall, steps: [] }; walls.push(w); } w.steps.push(b); });
    walls.forEach(function (w, i) { w.title = 'Mur ' + w.n + (w.n === 1 ? ' · contre la cabine' : '') + (i === walls.length - 1 && walls.length > 1 ? ' · côté portes, déchargé en premier' : ''); });
    var lP = kg ? Math.round(kL / kg * 100) : 50, fP = kg ? Math.round(kF / kg * 100) : 50, nHv = seq.filter(function (b) { return b.u.hv; }), hvFront = nHv.every(function (b) { return b.x < V.L * 0.45; });
    var checks = [{ ok: lP >= 40 && lP <= 60, short: 'équilibre gauche/droite ' + lP + '/' + (100 - lP), txt: 'Équilibre gauche / droite : ' + lP + ' % / ' + (100 - lP) + ' %' + (lP >= 40 && lP <= 60 ? '' : ' : rééquilibrer') },
      { ok: fP >= 50, short: 'avant ' + fP + ' %', txt: 'Charge vers l’avant : ' + fP + ' %' + (fP >= 50 ? '' : ' : rapprocher le lourd de la cabine') },
      { ok: hvFront, short: 'lourd contre la cabine', txt: hvFront ? 'Électroménager et lourd au sol côté cabine' : 'Un objet lourd est vers les portes : bien le sangler' }];
    var tall = seq.filter(function (b) { return (!b.u.stackOf && b.dy >= 1.4) || b.u.k === 'velo' || b.u.k === 'gaz'; }).length;
    return { boxes: seq, walls: walls, kg: Math.round(kg), left: kg ? Math.round(kL / kg * 100) : 50, front: kg ? Math.round(kF / kg * 100) : 50, vol: vol, fill: V.net ? Math.min(100, Math.round(vol / V.net * 100)) : 0, nItems: seq.reduce(function (s, b) { return s + (b.u.stackOf || 1); }, 0), straps: walls.reduce(function (t, w) { var m = w.steps.reduce(function (q, b) { return q + (b.kg || 0); }, 0); return t + Math.max(2, Math.ceil(m * 9.81 * 0.2 / 5600)); }, 0) + tall, checks: checks, blankets: seq.reduce(function (s, b) { return s + b.prot; }, 0), need: seq.reduce(function (s, b) { return s + b.need; }, 0), noProt: seq.filter(function (b) { return b.need > 0 && !b.prot; }).length, stock: +V.stock || 0, housses: seq.filter(function (b) { return b.u.k === 'matelas'; }).length, tierLen: T, nTiers: nT };
  }

  var memo = {};
  function plan(input) {
    var key = JSON.stringify(input); if (memo[key]) return memo[key];
    var V = vehicle(Object.assign({}, input.veh || {}, { stock: input.stock, blkL: input.blk && input.blk.L, blkW: input.blk && input.blk.W })); if (!(V.L > 0 && V.W > 0 && V.H > 0)) return { trips: [], out: [], V: V, empty: true };
    var U = units(input);
    if (!U.units.length && !U.pools.length) return { trips: [], out: [], V: V, empty: true };
    var lbTrips = Math.max(1, Math.ceil((U.units.reduce(function (s, u) { return s + u.vol; }, 0) + U.pools.reduce(function (s, p) { return s + p.n * p.dims[0] * p.dims[1] * p.dims[2]; }, 0)) / V.net));
    var A = U.units.slice().sort(function (a, b) { return (a.grp || 3) - (b.grp || 3) || b.vol - a.vol; });
    var R = packWith(A, U.pools, V);
    if (R.bins.length > lbTrips) { var B2 = packWith(U.units.slice().sort(function (a, b) { return b.vol - a.vol; }), U.pools, V); if (B2.bins.length < R.bins.length && B2.out.length <= R.out.length) R = B2; }
    if (R.bins.length > lbTrips) { var fp = function (u) { return u.dims[0] * u.dims[1]; }, B3 = packWith(U.units.slice().sort(function (a, b) { return (a.hv ? 0 : 1) - (b.hv ? 0 : 1) || fp(b) - fp(a); }), U.pools, V); if (B3.bins.length < R.bins.length && B3.out.length <= R.out.length) R = B3; }
    var front = function (Rr) { return Rr.bins.reduce(function (t, bn) { return t + bn.boxes.reduce(function (q, b) { return q + (b.u && (b.u.hv || b.u.grp === 1) ? b.kg * b.x : 0); }, 0); }, 0); };
    var qual = function (Rr) { return Rr.bins.reduce(function (t, bn) { var L0 = 0, Rt = 0, F0 = 0, K = 0; bn.boxes.forEach(function (b) { if (b.arch || !b.kg) return; var lf2 = Math.max(0, Math.min(1, (V.W / 2 - b.z) / b.dz)), ff = Math.max(0, Math.min(1, (V.L / 2 - b.x) / b.dx)); L0 += b.kg * lf2; Rt += b.kg * (1 - lf2); F0 += b.kg * ff; K += b.kg; }); if (!K) return t; var lp = L0 / K * 100, fp = F0 / K * 100; return t + Math.max(0, Math.abs(lp - 50) - 10) * 2 + Math.max(0, 50 - fp); }, 0); };
    var better = function (X1, X0) { if (X1.out.length !== X0.out.length) return X1.out.length < X0.out.length; if (X1.bins.length !== X0.bins.length) return X1.bins.length < X0.bins.length; var q1 = qual(X1), q0 = qual(X0); if (Math.abs(q1 - q0) > 0.5) return q1 < q0; return front(X1) < front(X0) - 1e-6; };
    var seed = 7, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (var it = 0; it < 90; it++) { var noise = {}; U.units.forEach(function (u) { noise[u.id] = 0.5 + rnd(); });
      var Bt = packWith(U.units.slice().sort(function (a, b) { var ga = it % 3 === 2 ? 0 : it % 3 ? (a.grp === 1 ? 0 : (a.grp || 3) >= 6 ? 2 : 1) : (a.grp || 3), gb = it % 3 === 2 ? 0 : it % 3 ? (b.grp === 1 ? 0 : (b.grp || 3) >= 6 ? 2 : 1) : (b.grp || 3); return ga - gb || b.vol * noise[b.id] - a.vol * noise[a.id]; }), U.pools, V);
      if (better(Bt, R)) R = Bt; if (R.bins.length <= lbTrips && qual(R) < 0.5 && it >= 30) break; }
    var trips = R.bins.map(function (b, i) { return describe(b, V, i); });
    var fm = function (n) { return n.toFixed(2).replace('.', ',') + ' m'; };
    var res = { trips: trips, out: R.out.map(function (u) { return u.o === 'up' && u.dims[2] > V.H ? u.label + ' : doit rester debout (' + fm(u.dims[2]) + ' pour ' + fm(V.H) + ' de hauteur)' : u.label + ' : trop grand pour ce véhicule'; }), V: V, empty: false, colors: COLORS, legend: LEG };
    var ks = Object.keys(memo); if (ks.length > 40) delete memo[ks[0]];
    memo[key] = res; return res;
  }

  function View(el, opts) {
    this.el = el; this.opts = opts || {}; var T = window.THREE;
    el.innerHTML = ''; this.ok = false;
    if (!T) { el.innerHTML = '<div style="padding:16px;color:#AEB4BB;font-size:13px">Affichage 3D en cours de chargement…</div>'; return; }
    try { this.r = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); } catch (e) { el.innerHTML = '<div style="padding:16px;color:#AEB4BB;font-size:13px">La 3D n’est pas disponible sur cet appareil.</div>'; return; }
    this.ok = true; var r = this.r, self = this;
    if (T.ColorManagement && 'legacyMode' in T.ColorManagement) T.ColorManagement.legacyMode = false;
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setClearColor(0x1E2023, 1); if (T.sRGBEncoding) r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.1; r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
    var cv = r.domElement; cv.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab'; el.appendChild(cv);
    this.tip = document.createElement('div'); this.tip.style.cssText = 'position:absolute;pointer-events:none;display:none;background:#272A2E;border:1px solid #3B4046;color:#fff;font:700 12px Montserrat,sans-serif;padding:6px 9px;border-radius:8px;white-space:nowrap;z-index:2;box-shadow:0 6px 16px rgba(0,0,0,.4)'; el.appendChild(this.tip);
    this.scene = new T.Scene(); this.cam = new T.PerspectiveCamera(38, 1, 0.05, 200);
    this.scene.add(new T.HemisphereLight(0xffffff, 0x2A2D31, 0.95));
    var dl = new T.DirectionalLight(0xffffff, 0.9); dl.position.set(3, 7, 4); dl.castShadow = true; dl.shadow.mapSize.set(1024, 1024); var shc = dl.shadow.camera; shc.left = -4; shc.right = 4; shc.top = 4; shc.bottom = -4; shc.near = 0.5; shc.far = 25; dl.shadow.bias = -0.0006; dl.shadow.normalBias = 0.02; this.scene.add(dl);
    var dl2 = new T.DirectionalLight(0xffffff, 0.25); dl2.position.set(-4, 3, -3); this.scene.add(dl2);
    this.root = new T.Group(); this.scene.add(this.root);
    this.tgt = new T.Vector3(); this.sph = new T.Spherical(8, 1, 0.8); this.meshes = [];
    this.ptrs = {}; this.drag = null; this.ray = new T.Raycaster(); this.mv = new T.Vector2();
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    cv.addEventListener('pointerdown', function (e) { cv.setPointerCapture(e.pointerId); self.ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; self.drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, pan: e.button === 2 || e.shiftKey, moved: false }; cv.style.cursor = 'grabbing'; self.tip.style.display = 'none'; });
    cv.addEventListener('pointermove', function (e) {
      var ids = Object.keys(self.ptrs);
      if (self.ptrs[e.pointerId] && ids.length === 2) {
        var o = ids.map(function (k) { return self.ptrs[k]; }), d0 = Math.hypot(o[0].x - o[1].x, o[0].y - o[1].y); self.ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
        var n = ids.map(function (k) { return self.ptrs[k]; }), d1 = Math.hypot(n[0].x - n[1].x, n[0].y - n[1].y); if (d0 > 0 && d1 > 0) self.zoom(d0 / d1); if (self.drag) self.drag.moved = true; return;
      }
      if (self.drag && self.ptrs[e.pointerId]) {
        var dx = e.clientX - self.drag.x, dy = e.clientY - self.drag.y; self.drag.x = e.clientX; self.drag.y = e.clientY; self.ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
        if (Math.abs(e.clientX - self.drag.sx) + Math.abs(e.clientY - self.drag.sy) > 4) self.drag.moved = true;
        if (self.drag.pan) self.pan(dx, dy); else { self.sph.theta -= dx * 0.008; self.sph.phi = Math.max(0.04, Math.min(Math.PI / 2 + 0.25, self.sph.phi - dy * 0.008)); self.upd(); }
        return;
      }
      self.hover(e);
    });
    var up = function (e) { delete self.ptrs[e.pointerId]; var d = self.drag; if (!Object.keys(self.ptrs).length) { self.drag = null; cv.style.cursor = 'grab'; } if (d && !d.moved && e.type === 'pointerup') { var it = self.pick(e); if (it && self.opts.onPick) self.opts.onPick(it.b.step); } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', function () { self.tip.style.display = 'none'; self.hl(null); });
    cv.addEventListener('wheel', function (e) { e.preventDefault(); self.zoom(e.deltaY > 0 ? 1.1 : 1 / 1.1); }, { passive: false });
    this.ro = new ResizeObserver(function () { self.size(); }); this.ro.observe(el); this.size();
  }
  View.prototype.size = function () { if (!this.ok) return; var w = this.el.clientWidth || 300, h = this.el.clientHeight || 300; this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); this.req(); };
  View.prototype.zoom = function (f) { this.sph.radius = Math.max(this.R * 0.5, Math.min(this.R * 8, this.sph.radius * f)); this.upd(); };
  View.prototype.pan = function (dx, dy) { var T = window.THREE, s = this.sph.radius * 0.0016, m = this.cam.matrix, xa = new T.Vector3().setFromMatrixColumn(m, 0), ya = new T.Vector3().setFromMatrixColumn(m, 1); this.tgt.addScaledVector(xa, -dx * s).addScaledVector(ya, dy * s); this.upd(); };
  View.prototype.upd = function () { var T = window.THREE, v = new T.Vector3().setFromSpherical(this.sph); this.cam.position.copy(this.tgt).add(v); this.cam.lookAt(this.tgt); this.req(); };
  View.prototype.req = function () { var self = this; if (!this.ok || this._raf) return; this._raf = requestAnimationFrame(function () { self._raf = 0; if (!self.el.isConnected) { self.dispose(); return; } self.r.render(self.scene, self.cam); }); };
  View.prototype.sprite = function (txt, color) { var T = window.THREE, c = document.createElement('canvas'), g = c.getContext('2d'), FNT = '800 54px Montserrat, sans-serif'; g.font = FNT; var tw = Math.ceil(g.measureText(String(txt)).width) + 40; c.width = Math.max(512, tw); c.height = 128; g = c.getContext('2d'); g.font = FNT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeStyle = 'rgba(20,22,25,0.85)'; g.lineJoin = 'round'; g.strokeText(txt, c.width / 2, 64); g.fillStyle = color || '#AEB4BB'; g.fillText(txt, c.width / 2, 64); var tx = new T.CanvasTexture(c); var s = new T.Sprite(new T.SpriteMaterial({ map: tx, transparent: true, depthWrite: false })); s.userData.ar = c.width / 512; s.scale.set(1.2 * s.userData.ar, 0.3, 1); return s; };
  var TEXC = null, ROTS = null;
  function blanketCanvas() {
    if (TEXC) return TEXC; var c = document.createElement('canvas'); c.width = c.height = 256; var g = c.getContext('2d');
    g.fillStyle = '#17181B'; g.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 1800; i++) { g.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.045).toFixed(3) + ')'; g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5); }
    var st = 64; for (var x = -256; x < 512; x += st) for (var y = -256; y < 512; y += st) { var gr = g.createRadialGradient(x + st / 2, y + st / 2, 2, x + st / 2, y + st / 2, st * 0.55); gr.addColorStop(0, 'rgba(255,255,255,0.07)'); gr.addColorStop(1, 'rgba(0,0,0,0.18)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x + st / 2, y); g.lineTo(x + st, y + st / 2); g.lineTo(x + st / 2, y + st); g.lineTo(x, y + st / 2); g.closePath(); g.fill(); }
    g.strokeStyle = 'rgba(170,176,184,0.55)'; g.lineWidth = 1.4; g.setLineDash([5, 4]);
    for (var k = -256; k < 512; k += st) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 256, 256); g.stroke(); g.beginPath(); g.moveTo(k + 256, 0); g.lineTo(k, 256); g.stroke(); }
    g.setLineDash([]); g.fillStyle = 'rgba(120,126,134,0.9)'; g.fillRect(0, 0, 256, 3); g.fillRect(0, 253, 256, 3);
    TEXC = c; return c;
  }
  var WOODS = ['armoire', 'buffet', 'commode', 'chevet', 'meubletv', 'biblio', 'bureau', 'table', 'tbasse', 'chaise', 'coiffeuse', 'bed', 'vitrine', 'tablem'];
  var REAL = { frigo: '#ECEEF0', congel: '#ECEEF0', mal: '#ECEEF0', cuisiniere: '#E2E4E7', micro: '#E2E4E7', clim: '#ECEEF0', ventilo: '#E5E7EA', tv: '#1A1B1E', matelas: '#EDE7DA', mattress: '#EDE7DA', carton: '#C69C63', sac: '#3C6E9E', tapis: '#9C3D2E', gaz: '#3E7CB1', velo: '#C0392B', pot: '#B5653B', panels: '#B48558' };
  function realCol(u) { var s = u.shape || u.k; if (u.sofa || s === 'sofa') return '#7C8A99'; if (REAL[s]) return REAL[s]; if (WOODS.indexOf(s) >= 0) return '#9C6B44'; return COLORS[u.c] || '#9DB7A8'; }
  function rots(T) {
    if (ROTS) return ROTS; ROTS = []; var seen = {};
    for (var a = 0; a < 4; a++) for (var c = 0; c < 4; c++) for (var b = 0; b < 4; b++) {
      var e = new T.Euler(a * Math.PI / 2, b * Math.PI / 2, c * Math.PI / 2), el = new T.Matrix4().makeRotationFromEuler(e).elements.map(function (v) { return Math.round(v); }), key = el.join(',');
      if (seen[key]) continue; seen[key] = 1; ROTS.push({ e: e, m: el });
    }
    return ROTS;
  }
  function rotExt(m, X, Y, Z) { return [Math.abs(m[0]) * X + Math.abs(m[4]) * Y + Math.abs(m[8]) * Z, Math.abs(m[1]) * X + Math.abs(m[5]) * Y + Math.abs(m[9]) * Z, Math.abs(m[2]) * X + Math.abs(m[6]) * Y + Math.abs(m[10]) * Z]; }
  function rgeo(T, w, h, d, r) {
    r = Math.min(r || 0, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002);
    if (!(r > 0.004)) return new T.BoxGeometry(w, h, d);
    var iw = w - 2 * r, ih = h - 2 * r, c = Math.min(iw, ih) * 0.03 + 0.0005, sp = new T.Shape(), x = -iw / 2, y = -ih / 2;
    sp.moveTo(x + c, y); sp.lineTo(x + iw - c, y); sp.quadraticCurveTo(x + iw, y, x + iw, y + c); sp.lineTo(x + iw, y + ih - c); sp.quadraticCurveTo(x + iw, y + ih, x + iw - c, y + ih); sp.lineTo(x + c, y + ih); sp.quadraticCurveTo(x, y + ih, x, y + ih - c); sp.lineTo(x, y + c); sp.quadraticCurveTo(x, y, x + c, y);
    var dep = Math.max(0.0005, d - 2 * r), g = new T.ExtrudeGeometry(sp, { depth: dep, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, curveSegments: 3 });
    g.translate(0, 0, -dep / 2); return g;
  }
  var TX = {};
  function texCanvas(kind) {
    if (TX[kind]) return TX[kind]; var c = document.createElement('canvas'); c.width = c.height = 256; var g = c.getContext('2d'), Rn = function (n) { return Math.random() * n; };
    if (kind === 'wood') { g.fillStyle = '#EEE9E2'; g.fillRect(0, 0, 256, 256); for (var i = 0; i < 70; i++) { var y = Rn(256); g.strokeStyle = 'rgba(60,40,20,' + (0.04 + Rn(0.12)).toFixed(3) + ')'; g.lineWidth = 0.6 + Rn(2.2); g.beginPath(); g.moveTo(0, y); for (var x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x / 40 + i) * 3 + Rn(1.5)); g.stroke(); } }
    else if (kind === 'fabric') { g.fillStyle = '#E8E8E8'; g.fillRect(0, 0, 256, 256); for (var y2 = 0; y2 < 256; y2 += 2) { g.fillStyle = 'rgba(0,0,0,' + (0.03 + Rn(0.06)).toFixed(3) + ')'; g.fillRect(0, y2, 256, 1); } for (var x2 = 0; x2 < 256; x2 += 2) { g.fillStyle = 'rgba(255,255,255,' + (0.03 + Rn(0.06)).toFixed(3) + ')'; g.fillRect(x2, 0, 1, 256); } }
    else if (kind === 'quilt') { g.fillStyle = '#F4F2EE'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(0,0,0,0.14)'; g.lineWidth = 1.2; g.setLineDash([4, 3]); for (var k = -256; k < 512; k += 42) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 256, 256); g.stroke(); g.beginPath(); g.moveTo(k + 256, 0); g.lineTo(k, 256); g.stroke(); } g.setLineDash([]); }
    else if (kind === 'kraft') { g.fillStyle = '#EDE6DA'; g.fillRect(0, 0, 256, 256); for (var j = 0; j < 2500; j++) { g.fillStyle = 'rgba(80,50,20,' + Rn(0.12).toFixed(3) + ')'; g.fillRect(Rn(256), Rn(256), 1 + Rn(2), 1); } }
    else if (kind === 'rug') { g.fillStyle = '#E6E6E6'; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgba(0,0,0,0.28)'; for (var q = 0; q < 256; q += 64) { g.fillRect(0, q, 256, 6); g.beginPath(); g.moveTo(128, q + 14); g.lineTo(160, q + 32); g.lineTo(128, q + 50); g.lineTo(96, q + 32); g.closePath(); g.fill(); } }
    TX[kind] = c; return c;
  }
  function build(T, u, X, Y, Z, M) {
    var g = new T.Group(), main = null;
    var P3 = function (x, y, z) { return new T.Vector3(x * X - X / 2, y * Y - Y / 2, z * Z - Z / 2); };
    var add = function (me, isMain, sz) { me.userData.sz = sz; g.add(me); if (isMain) main = me; return me; };
    var B = function (x0, y0, z0, x1, y1, z1, m, isMain, r) { if (!m) return null; var dx = (x1 - x0) * X, dy = (y1 - y0) * Y, dz = (z1 - z0) * Z; if (dx <= 0.002 || dy <= 0.002 || dz <= 0.002) return null; var me = new T.Mesh(rgeo(T, dx, dy, dz, r || 0), m); me.position.copy(P3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); return add(me, isMain, [dx, dy, dz]); };
    var Cy = function (cx, cy, cz, r, len, axis, m, isMain, r2) { if (!m || r <= 0 || len <= 0) return null; var me = new T.Mesh(new T.CylinderGeometry(r, r2 == null ? r : r2, len, 24), m); if (axis === 'x') me.rotation.z = Math.PI / 2; if (axis === 'z') me.rotation.x = Math.PI / 2; me.position.copy(P3(cx, cy, cz)); return add(me, isMain, [2 * r, len, 2 * r]); };
    var Tor = function (cx, cy, cz, Rr, t, axis, m) { if (!m || Rr <= 0) return null; var me = new T.Mesh(new T.TorusGeometry(Rr, t, 10, 40), m); if (axis === 'x') me.rotation.y = Math.PI / 2; if (axis === 'y') me.rotation.x = Math.PI / 2; me.position.copy(P3(cx, cy, cz)); return add(me, false, [2 * Rr, 2 * Rr, 2 * t]); };
    var Seg = function (p, q, r, m) { if (!m) return; var A = P3(p[0], p[1], p[2]), Bv = P3(q[0], q[1], q[2]), d = Bv.clone().sub(A), L = d.length(); if (L < 0.005) return; var me = new T.Mesh(new T.CylinderGeometry(r, r, L, 10), m); me.position.copy(A).add(Bv).multiplyScalar(0.5); me.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); g.add(me); };
    var Lathe = function (pts, m, isMain) { if (!m) return null; var me = new T.Mesh(new T.LatheGeometry(pts.map(function (p) { return new T.Vector2(Math.max(0.0001, p[0]), p[1]); }), 36), m); me.position.copy(P3(0.5, 0, 0.5)); return add(me, isMain, [X, Y, Z]); };
    var b = M.body, dk = M.dark, lt = M.light, gl = M.glass, mt = M.metal, lg = M.leg || M.dark, sc = M.screen || M.dark, pa = M.paper, mi = M.mirror || M.glass, sh = u.shape || u.k;
    var fx = function (m) { return Math.min(0.45, m / X); }, fz = function (m) { return Math.min(0.45, m / Z); }, fy = function (m) { return Math.min(0.45, m / Y); }, ez = function (m) { return m / Z; };
    var legs = function (h, t, ins, round, m) { var a = fx(t), c = fz(t), ix = fx(ins || 0.02), iz = fz(ins || 0.02); [[ix, iz], [1 - ix - a, iz], [ix, 1 - iz - c], [1 - ix - a, 1 - iz - c]].forEach(function (p) { if (round) Cy(p[0] + a / 2, h / 2, p[1] + c / 2, t / 2, h * Y, 'y', m || lg, 0, t * 0.35); else B(p[0], 0, p[1], p[0] + a, h, p[1] + c, m || lg); }); };
    var knob = function (x, y) { Cy(x, y, 1 - ez(0.012), 0.012, 0.024, 'z', mt); };
    var vhandle = function (x, y0, y1) { B(x - fx(0.008), y0, 1 - ez(0.025), x + fx(0.008), y1, 1, mt, 0, 0.005); };
    var hhandle = function (x0, x1, y) { B(x0, y - fy(0.008), 1 - ez(0.025), x1, y + fy(0.008), 1, mt, 0, 0.005); };
    if (sh === 'sofa') {
      var aw = fx(0.17), bk = fz(0.24), n = Math.max(1, u.seats || 1), lh = fy(0.1);
      B(aw * 0.5, lh, 0.02, 1 - aw * 0.5, 0.46, 0.98, b, 1, 0.03); B(0, lh, 0, 1, 1, bk, b, 0, 0.07); B(0, lh, 0, aw, 0.7, 1, b, 0, 0.07); B(1 - aw, lh, 0, 1, 0.7, 1, b, 0, 0.07);
      for (var i = 0; i < n; i++) { var w0 = aw + i * (1 - 2 * aw) / n, w1 = aw + (i + 1) * (1 - 2 * aw) / n; B(w0 + 0.004, 0.44, bk + fz(0.14), w1 - 0.004, 0.62, 0.995, lt, 0, 0.05); B(w0 + 0.006, 0.6, bk - fz(0.02), w1 - 0.006, 0.97, bk + fz(0.17), lt, 0, 0.06); }
      legs(lh, 0.05, 0.05, true);
    } else if (sh === 'chaise') {
      B(0, 0.44, 0, 1, 0.5, 1, b, 1, 0.01); legs(0.44, 0.04, 0, false, b);
      B(0, 0.5, 0, fx(0.04), 1, fz(0.04), b); B(1 - fx(0.04), 0.5, 0, 1, 1, fz(0.04), b); B(0, 0.88, 0, 1, 0.98, fz(0.035), b, 0, 0.008); B(fx(0.04), 0.66, 0.004, 1 - fx(0.04), 0.72, fz(0.03), b);
    } else if (sh === 'table') { B(0, 1 - fy(0.035), 0, 1, 1, 1, b, 1, 0.006); B(fx(0.06), 1 - fy(0.12), fz(0.06), 1 - fx(0.06), 1 - fy(0.035), 1 - fz(0.06), b); legs(1 - fy(0.035), 0.06, 0.035); }
    else if (sh === 'tbasse') { B(0, 1 - fy(0.035), 0, 1, 1, 1, b, 1, 0.006); B(fx(0.04), 0.14, fz(0.04), 1 - fx(0.04), 0.14 + fy(0.025), 1 - fz(0.04), lt); legs(1 - fy(0.035), 0.05, 0.02); }
    else if (sh === 'bureau') {
      B(0, 1 - fy(0.035), 0, 1, 1, 1, b, 1, 0.006); B(0.64, 0.04, 0.03, 0.97, 1 - fy(0.035), 0.95, b);
      for (var dr = 0; dr < 3; dr++) { var y0 = 0.06 + dr * 0.3, y1 = y0 + 0.28; B(0.65, y0, 0.95, 0.96, Math.min(y1, 1 - fy(0.05)), 0.975, lt, 0, 0.004); hhandle(0.76, 0.85, (y0 + Math.min(y1, 1 - fy(0.05))) / 2); }
      B(0.02, 0, 0.03, 0.02 + fx(0.05), 1 - fy(0.035), 0.03 + fz(0.05), lg); B(0.02, 0, 0.97 - fz(0.05), 0.02 + fx(0.05), 1 - fy(0.035), 0.97, lg); B(0.02, 0.1, 0.03, 0.64, 0.1 + fy(0.03), 0.03 + fz(0.03), lg);
    }
    else if (sh === 'frigo') {
      var ft = fy(0.03); B(0, ft, 0, 1, 1, 0.92, b, 1, 0.025); legs(ft, 0.04, 0.05, false, dk);
      if (Y > 1.1) { B(0.004, 0.67, 0.92, 0.996, 0.996, 0.96, b, 0, 0.018); B(0.004, ft + 0.004, 0.92, 0.996, 0.66, 0.96, b, 0, 0.018); vhandle(0.9, 0.72, 0.9); vhandle(0.9, 0.42, 0.62); }
      else { B(0.004, ft + 0.004, 0.92, 0.996, 0.996, 0.96, b, 0, 0.018); vhandle(0.9, 0.55, 0.85); }
      B(0.1, ft + 0.01, 0.95, 0.9, ft + fy(0.06), 0.97, dk);
    }
    else if (sh === 'congel') { var ft2 = fy(0.03); B(0, ft2, 0, 1, 0.9, 0.96, b, 1, 0.02); B(0, 0.905, 0, 1, 1, 0.97, b, 0, 0.02); hhandle(0.4, 0.6, 0.86); legs(ft2, 0.04, 0.04, false, dk); }
    else if (sh === 'mal') {
      var ft3 = fy(0.02), rP = Math.min(X, Y) * 0.3; B(0, ft3, 0, 1, 1, 0.95, b, 1, 0.02); legs(ft3, 0.04, 0.05, false, dk);
      B(0.02, 0.86, 0.95, 0.98, 0.985, 0.965, lt); B(0.05, 0.88, 0.965, 0.32, 0.96, 0.98, lt, 0, 0.003); B(0.45, 0.89, 0.965, 0.66, 0.95, 0.975, sc); Cy(0.82, 0.92, 0.97, Math.min(X, Y) * 0.04, 0.03, 'z', mt);
      Tor(0.5, 0.44, 0.965, rP, 0.025, 'z', mt); Cy(0.5, 0.44, 0.958, rP * 0.94, 0.01, 'z', dk); Cy(0.5, 0.44, 0.972, rP * 0.9, 0.006, 'z', gl);
    }
    else if (sh === 'cuisiniere') {
      B(0, 0, 0, 1, 1, 0.95, b, 1, 0.01);
      if (Y > 0.4) { B(0.06, 0.1, 0.95, 0.94, 0.66, 0.975, dk, 0, 0.01); B(0.16, 0.2, 0.975, 0.84, 0.56, 0.982, gl); Cy(0.5, 0.7, 0.985, 0.012, X * 0.72, 'x', mt); for (var kk = 0; kk < 4; kk++) Cy(0.2 + kk * 0.2, 0.84, 0.97, 0.022, 0.03, 'z', dk); }
      [[0.28, 0.3], [0.72, 0.3], [0.28, 0.7], [0.72, 0.7]].forEach(function (p) { Cy(p[0], 1 - fy(0.006), p[1], Math.min(X, Z) * 0.11, 0.012, 'y', dk); Tor(p[0], 1 - fy(0.002), p[1], Math.min(X, Z) * 0.13, 0.006, 'y', dk); });
    }
    else if (sh === 'micro') { B(0, 0, 0, 1, 1, 0.95, b, 1, 0.015); B(0.04, 0.1, 0.95, 0.7, 0.9, 0.975, sc, 0, 0.006); B(0.73, 0.1, 0.95, 0.96, 0.9, 0.97, lt); for (var bt = 0; bt < 6; bt++) B(0.77 + (bt % 2) * 0.09, 0.62 - Math.floor(bt / 2) * 0.13, 0.97, 0.83 + (bt % 2) * 0.09, 0.7 - Math.floor(bt / 2) * 0.13, 0.98, dk); legs(fy(0.02), 0.03, 0.04, false, dk); }
    else if (sh === 'clim') { var rf = Math.min(X, Y) * 0.36; B(0, 0, 0, 1, 1, 0.96, b, 1, 0.02); Cy(0.38, 0.5, 0.965, rf, 0.01, 'z', dk); Tor(0.38, 0.5, 0.97, rf, 0.012, 'z', mt); for (var vv = 0; vv < 8; vv++) B(0.78, 0.15 + vv * 0.09, 0.96, 0.94, 0.18 + vv * 0.09, 0.975, dk); }
    else if (sh === 'tv') { B(0, 0, fz(0.04), 1, 1, 0.97, b, 1, 0.008); B(0.015, 0.055, 0.97, 0.985, 0.985, 1, sc, 0, 0.002); B(0.25, 0.1, 0, 0.75, 0.7, fz(0.05), b, 0, 0.015); B(0.47, 0.012, 0.97, 0.53, 0.035, 0.99, mt); }
    else if (sh === 'armoire') {
      var nb = Math.max(1, u.bat || 2), pl = fy(0.06), cr = fy(0.04);
      B(0, pl, 0, 1, 1 - cr, 0.95, b, 1, 0.004); B(0.01, 0, 0.01, 0.99, pl, 0.93, lg); B(0, 1 - cr, 0, 1, 1, 0.985, b, 0, 0.004);
      for (var j = 0; j < nb; j++) { var a0 = j / nb + 0.004, a1 = (j + 1) / nb - 0.004; B(a0, pl + 0.008, 0.95, a1, 1 - cr - 0.008, 0.972, lt, 0, 0.004); B(a0 + 0.04 / nb, pl + 0.06, 0.972, a1 - 0.04 / nb, 0.5, 0.978, lt, 0, 0.003); B(a0 + 0.04 / nb, 0.54, 0.972, a1 - 0.04 / nb, 1 - cr - 0.06, 0.978, lt, 0, 0.003); vhandle(j % 2 ? a0 + 0.06 / nb : a1 - 0.06 / nb, 0.44, 0.6); }
    }
    else if (sh === 'commode' || sh === 'chevet' || sh === 'meubletv' || sh === 'buffet') {
      var lh2 = fy(0.08), tp = fy(0.03), fy0 = lh2 + 0.012, fy1 = 1 - tp - 0.012;
      B(0, lh2, 0, 1, 1 - tp, 0.95, b, 1, 0.004); B(0, 1 - tp, 0, 1, 1, 1, b, 0, 0.004); legs(lh2, 0.05, 0.03, sh !== 'buffet');
      var drw = function (x0, x1, y0, y1, two) { B(x0, y0, 0.95, x1, y1, 0.975, lt, 0, 0.003); if (two) { knob(x0 + (x1 - x0) * 0.25, (y0 + y1) / 2); knob(x0 + (x1 - x0) * 0.75, (y0 + y1) / 2); } else hhandle(x0 + (x1 - x0) * 0.38, x0 + (x1 - x0) * 0.62, (y0 + y1) / 2); };
      if (sh === 'commode' || sh === 'chevet') { var rows = sh === 'commode' ? 4 : 2; for (var r2 = 0; r2 < rows; r2++) { var ya = fy0 + r2 * (fy1 - fy0) / rows, yb = fy0 + (r2 + 1) * (fy1 - fy0) / rows; drw(0.03, 0.97, ya + 0.006, yb - 0.006, sh === 'commode'); } }
      else if (sh === 'buffet') { var ym = fy0 + (fy1 - fy0) * 0.72; drw(0.03, 0.495, ym + 0.006, fy1, false); drw(0.505, 0.97, ym + 0.006, fy1, false); B(0.03, fy0, 0.95, 0.495, ym - 0.006, 0.975, lt, 0, 0.003); B(0.505, fy0, 0.95, 0.97, ym - 0.006, 0.975, lt, 0, 0.003); vhandle(0.46, ym - 0.25, ym - 0.08); vhandle(0.54, ym - 0.25, ym - 0.08); }
      else { var ym2 = fy0 + (fy1 - fy0) * 0.45; drw(0.03, 0.33, fy0, ym2, false); drw(0.67, 0.97, fy0, ym2, false); B(0.34, fy0, 0.9, 0.66, fy1, 0.95, dk); drw(0.03, 0.33, ym2 + 0.012, fy1, false); drw(0.67, 0.97, ym2 + 0.012, fy1, false); }
    }
    else if (sh === 'biblio' || sh === 'vitrine') {
      var t3 = 0.022; B(0, 0, 0, 1, 1, fz(t3), b, 1); B(0, 0, 0, fx(t3), 1, 1, b); B(1 - fx(t3), 0, 0, 1, 1, 1, b); B(0, 1 - fy(t3), 0, 1, 1, 1, b, 0, 0.004); B(0, 0, 0, 1, fy(0.07), 1, b);
      var sv = Math.max(2, Math.round(Y / 0.36)); for (var q = 1; q < sv; q++) B(fx(t3), q / sv - fy(0.011), fz(t3), 1 - fx(t3), q / sv + fy(0.011), 0.97, sh === 'vitrine' ? gl : b);
      if (sh === 'vitrine') { B(fx(t3), fy(0.07), 0.975, 0.5 - 0.004, 1 - fy(t3), 1, gl); B(0.5 + 0.004, fy(0.07), 0.975, 1 - fx(t3), 1 - fy(t3), 1, gl); vhandle(0.47, 0.45, 0.58); vhandle(0.53, 0.45, 0.58); }
    }
    else if (sh === 'coiffeuse') { B(0, 0.06, 0, 1, 0.5, 0.95, b, 1, 0.004); legs(0.06, 0.04, 0.02); B(0.03, 0.08, 0.95, 0.485, 0.47, 0.975, lt, 0, 0.003); B(0.515, 0.08, 0.95, 0.97, 0.47, 0.975, lt, 0, 0.003); knob(0.26, 0.28); knob(0.74, 0.28); B(0.15, 0.5, 0.02, 0.85, 1, fz(0.06), b, 0, 0.012); B(0.18, 0.53, fz(0.06), 0.82, 0.97, fz(0.072), mi); }
    else if (sh === 'bed') { B(0, 0, 0, fx(0.06), 1, 1, b, 1, 0.02); B(1 - fx(0.06), 0, 0, 1, 0.48, 1, b, 0, 0.02); B(0, 0.12, 0, 1, 0.4, fz(0.05), b, 0, 0.006); B(0, 0.12, 1 - fz(0.05), 1, 0.4, 1, b, 0, 0.006); for (var sl = 0; sl < 10; sl++) { var sx = fx(0.06) + (sl + 0.2) * (1 - 2 * fx(0.06)) / 10; B(sx, 0.33, fz(0.05), sx + (1 - 2 * fx(0.06)) / 10 * 0.6, 0.36, 1 - fz(0.05), lt); } }
    else if (sh === 'panels') { var np = Math.max(2, Math.min(7, Math.round(Z / 0.06))); for (var p2 = 0; p2 < np; p2++) B(0, 0, p2 / np + 0.003, 1, 1, (p2 + 1) / np - 0.003, p2 % 2 ? lt : b, p2 === 0, 0.003); B(0.42, 0.86, 0.995 - fz(0.04), 0.58, 0.96, 0.995, pa, 0, 0.005); }
    else if (sh === 'matelas' || sh === 'mattress') { B(0, 0, 0, 1, 1, 1, b, 1, Math.min(0.06, Z * 0.45)); Tor(0.5, 0.5, 0.5, 0, 0, 'z', null); }
    else if (sh === 'carton' || sh === 'sac') {
      var nk = u.stackOf || 1, gp = 0.006 / Y;
      for (var c2 = 0; c2 < nk; c2++) { var yy0 = c2 / nk, yy1 = (c2 + 1) / nk - gp, hh = yy1 - yy0;
        if (sh === 'carton') { B(0, yy0, 0, 1, yy1, 1, b, c2 === 0, 0.004); B(-0.002, yy1 - 0.003 / Y, 0.44, 1.002, yy1 + 0.0008 / Y, 0.56, M.tape); B(-0.003, yy1 - hh * 0.28, 0.44, 0.002, yy1, 0.56, M.tape); B(0.998, yy1 - hh * 0.28, 0.44, 1.003, yy1, 0.56, M.tape); B(0.6, yy0 + hh * 0.35, 0.998, 0.88, yy0 + hh * 0.65, 1.004, pa); }
        else { B(0.03, yy0, 0.03, 0.97, yy1, 0.97, b, c2 === 0, Math.min(0.08, hh * Y * 0.45)); Tor(0.35, yy1, 0.5, Math.min(X, Z) * 0.08, 0.008, 'x', dk); Tor(0.65, yy1, 0.5, Math.min(X, Z) * 0.08, 0.008, 'x', dk); }
      }
    }
    else if (sh === 'tapis') { var rr = Math.min(Y, Z) / 2; Cy(0.5, 0.5, 0.5, rr, X, 'x', b, 1); for (var e = 0; e < 3; e++) { Tor(0.001, 0.5, 0.5, rr * (0.3 + e * 0.25), 0.004, 'x', lt); Tor(0.999, 0.5, 0.5, rr * (0.3 + e * 0.25), 0.004, 'x', lt); } Tor(0.25, 0.5, 0.5, rr * 1.01, 0.006, 'x', dk); Tor(0.75, 0.5, 0.5, rr * 1.01, 0.006, 'x', dk); }
    else if (sh === 'ventilo') {
      var Rf = Math.min(X, Y) * 0.36; Cy(0.5, 0.02, 0.5, Math.min(X, Z) * 0.3, 0.03, 'y', dk || b, 1); Cy(0.5, 0.4, 0.5, 0.015, Y * 0.72, 'y', mt); Cy(0.5, 0.8, 0.4, 0.06, 0.14, 'z', b);
      Tor(0.5, 0.8, 0.56, Rf, 0.006, 'z', mt); Tor(0.5, 0.8, 0.5, Rf, 0.006, 'z', mt); for (var sp2 = 0; sp2 < 8; sp2++) { var an = sp2 * Math.PI / 4; Seg([0.5, 0.8, 0.565], [0.5 + Math.cos(an) * Rf / X, 0.8 + Math.sin(an) * Rf / Y, 0.565], 0.003, mt); }
      if (lt) for (var bl = 0; bl < 3; bl++) { var bg = new T.BoxGeometry(Rf * 0.85, Rf * 0.34, 0.004); bg.translate(Rf * 0.45, 0, 0); var bm = new T.Mesh(bg, lt); bm.position.copy(P3(0.5, 0.8, 0.53)); bm.rotation.z = bl * 2.094; g.add(bm); }
    }
    else if (sh === 'gaz') { var rg = Math.min(X, Z) / 2; Lathe([[0, 0.02 * Y], [rg * 0.93, 0.02 * Y], [rg, 0.07 * Y], [rg, 0.7 * Y], [rg * 0.86, 0.8 * Y], [rg * 0.35, 0.86 * Y], [0, 0.86 * Y]], b, 1); Cy(0.5, 0.02, 0.5, rg * 0.9, Y * 0.04, 'y', dk); Cy(0.5, 0.9, 0.5, rg * 0.14, Y * 0.08, 'y', mt); Tor(0.5, 0.95, 0.5, rg * 0.45, 0.012, 'y', b); }
    else if (sh === 'velo') {
      var R2 = Math.min(0.33 * Y, 0.2 * X), hw = R2 / Y;
      [0.2, 0.8].forEach(function (cx) { Tor(cx, hw, 0.5, R2, 0.022, 'z', dk || b); Tor(cx, hw, 0.5, R2 * 0.92, 0.008, 'z', mt); Cy(cx, hw, 0.5, 0.025, 0.08, 'z', mt); for (var k2 = 0; k2 < 12; k2++) { var a2 = k2 * Math.PI / 6; Seg([cx, hw, 0.5], [cx + Math.cos(a2) * R2 * 0.92 / X, hw + Math.sin(a2) * R2 * 0.92 / Y, 0.5], 0.0015, mt); } });
      Seg([0.2, hw, 0.5], [0.45, hw, 0.5], 0.018, b); Seg([0.45, hw, 0.5], [0.38, 0.75, 0.5], 0.02, b); Seg([0.2, hw, 0.5], [0.38, 0.75, 0.5], 0.016, b); Seg([0.38, 0.75, 0.5], [0.72, 0.76, 0.5], 0.02, b); Seg([0.45, hw, 0.5], [0.72, 0.76, 0.5], 0.022, b); Seg([0.8, hw, 0.5], [0.72, 0.92, 0.5], 0.018, mt); Seg([0.72, 0.92, 0.12], [0.72, 0.92, 0.88], 0.013, mt); Seg([0.38, 0.75, 0.5], [0.37, 0.8, 0.5], 0.012, mt);
      B(0.31, 0.8, 0.4, 0.45, 0.84, 0.6, dk || b, 1, 0.01); Cy(0.45, hw, 0.5, 0.05, 0.02, 'z', mt);
    }
    else if (sh === 'pot') { var rt = Math.min(X, Z) * 0.42, hp = Y * 0.42; Lathe([[0, 0], [rt * 0.74, 0], [rt, hp * 0.94], [rt * 1.06, hp * 0.96], [rt * 1.06, hp], [rt * 0.96, hp], [rt * 0.94, hp * 0.93], [0, hp * 0.93]], b, 1); Cy(0.5, 0.44 * 0.93, 0.5, rt * 0.92, 0.01, 'y', dk); Cy(0.5, 0.56, 0.5, 0.012, Y * 0.3, 'y', lg); [[0.5, 0.82, 0.5, 0.3], [0.35, 0.7, 0.4, 0.22], [0.65, 0.72, 0.6, 0.22], [0.45, 0.66, 0.68, 0.18], [0.6, 0.9, 0.38, 0.18]].forEach(function (p) { var lf = new T.Mesh(new T.IcosahedronGeometry(1, 1), M.leaf); lf.scale.set(X * p[3], Y * p[3] * 0.6, Z * p[3]); lf.position.copy(P3(p[0], p[1], p[2])); g.add(lf); }); }
    else B(0, 0, 0, 1, 1, 1, b, 1, 0.02);
    if (!main) main = g.children[0] || null;
    return { g: g, main: main };
  }
  View.prototype.load = function (trip, P, opt) {
    if (!this.ok) return; var T = window.THREE, V = P.V, self = this; opt = opt || {}; var wrapOn = opt.wrap !== false;
    this.root.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
    this.scene.remove(this.root); this.root = new T.Group(); this.scene.add(this.root); this.meshes = []; this.items = [];
    var g = this.root, L = V.L, W = V.W, H = V.H; g.position.set(-L / 2, 0, -W / 2);
    var box = function (x, y, z, dx, dy, dz, col, op) { var m = new T.Mesh(new T.BoxGeometry(dx, dy, dz), new T.MeshStandardMaterial({ color: col, roughness: 0.9, metalness: 0, transparent: op < 1, opacity: op })); m.position.set(x + dx / 2, y + dy / 2, z + dz / 2); g.add(m); return m; };
    var fl = new T.Mesh(new T.PlaneGeometry(L, W), new T.MeshStandardMaterial({ color: 0x30343A, roughness: 1 })); fl.receiveShadow = true; fl.rotation.x = -Math.PI / 2; fl.position.set(L / 2, 0, W / 2); g.add(fl);
    var lw = new T.Mesh(new T.PlaneGeometry(L, H), new T.MeshStandardMaterial({ color: 0x3B4046, transparent: true, opacity: 0.35, side: T.DoubleSide, depthWrite: false })); lw.position.set(L / 2, H / 2, 0); g.add(lw);
    var fw = new T.Mesh(new T.PlaneGeometry(W, H), new T.MeshStandardMaterial({ color: 0x3B4046, transparent: true, opacity: 0.35, side: T.DoubleSide, depthWrite: false })); fw.rotation.y = Math.PI / 2; fw.position.set(0, H / 2, W / 2); g.add(fw);
    var ed = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(L, H, W)), new T.LineBasicMaterial({ color: 0xF6D73C, transparent: true, opacity: 0.6 })); ed.position.set(L / 2, H / 2, W / 2); g.add(ed);
    box(-0.95, 0, 0.04, 0.93, H * 0.78, W - 0.08, 0x272A2E, 0.9);
    var sc = this.sprite('CABINE', '#AEB4BB'); sc.position.set(-0.48, H * 0.78 + 0.25, W / 2); g.add(sc);
    var sr = this.sprite('PORTES', '#AEB4BB'); sr.position.set(L + 0.35, 0.2, W / 2); g.add(sr);
    var lp = []; for (var i = 1; i < trip.nTiers; i++) { var xx = i * trip.tierLen; lp.push(xx, 0.003, 0, xx, 0.003, W); }
    if (lp.length) { var lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(lp, 3)); g.add(new T.LineSegments(lg, new T.LineBasicMaterial({ color: 0x6B737B, transparent: true, opacity: 0.7 }))); }
    for (var t = 1; t <= trip.nTiers; t++) { var st = this.sprite(String(t), '#6B737B'); st.scale.set(0.8 * (st.userData.ar || 1), 0.2, 1); st.position.set((t - 0.5) * trip.tierLen, 0.02, -0.18); g.add(st); }
    (V.arches || []).forEach(function (a) { box(a.x, a.y, a.z, a.dx, a.dy, a.dz, 0x4A5057, 1); });
    var R = rots(T), gap = 0.014, cvs = blanketCanvas();
    trip.boxes.forEach(function (bx) {
      var u = bx.u, base = new T.Color(realCol(u)), wrap = wrapOn && bx.prot > 0, mats = [];
      var mk = function (o) { var m = new T.MeshStandardMaterial(Object.assign({ roughness: 0.85, metalness: 0 }, o)); mats.push(m); return m; };
      var M;
      var sh0 = u.shape || u.k, woodish = WOODS.indexOf(sh0) >= 0 || sh0 === 'panels', kind = woodish ? 'wood' : (u.sofa || sh0 === 'sofa' || sh0 === 'sac') ? 'fabric' : (sh0 === 'matelas' || sh0 === 'mattress') ? 'quilt' : sh0 === 'carton' ? 'kraft' : sh0 === 'tapis' ? 'rug' : '';
      var tex = function (rep) { if (!kind) return null; var t2 = new T.CanvasTexture(texCanvas(kind)); t2.wrapS = t2.wrapT = T.RepeatWrapping; t2.repeat.set(rep, rep); if (T.sRGBEncoding) t2.encoding = T.sRGBEncoding; t2.anisotropy = 4; return t2; };
      var elec = u.c === 'elec' || sh0 === 'ventilo', WH = new T.Color(0xffffff), legM = mk({ color: u.sofa ? 0x2E2219 : 0x4E3522, roughness: 0.6 });
      var M = { body: mk({ color: base, map: tex(kind === 'wood' ? 1.6 : 3), roughness: elec ? 0.32 : kind === 'wood' ? 0.55 : 0.92, metalness: elec ? 0.05 : 0 }), light: mk({ color: kind === 'wood' ? base.clone().lerp(WH, 0.16) : (u.sofa ? base.clone().lerp(WH, 0.1) : base.clone().lerp(WH, 0.3)), map: tex(kind === 'wood' ? 1.6 : 3), roughness: elec ? 0.4 : 0.85 }),
        dark: mk({ color: 0x22252A, roughness: 0.5 }), glass: (function () { var gm = mk({ color: 0xA9D6EE, transparent: true, opacity: 0.4, roughness: 0.08, metalness: 0.1 }); gm.userData.glass = 1; return gm; })(), metal: mk({ color: 0xC3C8CF, metalness: 0.35, roughness: 0.3 }),
        tape: mk({ color: 0xD9B77E, roughness: 0.4 }), leaf: mk({ color: 0x4C9A56, roughness: 0.8 }), leg: legM, screen: mk({ color: 0x0B0F14, roughness: 0.12, metalness: 0.45 }), paper: mk({ color: 0xF4F4F0, roughness: 0.9 }), mirror: mk({ color: 0xD5DEE5, roughness: 0.06, metalness: 0.3 }) };
      var ld = u.o === 'edge' ? [u.dims[0], u.dims[1], u.dims[2]] : [u.dims[0], u.dims[2], u.dims[1]];
      if (u.stackOf) ld = [u.dims[0], u.dims[2], u.dims[1]];
      var tt = bx.t, sp = { px: L - bx.x - bx.dx, nx: bx.x, pz: W - bx.z - bx.dz, nz: bx.z }, lowF = bx.nest && bx.on ? bx.on._front : null, best = null; R.forEach(function (r) { var m = r.m, e = rotExt(m, ld[0], ld[1], ld[2]), err = Math.abs(e[0] - bx.dx) + Math.abs(e[1] - bx.dy) + Math.abs(e[2] - bx.dz), pen = m[5] === -1 && tt !== 'inv' ? 0.5 : 0;
        if (tt === 'nat' || tt === 'debout' || tt === 'tranche') pen += m[5] === 1 ? 0 : 0.3; else if (tt === 'inv') pen += m[5] === -1 ? 0 : 0.6; else if (tt === 'dos') pen += m[9] === 1 ? 0 : 0.3; else if (tt === 'cote') pen += m[1] === 1 ? 0 : Math.abs(m[1]) === 1 ? 0.05 : 0.3; else if (tt === 'plat') pen += Math.abs(m[9]) === 1 ? 0 : 0.3;
        if (tt === 'inv' && lowF) { if (m[8] * lowF[0] + m[10] * lowF[1] > -0.5) pen += 2; }
        else if (Math.abs(m[9]) !== 1) { var fs = m[8] > 0.5 ? sp.px : m[8] < -0.5 ? sp.nx : m[10] > 0.5 ? sp.pz : m[10] < -0.5 ? sp.nz : 0, bs = m[8] > 0.5 ? sp.nx : m[8] < -0.5 ? sp.px : m[10] > 0.5 ? sp.nz : m[10] < -0.5 ? sp.pz : 0; if (fs < bs - 1e-3) pen += 0.12; }
        var sc2 = err * 100 + pen; if (!best || sc2 < best.s - 1e-6) best = { r: r, e: e, err: err, s: sc2 }; });
      bx._front = [best.r.m[8], best.r.m[10]];
      var S = build(T, u, ld[0], ld[1], ld[2], M), inner = S.g; inner.rotation.copy(best.r.e);
      var outer = new T.Group(); outer.add(inner); outer.scale.set(Math.max(0.01, bx.dx - gap) / best.e[0], Math.max(0.01, bx.dy - gap) / best.e[1], Math.max(0.01, bx.dz - gap) / best.e[2]);
      outer.position.set(bx.x + bx.dx / 2, bx.y + bx.dy / 2, bx.z + bx.dz / 2); g.add(outer);
      var it = { b: bx, g: outer, mats: mats, wrap: wrap }; self.items.push(it);
      outer.traverse(function (o) { if (o.isMesh) { o.userData.it = it; o.castShadow = true; o.receiveShadow = true; self.meshes.push(o); } });
    });
    this.R = Math.max(1.5, 0.5 * Math.sqrt(Math.pow(L + 1.2, 2) + H * H + W * W)); this.V0 = { L: L, W: W, H: H }; this.tgt.set(-0.3, H * 0.45, 0); this.H = H;
    this.setView(this._v || 'iso'); this.paint();
  };
  View.prototype.setView = function (v) {
    if (!this.ok || !this.R) { this._v = v; return; } var T = window.THREE; this._v = v;
    var dirs = { iso: [1.0, 0.8, 1.15], top: [0.0001, 1, 0.0001], side: [0.0001, 0.12, 1], rear: [1, 0.22, 0.0001] }, d = dirs[v] || dirs.iso;
    var fov = this.cam.fov * Math.PI / 180, asp = this.cam.aspect || 1.6, hf = 2 * Math.atan(Math.tan(fov / 2) * asp), dist = this.R / Math.sin(Math.min(fov, hf) / 2) * 0.92;
    if (this._crewOn && this._crewBox && this.V0) { var cb = this._crewBox; if (v === 'iso') d = [0.32, 0.42, 1.0]; dist = cb.r / Math.sin(Math.min(fov, hf) / 2) * 0.86; this.tgt.set(cb.cx - this.V0.L / 2, cb.cy, cb.cz - this.V0.W / 2); }
    else this.tgt.set(-0.3, (this.H || 1.8) * 0.45, 0);
    this.sph.setFromVector3(new T.Vector3(d[0], d[1], d[2]).normalize().multiplyScalar(dist)); this.sph.phi = Math.max(0.04, this.sph.phi); this.upd();
  };
  View.prototype.pick = function (e) { var rc = this.r.domElement.getBoundingClientRect(); this.mv.set((e.clientX - rc.left) / rc.width * 2 - 1, -(e.clientY - rc.top) / rc.height * 2 + 1); this.ray.setFromCamera(this.mv, this.cam); var hits = this.ray.intersectObjects(this.meshes.filter(function (m) { return m.userData.it && m.userData.it.g.visible; }), false); return hits.length ? hits[0].object.userData.it : null; };
  View.prototype.hover = function (e) { var it = this.pick(e); this.hl(it); if (!it) { this.tip.style.display = 'none'; return; } var rc = this.el.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top, b = it.b; this.tip.textContent = 'Étape ' + b.step + ' · ' + b.u.label + (b.prot ? ' · ' + b.prot + ' serviette' + (b.prot > 1 ? 's' : '') : b.need ? ' · sans serviette' : ''); this.tip.style.display = 'block'; var tw = this.tip.offsetWidth; this.tip.style.left = Math.max(6, Math.min(rc.width - tw - 6, x + 12)) + 'px'; this.tip.style.top = Math.max(6, y - 34) + 'px'; };
  View.prototype.hl = function (it) { var id = it ? it.b.id : null; if (id === this._hov) return; this._hov = id; this.paint(); };
  View.prototype.sel = function (b) {
    var T = window.THREE; if (!this.selBox) { this.selBox = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1, 1, 1)), new T.LineBasicMaterial({ color: 0xF6D73C, depthTest: false, transparent: true })); this.selBox.renderOrder = 10; }
    if (this.selBox.parent !== this.root) this.root.add(this.selBox);
    if (!b) { this.selBox.visible = false; return; } this.selBox.visible = true; this.selBox.scale.set(b.dx + 0.03, b.dy + 0.03, b.dz + 0.03); this.selBox.position.set(b.x + b.dx / 2, b.y + b.dy / 2, b.z + b.dz / 2);
  };
  View.prototype.focus = function (b) {
    var T = window.THREE, c = new T.Vector3(b.x + b.dx / 2, b.y + b.dy / 2, b.z + b.dz / 2).add(this.root.position), vc = new T.Vector3(0, (this.H || 1.8) * 0.45, 0);
    var t0 = c.clone().multiplyScalar(0.35).add(vc.clone().multiplyScalar(0.65)), off = t0.distanceTo(vc); this.tgt.copy(t0);
    this.fit(new T.Vector3(1, 0.8, 0.7).normalize(), 0.9);
  };
  View.prototype.fit = function (dir, margin) {
    var T = window.THREE, g = this.root, V = this.V0 || { L: 4, W: 1.8, H: 1.9 }, pts = [], self = this;
    [[-0.95, V.L], [0, V.W]].length; [-0.95, V.L + 0.1].forEach(function (x) { [0, V.W].forEach(function (z) { [0, V.H].forEach(function (y) { pts.push(new T.Vector3(x, y, z).add(g.position)); }); }); });
    var ok = function (d) { self.cam.position.copy(self.tgt).addScaledVector(dir, d); self.cam.lookAt(self.tgt); self.cam.updateMatrixWorld(); for (var i = 0; i < pts.length; i++) { var p = pts[i].clone().project(self.cam); if (Math.abs(p.x) > margin || Math.abs(p.y) > margin || p.z > 1) return false; } return true; };
    var lo = 0.5, hi = 60; for (var k = 0; k < 28; k++) { var mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; }
    this.sph.setFromVector3(dir.clone().multiplyScalar(hi)); this.upd();
  };
  View.prototype.show = function (step) { this._step = step; this.paint(); };
  View.prototype.paint = function () {
    if (!this.ok || !this.items) return; var st = this._step, max = 0, hov = this._hov;
    this.items.forEach(function (it) { if (it.b.step > max) max = it.b.step; });
    var cur = st == null ? max : st, full = cur >= max && !this.hlLast, ghost = this.ghost !== false, selIt = null; this.items.forEach(function (it) { if (it.b.step === cur) selIt = it; }); this.sel(!full && selIt ? selIt.b : null);
    this.items.forEach(function (it) {
      var s = it.b.step, on = !full && s === cur, hv = hov === it.b.id, past = ghost && !full && s < cur; it.g.visible = s <= cur;
      it.mats.forEach(function (m) { var gls = !!m.userData.glass; m.emissive.set(on ? 0xF6D73C : hv ? 0xffffff : 0x000000); m.emissiveIntensity = on ? 0.1 : hv ? 0.15 : 0; var tr = past || gls; if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.opacity = gls ? (past ? 0.25 : 0.45) : past ? 0.5 : 1; m.depthWrite = !tr; });
    });
    this.req();
  };
  View.prototype.snap = function (q) { if (!this.ok) return null; this.r.render(this.scene, this.cam); try { return this.r.domElement.toDataURL('image/jpeg', q || 0.9); } catch (e) { return null; } };
  View.prototype.dispose = function () { if (!this.ok) return; this.ok = false; try { this.ro.disconnect(); } catch (e) {} this.root.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); this.r.dispose(); try { this.r.forceContextLoss(); } catch (e) {} };

  function figure(T, col, lbl, spriteFn) {
    var g = new T.Group(), skin = new T.MeshStandardMaterial({ color: 0x6B4A33, roughness: 0.8 }), dark = new T.MeshStandardMaterial({ color: 0x23262B, roughness: 0.9 }), vest = new T.MeshStandardMaterial({ color: col, roughness: 0.7 });
    var legL = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.8, 10), dark), legR = legL.clone(); legL.position.set(0, 0.4, -0.1); legR.position.set(0, 0.4, 0.1); g.add(legL, legR);
    var body = new T.Mesh(new T.CylinderGeometry(0.2, 0.17, 0.62, 14), vest); body.position.y = 1.12; g.add(body);
    var armL = new T.Mesh(new T.CylinderGeometry(0.055, 0.05, 0.6, 8), vest), armR = armL.clone(); armL.position.set(0, 1.12, -0.26); armR.position.set(0, 1.12, 0.26); g.add(armL, armR);
    var head = new T.Mesh(new T.SphereGeometry(0.13, 16, 12), skin); head.position.y = 1.58; g.add(head);
    var cap = new T.Mesh(new T.SphereGeometry(0.135, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), vest); cap.position.y = 1.6; g.add(cap);
    if (lbl) { var sp = spriteFn(lbl, '#FFFFFF'); sp.scale.set(1.5 * (sp.userData.ar || 1), 0.375, 1); sp.position.y = 2.05; sp.material.depthTest = false; sp.renderOrder = 10; g.add(sp); }
    g.userData = { legL: legL, legR: legR, armL: armL, armR: armR };
    g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  var ROLEC = { chef: 0xF6D73C, chauffeur: 0x3B82F6, man: 0xFF8A3D, menu: 0x9B6BFF };
  var APPK = { frigo: 1, congel: 1, mal: 1, cuisiniere: 1, clim: 1 }, CASEK = { armoire: 1, buffet: 1, biblio: 1, commode: 1, vitrine: 1, coiffeuse: 1 };
  function handOf(b) { var u = b.u || {}, kg = b.kg || 0, n = kg <= 25 ? 1 : kg <= 50 ? 2 : kg <= 75 ? 3 : 4, tool = '';
    if (APPK[u.k]) { n = Math.max(2, n); tool = 'diable'; } else if (CASEK[u.k] && u.shape !== 'panels') { n = Math.max(2, n); tool = 'sangles'; } else if (u.sofa) { n = Math.max(2, n); tool = 'sangles'; }
    else if (u.k === 'matelas') { n = (u.dims && u.dims[1] > 1) ? 2 : 1; } else if (u.stackOf && u.stackOf >= 3) { tool = 'diable'; }
    if (Math.max(b.dx, b.dy, b.dz) > 1.8) n = Math.max(2, n); return { n: Math.min(4, n), tool: tool }; }
  function ordFl(f) { return f === 0 ? 'RDC' : f === 1 ? '1er' : f + 'e'; }
  View.prototype.crew = function (cfg) {
    var T = window.THREE; if (!this.ok || !this.root || !T) return; var self = this;
    if (this.crewG) { this.root.remove(this.crewG); this.crewG.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); this.crewG = null; }
    if (this._crewRaf) { cancelAnimationFrame(this._crewRaf); this._crewRaf = 0; }
    (this.items || []).forEach(function (it) { if (it.g.userData.home) { it.g.position.copy(it.g.userData.home); } });
    this._crewOn = !!(cfg && cfg.on); this._crewCfg = cfg; this._crewBox = null;
    if (!this._crewOn) { this.setView(this._v || 'iso'); this.req(); return; }
    var V = this.V0, L = V.L, W = V.W, G = new T.Group(); this.crewG = G; this.root.add(G);
    var site = cfg.site || {}, F = Math.max(0, Math.round(+site.F || 0)), nF = Math.min(F, 5), FH = 2.7, lift = !!site.lift && F > 0;
    var bx = L + 6.2, BD = 4.6, BW = 6.6, z0 = W / 2 - BW / 2, z1 = W / 2 + BW / 2, topY = (nF + 1) * FH;
    var M = function (c, o) { return new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.9 }, o || {})); };
    var BX = function (w, h, d, x, y, z, m) { var me = new T.Mesh(new T.BoxGeometry(w, h, d), m); me.position.set(x, y, z); G.add(me); return me; };
    var gnd = new T.Mesh(new T.PlaneGeometry(bx + BD + 2 - L, BW + 3), M(0x3A3E44, { roughness: 1 })); gnd.rotation.x = -Math.PI / 2; gnd.position.set((L + bx + BD + 2) / 2, -0.002, W / 2); G.add(gnd);
    var slabM = M(0xBFB3A0), glassM = M(0xD8CDB8, { transparent: true, opacity: 0.1, depthWrite: false, side: T.DoubleSide }), backM = M(0xC9BCA6), edgeM = M(0x8E8577);
    var WZ = 2.3, zr = z1 - WZ;
    BX(BD, 0.16, BW, bx + BD / 2, 0.01, W / 2, slabM);
    for (var f = 1; f <= nF + 1; f++) { BX(BD, 0.16, zr - z0, bx + BD / 2, f * FH - 0.08, (z0 + zr) / 2, slabM); BX(BD, 0.12, 0.12, bx + BD / 2, f * FH - 0.06, z1, edgeM); }
    BX(BD, topY, 0.14, bx + BD / 2, topY / 2, z0, backM); BX(0.14, topY, zr - z0, bx, topY / 2, (z0 + zr) / 2, backM);
    BX(0.08, topY, WZ, bx, topY / 2, (zr + z1) / 2, glassM); BX(BD, topY, 0.08, bx + BD / 2, topY / 2, z1, glassM);
    [[bx, z1], [bx + BD, z1], [bx + BD, z0]].forEach(function (c) { BX(0.12, topY, 0.12, c[0], topY / 2, c[1], edgeM); });
    BX(0.16, 2.1, 1.2, bx - 0.02, 1.05, W / 2, M(0x2A2D31));
    var LB = [], KS = Math.max(1.4, Math.min(2.6, (bx + BD + 2) / 7)), lab = function (t, c, x, y, z, sc) { var sp = self.sprite(t, c || '#FFFFFF'); LB.push({ sp: sp, mov: false }); sp.scale.set((sc || 1.4) * KS * (sp.userData.ar || 1), (sc || 1.4) * KS / 4, 1); sp.position.set(x, y, z); sp.material.depthTest = false; sp.renderOrder = 9; G.add(sp); return sp; };
    for (var f2 = 0; f2 <= nF; f2++) { var real = f2 === nF ? F : f2; lab(ordFl(real) + (f2 === nF - 1 && F > nF ? '  …' : ''), '#D5D9DE', bx + BD + 0.5, f2 * FH + 1.3, z1 + 0.3, 1.1); }
    lab((cfg.from || 'LOGEMENT') + ' · ' + (F ? 'étage ' + F : 'rez-de-chaussée') + (F ? (lift ? ' · ascenseur' : ' · escalier') : ''), '#F6D73C', bx + BD / 2, topY + 1.2 * KS, W / 2, 3.0);
    var apt = new T.Vector3(bx + BD * 0.55, nF * FH, zr - 0.9); BX(0.9, 0.5, 1.0, apt.x + 1.0, nF * FH + 0.25, z0 + 0.8, M(0xC69C63)); BX(0.9, 0.8, 0.5, apt.x - 0.6, nF * FH + 0.4, z0 + 0.5, M(0x9C6B44));
    var zs = z1 - WZ / 2, xa = bx + 0.6, xb = bx + BD - 0.7, land = function (fl) { return new T.Vector3(fl % 2 === 0 ? xa : xb, fl * FH, zs); };
    var Din = new T.Vector3(bx + 0.5, 0, W / 2), Dout = new T.Vector3(bx - 0.45, 0, W / 2), TR = new T.Vector3(L + 0.65, 0, W / 2);
    if (!lift && F > 0) {
      var stM = M(0x8E8577);
      for (var fl = 0; fl < nF; fl++) { var p0 = land(fl), p1 = land(fl + 1), n = 12; for (var k = 0; k < n; k++) { var u0 = k / n; BX(Math.abs(p1.x - p0.x) / n + 0.02, FH / n, 1.3, p0.x + (p1.x - p0.x) * (u0 + 0.5 / n), fl * FH + FH * (k + 0.5) / n, zs, stM); } }
      for (var fl2 = 1; fl2 <= nF; fl2++) { var lp = land(fl2); BX(1.1, 0.14, WZ, lp.x, fl2 * FH - 0.07, zs, slabM); }
    }
    var cab = null, lz = z1 - WZ / 2, lx = bx + BD - 1.3;
    if (lift) { var pm = M(0x4A5057); [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]].forEach(function (c) { BX(0.08, topY, 0.08, lx + c[0], topY / 2, lz + c[1], pm); });
      BX(1.5, topY, 1.5, lx, topY / 2, lz, M(0x9FD3F0, { transparent: true, opacity: 0.18, depthWrite: false }));
      for (var fl3 = 1; fl3 <= nF; fl3++) BX(BD - 1.6, 0.14, WZ, bx + (BD - 1.6) / 2, fl3 * FH - 0.07, lz, slabM);
      cab = new T.Group(); var cb1 = new T.Mesh(new T.BoxGeometry(1.3, 2.1, 1.3), M(0xB8BEC6, { metalness: 0.6, roughness: 0.35 })); cab.add(cb1); var cd = new T.Mesh(new T.BoxGeometry(0.04, 1.9, 0.9), M(0x2A2D31)); cd.position.set(-0.67, -0.05, 0); cab.add(cd); cab.position.set(lx, 1.05, lz); G.add(cab);
      lab('Ascenseur', '#9FD3F0', lx + 1.0, topY * 0.5, z1 + 0.6, 1.1); }
    var tool = function (kind, x, z, rot) { var g = new T.Group(), mt = M(0xB8BEC6, { metalness: 0.5, roughness: 0.4 }), bk = M(0x23262B);
      if (kind === 'diable') { [-0.18, 0.18].forEach(function (o) { var r = new T.Mesh(new T.BoxGeometry(0.04, 1.2, 0.04), mt); r.position.set(0, 0.62, o); g.add(r); var w = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 0.06, 14), bk); w.rotation.x = Math.PI / 2; w.position.set(-0.05, 0.11, o + (o > 0 ? 0.05 : -0.05)); g.add(w); }); var pl = new T.Mesh(new T.BoxGeometry(0.28, 0.03, 0.4), mt); pl.position.set(0.12, 0.03, 0); g.add(pl); g.rotation.z = -0.15; }
      else { var bd = new T.Mesh(new T.BoxGeometry(0.6, 0.04, 0.45), M(0x5A3D26)); bd.position.y = 0.09; g.add(bd); [[-0.25, -0.18], [0.25, -0.18], [-0.25, 0.18], [0.25, 0.18]].forEach(function (p) { var w = new T.Mesh(new T.SphereGeometry(0.045, 8, 6), bk); w.position.set(p[0], 0.045, p[1]); g.add(w); }); }
      g.position.set(x, 0, z); g.rotation.y = rot || 0; G.add(g); lab(kind === 'diable' ? 'Diable' : 'Chariot rouleur', '#AEB4BB', x, 1.6, z, 1.3); };
    tool('diable', Dout.x - 0.2, W / 2 + 1.3, 0.4); tool('rouleur', L + 1.3, W / 2 + 1.0, 0);
    var ramp = BX(1.1, 0.04, Math.min(1.2, W * 0.7), L + 0.55, 0.12, W / 2, M(0x8A9199, { metalness: 0.5, roughness: 0.4 })); ramp.rotation.z = -0.18;
    var paths = {};
    paths.inside = !F ? [new T.Vector3(bx + BD * 0.55, 0, zr - 0.9), Din] : lift ? [apt, new T.Vector3(lx - 1.0, nF * FH, lz)] : [apt, land(nF)];
    paths.liftTop = lift ? [apt, new T.Vector3(lx - 1.0, nF * FH, lz)] : paths.inside;
    paths.pair = null;
    paths.liftBot = lift ? [new T.Vector3(lx - 1.0, 0, lz), Din] : null;
    paths.street = [Din, Dout, TR];
    var posts = (cfg.posts || []).filter(function (p) { return p.n > 0; });
    var R = 0; posts.forEach(function (p) { if (p.key === 'relay') R += p.n; });
    var relayPath = function (j) { var hi = Math.round(nF - j * nF / R), lo = Math.round(nF - (j + 1) * nF / R); if (hi === lo) { hi = Math.min(nF, lo + 1); } var pts = []; for (var fl = hi; fl >= lo; fl--) pts.push(land(fl)); if (lo === 0) pts.push(Din); return { pts: pts, hi: hi === nF ? F : hi, lo: lo }; };
    var pairPath = function () { var pts = [apt]; if (lift) { pts.push(new T.Vector3(lx - 1.0, nF * FH, lz), new T.Vector3(lx - 1.0, 0, lz)); } else if (F) { for (var fl = nF; fl >= 0; fl--) pts.push(land(fl)); } pts.push(Din, Dout, TR); return pts; };
    var figs = [], walkers = [], sp = function (t, c) { return self.sprite(t, c); };
    var add = function (role, l) { var fg = figure(T, ROLEC[role], l, sp), lvl = 0; fg.traverse(function (o) { if (o.isSprite) { o.scale.multiplyScalar(KS * 0.85); o.position.y = 2.0 + 0.2 * KS; o.userData.base = o.position.y; LB.push({ sp: o, mov: true }); } }); G.add(fg); figs.push(fg); var bxm = new T.Mesh(new T.BoxGeometry(0.42, 0.32, 0.36), M(0xC69C63)); bxm.position.set(0.32, 1.0, 0); bxm.visible = false; fg.add(bxm); fg.userData.box = bxm; return fg; };
    var drv = add('chef', 'Chauffeur · chef d’équipe');
    var mi = 0, streetMen = [], rj = 0;
    posts.forEach(function (p) {
      for (var i = 0; i < p.n; i++) {
        mi++; var key = p.key, path, lbl;
        if (key === 'relay') { var rp = relayPath(rj); path = rp.pts; lbl = 'M' + mi + ' · relais ' + ordFl(rp.hi) + '→' + ordFl(rp.lo); rj++; }
        else if (key === 'pair' || key === 'heavy') { path = pairPath(); lbl = 'M' + mi + ' · ' + (key === 'heavy' ? 'binôme lourds' : 'binôme'); }
        else { path = paths[key] || paths.street; lbl = 'M' + mi + ' · ' + (p.short || key); }
        var fg = add('man', lbl), seg = [], len = 0; for (var q = 1; q < path.length; q++) { var dl = path[q].distanceTo(path[q - 1]); seg.push(dl); len += dl; }
        var duo = key === 'pair' || key === 'heavy', w = { fg: fg, path: path, seg: seg, len: Math.max(0.5, len), off: duo ? (key === 'heavy' ? 0.5 : 0) : (i * 0.5 + mi * 0.21) % 1, key: key, lat: duo ? (i % 2 ? 0.38 : -0.38) : 0 };
        if (key === 'heavy' && i % 2 === 0) { var hb = new T.Mesh(new T.BoxGeometry(0.75, 1.5, 0.7), M(0xECEEF0)); hb.visible = false; G.add(hb); w.hb = hb; }
        walkers.push(w); if (key === 'street') streetMen.push(w);
      }
    });
    var menus = []; for (var j = 0; j < (cfg.menu || 0); j++) { var mn = add('menu', 'Menuisier'); mn.position.set(apt.x - 1.2 - j * 0.6, apt.y, z0 + 1.2); mn.rotation.y = 0; menus.push(mn); }
    var dia = new T.Group(), dmt = M(0xB8BEC6, { metalness: 0.5, roughness: 0.4 }); [-0.2, 0.2].forEach(function (o) { var rl = new T.Mesh(new T.BoxGeometry(0.04, 1.3, 0.04), dmt); rl.position.set(0, 0.65, o); dia.add(rl); var wh = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 0.06, 14), M(0x23262B)); wh.rotation.x = Math.PI / 2; wh.position.set(-0.05, 0.12, o * 1.3); dia.add(wh); }); dia.visible = false; G.add(dia);
    var itLab = self.sprite(' ', '#F6D73C'); itLab.material.depthTest = false; itLab.renderOrder = 11; itLab.visible = false; G.add(itLab); var itTxt = '';
    var setItLab = function (t2) { if (t2 === itTxt) return; itTxt = t2; var ns = self.sprite(t2, '#F6D73C'); itLab.material.map.dispose(); itLab.material.map = ns.material.map; itLab.material.needsUpdate = true; itLab.scale.set(1.2 * (ns.userData.ar || 1) * KS * 0.8, 0.3 * KS * 0.8, 1); };
    var at = function (w, uu) { var d = uu * w.len, q = 0; while (q < w.seg.length - 1 && d > w.seg[q]) { d -= w.seg[q]; q++; } var a = w.path[q], b2 = w.path[q + 1] || a, f2 = w.seg[q] ? Math.min(1, d / w.seg[q]) : 0; return { p: a.clone().lerp(b2, f2), dx: b2.x - a.x, dz: b2.z - a.z }; };
    var walk = function (fg, t, mv) { var a2 = mv ? Math.sin(t * 9) * 0.5 : 0; fg.userData.legL.rotation.z = a2; fg.userData.legR.rotation.z = -a2; fg.userData.armL.rotation.z = -a2 * 0.6; fg.userData.armR.rotation.z = a2 * 0.6; };
    var carry = function (fg, on) { fg.userData.armL.rotation.x = on ? -0.9 : 0; fg.userData.armR.rotation.x = on ? 0.9 : 0; fg.userData.box.visible = !!on; };
    (this.items || []).forEach(function (it) { if (!it.g.userData.home) it.g.userData.home = it.g.position.clone(); });
    var allX = [-1, bx + BD + 0.8], cx = (allX[0] + allX[1]) / 2, cy = topY * 0.45, cz = W / 2, rr = 0.5 * Math.sqrt(Math.pow(allX[1] - allX[0], 2) + Math.pow(topY + 2, 2) + Math.pow(BW * 0.6, 2)) * (nF >= 4 ? 1.12 : 1);
    this._crewBox = { cx: cx, cy: cy, cz: cz, r: rr };
    var t0 = performance.now(), V1 = 0.75;
    var frame = function (t) {
      var cur = self._step, it = null; walkers.forEach(function (w) { w.busy = false; }); (self.items || []).forEach(function (x) { if (x.b.step === cur) it = x; });
      (self.items || []).forEach(function (x) { if (x !== it && x.g.userData.home) x.g.position.copy(x.g.userData.home); });
      walkers.forEach(function (w) {
        if (it && w.busy) return;
        var ph = ((t * (w.key === 'heavy' ? V1 * 0.6 : V1) / w.len) + w.off) % 2, go = ph < 1, r = at(w, go ? ph : 2 - ph); w.fg.position.copy(r.p); var dx = go ? r.dx : -r.dx, dz = go ? r.dz : -r.dz, dl = Math.hypot(r.dx, r.dz) || 1; if (w.lat) { w.fg.position.x += -r.dz / dl * w.lat; w.fg.position.z += r.dx / dl * w.lat; } if (Math.abs(dx) + Math.abs(dz) > 1e-4) w.fg.rotation.y = Math.atan2(-dz, dx); walk(w.fg, t, true);
        if (w.key === 'heavy') { w.fg.userData.box.visible = false; w.fg.userData.armL.rotation.x = go ? -1.1 : 0; w.fg.userData.armR.rotation.x = go ? 1.1 : 0; if (w.hb) { w.hb.visible = go; w.hb.position.set(r.p.x, r.p.y + 0.95, r.p.z); w.hb.rotation.y = Math.atan2(-r.dz, r.dx); } } else carry(w.fg, go);
      });
      if (it) {
        var b = it.b, home = it.g.userData.home, u = (t % 4.2) / 4.2, sx = Dout.x, ex = L + 0.35, zc = W / 2, yc = Math.max(0.95, b.dy / 2 + 0.05);
        var p = u < 0.62 ? u / 0.62 : 1, q2 = u < 0.62 ? 0 : Math.min(1, (u - 0.62) / 0.25), x = sx + (ex - sx) * p;
        if (q2 <= 0) it.g.position.set(x, yc, zc); else it.g.position.set(ex + (home.x - ex) * q2, yc + (home.y - yc) * q2, zc + (home.z - zc) * q2);
        var hk = handOf(b), pool = streetMen.concat(walkers.filter(function (w) { return streetMen.indexOf(w) < 0 && w.key !== 'heavy'; })), cm = pool.slice(0, Math.max(1, Math.min(pool.length, hk.n)));
        if (hk.tool === 'diable') { dia.visible = true; dia.position.set(x + (q2 <= 0 ? 0.55 : 99), 0, zc); dia.rotation.z = -0.35; } else dia.visible = false;
        itLab.visible = q2 <= 0; itLab.position.set(x, yc + b.dy / 2 + 0.5 * KS, zc); setItLab(hk.n + (hk.n > 1 ? ' porteurs' : ' porteur') + (hk.tool ? ' · ' + hk.tool : ''));
        cm.forEach(function (w) { w.busy = true; }); walkers.forEach(function (w) { if (w.busy) return; }); cm.forEach(function (w, c) { var off = (c % 2 ? 1 : -1) * (b.dz / 2 + 0.28) + (c >= 2 ? (c % 2 ? 0.35 : -0.35) : 0), xo = c >= 2 ? (c === 2 ? -1 : 1) * (b.dx / 2 + 0.25) * 0 + (c >= 2 ? b.dx / 2 + 0.3 : 0) : 0; w.fg.userData.box.visible = false; if (q2 <= 0) { w.fg.position.set(x + xo, 0, zc + off); w.fg.rotation.y = Math.PI; walk(w.fg, t, true); w.fg.userData.armL.rotation.x = -0.9; w.fg.userData.armR.rotation.x = 0.9; } else { var bk = Math.min(1, (u - 0.62) / 0.38); w.fg.position.set(ex + 0.4 + (sx - ex) * bk * 0.7, 0, zc + off); w.fg.rotation.y = 0; walk(w.fg, t, true); carry(w.fg, false); } });
        drv.position.set(Math.max(0.4, Math.min(L - 0.4, home.x + (home.x > L / 2 ? 0.7 : -0.7))), 0, Math.max(0.3, Math.min(W - 0.3, home.z + (home.z > W / 2 ? -0.5 : 0.5)))); drv.rotation.y = home.x > drv.position.x ? 0 : Math.PI; walk(drv, t, q2 > 0 && q2 < 1); carry(drv, false);
      } else { drv.position.set(Math.max(0.5, L - 0.6), 0, W / 2); walk(drv, t, false); carry(drv, false); dia.visible = false; itLab.visible = false; }
      if (cab) { var cyc = (t % 8) / 8, hy = nF * FH, yy = cyc < 0.4 ? hy * (1 - cyc / 0.4) : cyc < 0.5 ? 0 : cyc < 0.9 ? hy * (cyc - 0.5) / 0.4 : hy; cab.position.y = yy + 1.05; }
      if (!it) { drv.userData.armR.rotation.x = 0.6 + Math.sin(t * 2) * 0.4; }
      menus.forEach(function (m, i) { m.userData.armR.rotation.x = 0.8 + Math.sin(t * 7 + i) * 0.5; m.userData.armL.rotation.x = -0.4; });
    };
    var vA = new T.Vector3(), vB = new T.Vector3(), vR = new T.Vector3(), vU = new T.Vector3();
    var rectOf = function (sp) { sp.getWorldPosition(vA); var c = vA.clone().project(self.cam); vB.copy(vA).addScaledVector(vR, sp.scale.x / 2).project(self.cam); var hw = Math.abs(vB.x - c.x); vB.copy(vA).addScaledVector(vU, sp.scale.y / 2).project(self.cam); var hh = Math.abs(vB.y - c.y); return { x0: c.x - hw, x1: c.x + hw, y0: c.y - hh * 0.6, y1: c.y + hh * 0.6, cy: c.y, vis: c.z < 1 }; };
    var hit = function (a, b) { return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1; };
    var declutter = function () {
      self.cam.updateMatrixWorld(); vR.setFromMatrixColumn(self.cam.matrixWorld, 0).normalize(); vU.setFromMatrixColumn(self.cam.matrixWorld, 1).normalize();
      LB.forEach(function (l) { if (l.mov) l.sp.position.y = l.sp.userData.base; });
      var placed = LB.filter(function (l) { return !l.mov && l.sp.visible; }).map(function (l) { return rectOf(l.sp); });
      var mv = LB.filter(function (l) { return l.mov; }).map(function (l) { return { l: l, r: rectOf(l.sp) }; }).sort(function (a, b) { return a.r.cy - b.r.cy; });
      mv.forEach(function (m) { var r = m.r, k = 0, st = 0.28 * KS; while (k < 14 && placed.some(function (p) { return hit(r, p); })) { m.l.sp.position.y += st; r = rectOf(m.l.sp); k++; } placed.push(r); });
    };
    var tick = function () { if (!self.ok || !self._crewOn || !self.el.isConnected) { self._crewRaf = 0; return; } frame((performance.now() - t0) / 1000); declutter(); self.r.render(self.scene, self.cam); self._crewRaf = requestAnimationFrame(tick); };
    this.setView(this._v || 'iso');
    if (cfg.still) { frame(cfg.still); declutter(); this.r.render(this.scene, this.cam); } else this._crewRaf = requestAnimationFrame(tick);
  };
  function crewShot(P, ti, cfg, opt) {
    if (!window.THREE || !P || !P.trips[ti]) return null; var el = document.createElement('div'); el.style.cssText = 'position:fixed;left:-12000px;top:0;width:1400px;height:900px';
    document.body.appendChild(el); var v = new View(el, {}), url = null;
    if (v.ok) { v.r.setClearColor(0x1E2023, 1); v.size(); v.load(P.trips[ti], P, opt || {}); v._v = 'iso'; v.crew(Object.assign({}, cfg, { on: true, still: 2.35 })); url = v.snap(0.88); v.dispose(); }
    el.remove(); return url;
  }
  function snapshot(P, ti, opt) {
    if (!window.THREE || !P || !P.trips[ti]) return null; var el = document.createElement('div'); el.style.cssText = 'position:fixed;left:-12000px;top:0;width:1200px;height:640px';
    document.body.appendChild(el); var v = new View(el, {}), url = null;
    if (v.ok) { v.r.setClearColor(0xFFFFFF, 1); v.size(); v.load(P.trips[ti], P, opt); v.setView('iso'); url = v.snap(); v.dispose(); }
    el.remove(); return url;
  }
  var SHOTS = {};
  function cropShot(cv, aspect, bg, q) {
    var w = cv.width, hgt = cv.height, c2 = document.createElement('canvas'); c2.width = w; c2.height = hgt; var g = c2.getContext('2d'); g.drawImage(cv, 0, 0);
    var d = g.getImageData(0, 0, w, hgt).data, br = (bg >> 16) & 255, bgc = (bg >> 8) & 255, bb = bg & 255, x0 = w, y0 = hgt, x1 = -1, y1 = -1;
    for (var y = 0; y < hgt; y += 2) for (var x = 0; x < w; x += 2) { var i = (y * w + x) * 4; if (Math.abs(d[i] - br) + Math.abs(d[i + 1] - bgc) + Math.abs(d[i + 2] - bb) > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    if (x1 < 0) return cv.toDataURL('image/jpeg', q || 0.88);
    var pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.03); x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w, x1 + pad); y1 = Math.min(hgt, y1 + pad);
    var bw = x1 - x0, bh = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; if (bw / bh > aspect) bh = bw / aspect; else bw = bh * aspect;
    var out = document.createElement('canvas'), OW = 1100; out.width = OW; out.height = Math.round(OW / aspect); var o = out.getContext('2d'); o.fillStyle = '#' + ('00000' + bg.toString(16)).slice(-6); o.fillRect(0, 0, out.width, out.height);
    o.drawImage(c2, cx - bw / 2, cy - bh / 2, bw, bh, 0, 0, out.width, out.height); return out.toDataURL('image/jpeg', q || 0.88);
  }
  function stepShots(P, ti, opt, key) {
    if (key && SHOTS[key]) return SHOTS[key];
    if (!window.THREE || !P || !P.trips[ti]) return null; opt = opt || {};
    var el = document.createElement('div'); el.style.cssText = 'position:fixed;left:-12000px;top:0;width:1400px;height:1100px'; document.body.appendChild(el);
    var v = new View(el, {}), out = [];
    if (v.ok) { v.ghost = false; v.hlLast = true; v.r.setClearColor(opt.bg != null ? opt.bg : 0x1E2023, 1); v.size(); v.load(P.trips[ti], P, opt); v.setView('iso'); var n = P.trips[ti].boxes.length; for (var i = 1; i <= n; i++) { v._step = i; var bi = P.trips[ti].boxes[i - 1]; if (bi) v.focus(bi); v.paint(); v.r.render(v.scene, v.cam); out.push(opt.aspect ? cropShot(v.r.domElement, opt.aspect, opt.bg != null ? opt.bg : 0x1E2023, 0.88) : v.snap(0.85)); } v.dispose(); }
    el.remove(); if (key) { var ks = Object.keys(SHOTS); if (ks.length > 12) delete SHOTS[ks[0]]; SHOTS[key] = out; } return out;
  }
  function view(el, opts) {
    if (!el) return null;
    if (el.__dsim && el.__dsim.ok) { el.__dsim.opts = opts || el.__dsim.opts; return el.__dsim; }
    if (!window.THREE) return null;
    el.__dsim = new View(el, opts); return el.__dsim;
  }
  window.DemSim = { cropShot: cropShot, blanket: BLK, crewShot: crewShot, plan: plan, view: view, snapshot: snapshot, stepShots: stepShots, shots: function (k) { return SHOTS[k] || null; }, colors: COLORS, legend: LEG };
})();
