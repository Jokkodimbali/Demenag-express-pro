(function () {
  'use strict';
  var INK = '#1E2023', Y = '#F6D73C', G = '#AEB4BB', DK = '#30343A';
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function wheel(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = DK; g.fill(); g.stroke(); g.beginPath(); g.arc(x, y, r * 0.38, 0, 7); g.fillStyle = G; g.fill(); g.stroke(); }
  var D = {
    diable: function (g) {
      g.save(); g.translate(200, 150); g.rotate(-0.22); g.translate(-200, -150);
      g.fillStyle = Y; rr(g, 150, 40, 18, 215, 8); g.fill(); g.stroke(); rr(g, 232, 40, 18, 215, 8); g.fill(); g.stroke();
      [80, 130, 180, 225].forEach(function (y) { g.beginPath(); g.moveTo(168, y); g.lineTo(232, y); g.stroke(); });
      g.beginPath(); g.moveTo(150, 48); g.quadraticCurveTo(200, 0, 250, 48); g.stroke();
      g.fillStyle = G; rr(g, 140, 250, 125, 14, 4); g.fill(); g.stroke(); g.restore();
      wheel(g, 150, 252, 26); wheel(g, 262, 236, 26);
    },
    rouleur: function (g) {
      g.fillStyle = '#B48558'; g.beginPath(); g.moveTo(70, 150); g.lineTo(250, 110); g.lineTo(340, 150); g.lineTo(160, 195); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#8C6440'; g.beginPath(); g.moveTo(70, 150); g.lineTo(160, 195); g.lineTo(160, 212); g.lineTo(70, 167); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(160, 195); g.lineTo(340, 150); g.lineTo(340, 167); g.lineTo(160, 212); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = DK; [[90, 160, 0.9], [175, 205, 1], [325, 160, 1]].forEach(function (p) { g.beginPath(); g.moveTo(p[0] - 4, p[1] + 10); g.lineTo(p[0] + 4, p[1] + 10); g.stroke(); wheel(g, p[0], p[1] + 26 * p[2], 15 * p[2]); });
      g.fillStyle = '#FFFFFF'; g.globalAlpha = 0.5; g.beginPath(); g.moveTo(120, 148); g.lineTo(240, 122); g.stroke(); g.globalAlpha = 1;
    },
    portage: function (g) {
      g.lineWidth = 22; g.strokeStyle = Y; g.lineCap = 'round';
      g.beginPath(); g.moveTo(70, 70); g.bezierCurveTo(140, 300, 260, 300, 330, 70); g.stroke();
      g.lineWidth = 6; g.strokeStyle = INK; g.beginPath(); g.moveTo(59, 74); g.bezierCurveTo(129, 316, 271, 316, 341, 74); g.stroke(); g.beginPath(); g.moveTo(81, 66); g.bezierCurveTo(151, 284, 249, 284, 319, 66); g.stroke();
      [[70, 58], [330, 58]].forEach(function (p) { g.beginPath(); g.ellipse(p[0], p[1], 30, 22, 0, 0, 7); g.stroke(); });
      g.fillStyle = INK; g.font = '800 22px Montserrat, sans-serif'; g.textAlign = 'center'; g.fillText('× 2', 200, 150);
    },
    cliquet: function (g) {
      g.lineWidth = 16; g.strokeStyle = '#E0A526'; g.lineCap = 'butt'; g.beginPath(); g.moveTo(80, 170); g.lineTo(320, 170); g.stroke();
      g.lineWidth = 6; g.strokeStyle = INK; g.beginPath(); g.moveTo(80, 162); g.lineTo(320, 162); g.moveTo(80, 178); g.lineTo(320, 178); g.stroke();
      g.fillStyle = G; rr(g, 160, 140, 80, 60, 8); g.fill(); g.stroke(); g.fillStyle = DK; rr(g, 200, 100, 70, 22, 8); g.fill(); g.stroke(); g.beginPath(); g.moveTo(205, 120); g.lineTo(195, 142); g.moveTo(262, 120); g.lineTo(235, 142); g.stroke();
      [[80, -1], [320, 1]].forEach(function (p) { var x = p[0], s = p[1], hx = x + 26 * s; g.beginPath(); g.moveTo(x, 170); g.lineTo(hx, 170); g.stroke(); g.beginPath(); g.moveTo(hx, 170); g.quadraticCurveTo(hx + 30 * s, 172, hx + 26 * s, 205); g.quadraticCurveTo(hx + 22 * s, 226, hx + 6 * s, 214); g.stroke(); });
      g.fillStyle = INK; g.font = '800 20px Montserrat, sans-serif'; g.textAlign = 'center'; g.fillText('LC 400 daN', 200, 240);
    },
    serviette: function (g) {
      g.fillStyle = '#17181B'; rr(g, 70, 60, 260, 190, 14); g.fill(); g.stroke();
      g.save(); rr(g, 70, 60, 260, 190, 14); g.clip(); g.strokeStyle = 'rgba(200,206,212,0.7)'; g.lineWidth = 2; g.setLineDash([7, 6]);
      for (var k = -260; k < 400; k += 40) { g.beginPath(); g.moveTo(70 + k, 60); g.lineTo(70 + k + 190, 250); g.stroke(); g.beginPath(); g.moveTo(70 + k + 190, 60); g.lineTo(70 + k, 250); g.stroke(); }
      g.restore(); g.setLineDash([]); g.strokeStyle = Y; g.lineWidth = 5; rr(g, 78, 68, 244, 174, 10); g.stroke(); g.strokeStyle = INK; g.lineWidth = 6;
    },
    gants: function (g) {
      g.fillStyle = Y; g.beginPath(); g.moveTo(130, 270); g.lineTo(130, 150);
      [[135, 60], [180, 45], [225, 52], [268, 78]].forEach(function (p, i) { var w = 38; g.lineTo(p[0], p[1] + 20); g.arc(p[0] + w / 2, p[1] + 20, w / 2, Math.PI, 0); g.lineTo(p[0] + w, 150); });
      g.lineTo(306, 150); g.quadraticCurveTo(350, 140, 340, 175); g.lineTo(290, 230); g.lineTo(290, 270); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = DK; rr(g, 122, 262, 176, 30, 6); g.fill(); g.stroke();
      g.fillStyle = INK; [155, 200, 245].forEach(function (x) { g.beginPath(); g.arc(x, 200, 6, 0, 7); g.fill(); });
    },
    chaussures: function (g) {
      g.fillStyle = '#5A3D26'; g.beginPath(); g.moveTo(110, 60); g.lineTo(200, 60); g.lineTo(205, 150); g.quadraticCurveTo(300, 160, 330, 200); g.lineTo(335, 240); g.lineTo(90, 240); g.lineTo(95, 150); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = G; g.beginPath(); g.moveTo(265, 165); g.quadraticCurveTo(320, 172, 333, 205); g.lineTo(335, 240); g.lineTo(265, 240); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = DK; rr(g, 82, 238, 260, 22, 6); g.fill(); g.stroke();
      g.strokeStyle = Y; g.lineWidth = 5; [90, 112, 134].forEach(function (y) { g.beginPath(); g.moveTo(150, y); g.lineTo(200, y + 4); g.stroke(); }); g.strokeStyle = INK; g.lineWidth = 6;
    },
    rampe: function (g) {
      g.fillStyle = DK; rr(g, 250, 120, 120, 150, 8); g.fill(); g.stroke();
      g.fillStyle = G; g.beginPath(); g.moveTo(40, 268); g.lineTo(255, 128); g.lineTo(268, 146); g.lineTo(58, 270); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = INK; g.lineWidth = 3; for (var i = 1; i < 9; i++) { var t = i / 9, x = 40 + 215 * t, y = 268 - 140 * t; g.beginPath(); g.moveTo(x + 4, y + 4); g.lineTo(x + 16, y + 20); g.stroke(); }
      g.lineWidth = 6; g.beginPath(); g.moveTo(20, 270); g.lineTo(380, 270); g.stroke();
    },
    film: function (g) {
      g.fillStyle = '#DCEAF2'; g.beginPath(); g.moveTo(110, 90); g.lineTo(330, 120); g.lineTo(320, 270); g.lineTo(110, 230); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#EEF5F9'; rr(g, 80, 60, 60, 190, 26); g.fill(); g.stroke(); g.fillStyle = DK; rr(g, 98, 40, 24, 30, 6); g.fill(); g.stroke(); rr(g, 98, 240, 24, 30, 6); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(30,32,35,0.35)'; g.lineWidth = 3; [140, 180, 220].forEach(function (y) { g.beginPath(); g.moveTo(140, y); g.lineTo(320, y + 20); g.stroke(); }); g.strokeStyle = INK; g.lineWidth = 6;
    },
    visseuse: function (g) {
      g.fillStyle = Y; rr(g, 90, 80, 200, 70, 20); g.fill(); g.stroke(); g.fillStyle = DK; rr(g, 290, 100, 40, 30, 6); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(330, 115); g.lineTo(375, 115); g.stroke();
      g.fillStyle = Y; g.beginPath(); g.moveTo(150, 150); g.lineTo(200, 150); g.lineTo(190, 250); g.lineTo(140, 250); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = DK; rr(g, 115, 245, 110, 40, 8); g.fill(); g.stroke(); g.beginPath(); g.moveTo(205, 165); g.lineTo(215, 185); g.stroke();
    },
    eau: function (g) {
      g.fillStyle = '#CFE6F5'; g.beginPath(); g.moveTo(160, 90); g.quadraticCurveTo(150, 110, 140, 130); g.lineTo(140, 280); g.quadraticCurveTo(140, 292, 152, 292); g.lineTo(248, 292); g.quadraticCurveTo(260, 292, 260, 280); g.lineTo(260, 130); g.quadraticCurveTo(250, 110, 240, 90); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#3E7CB1'; rr(g, 168, 52, 64, 40, 8); g.fill(); g.stroke(); g.fillStyle = Y; rr(g, 140, 170, 120, 54, 4); g.fill(); g.stroke();
      g.fillStyle = INK; g.font = '800 22px Montserrat, sans-serif'; g.textAlign = 'center'; g.fillText('1 L / h', 200, 205);
    },
    tapis: function (g) {
      g.fillStyle = '#2A2D31'; g.beginPath(); g.moveTo(40, 190); g.lineTo(230, 120); g.lineTo(360, 170); g.lineTo(170, 245); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#6B737B'; for (var i = 1; i < 8; i++) for (var j = 1; j < 6; j++) { var u = i / 8, v = j / 6, x = 40 + 190 * u + 130 * v, y = 190 - 70 * u + 55 * v; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
      g.fillStyle = INK; g.font = '800 20px Montserrat, sans-serif'; g.textAlign = 'center'; g.fillText('μ ≥ 0,6', 200, 285);
    }
  };
  var cache = {};
  function art(kind) {
    if (cache[kind]) return cache[kind]; var fn = D[kind]; if (!fn || typeof document === 'undefined') return null;
    var c = document.createElement('canvas'); c.width = 400; c.height = 300; var g = c.getContext('2d');
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 400, 300); g.strokeStyle = INK; g.lineWidth = 6; g.lineJoin = 'round'; g.lineCap = 'round';
    try { fn(g); } catch (e) {} cache[kind] = c.toDataURL('image/png'); return cache[kind];
  }
  window.EquipArt = { art: art, kinds: Object.keys(D) };
})();
