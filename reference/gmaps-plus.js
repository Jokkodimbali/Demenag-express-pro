(function () {
  'use strict';
  var Y = '#F6D73C', D = '#1E2023', P = '#272A2E', B = '#3B4046';
  var css = function (el, s) { el.style.cssText = s; return el; };
  var mk = function (tag, s, html) { var e = document.createElement(tag); if (s) e.style.cssText = s; if (html != null) e.innerHTML = html; return e; };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var BTN = 'background:' + P + ';color:#fff;border:1px solid ' + B + ';border-radius:10px;padding:0 12px;min-height:38px;font:800 12.5px Montserrat,sans-serif;cursor:pointer;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.35)';
  var gok = function (o) { return o && o.gReady ? Promise.resolve(o.gReady()).catch(function () { return false; }) : Promise.resolve(false); };
  var gmLink = function (ll) { return 'https://www.google.com/maps/search/?api=1&query=' + ll[0] + ',' + ll[1]; };
  var svLink = function (ll) { return 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + ll[0] + ',' + ll[1]; };

  async function suggest(q, o, near) {
    if (await gok(o)) {
      try {
        var lib = await google.maps.importLibrary('places');
        if (lib.AutocompleteSuggestion) {
          var r = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: q, language: 'fr', region: 'sn', includedRegionCodes: ['sn'], locationBias: near ? { center: { lat: near[0], lng: near[1] }, radius: 30000 } : undefined });
          return (r.suggestions || []).filter(function (s) { return s.placePrediction; }).slice(0, 6).map(function (s) { var p = s.placePrediction; return { main: p.mainText ? p.mainText.text : p.text.text, sub: p.secondaryText ? p.secondaryText.text : '', g: p }; });
        }
      } catch (e) {}
      try {
        var svc = new google.maps.places.AutocompleteService();
        var preds = await new Promise(function (ok) { svc.getPlacePredictions({ input: q, componentRestrictions: { country: 'sn' }, language: 'fr' }, function (p) { ok(p || []); }); });
        return preds.slice(0, 6).map(function (p) { return { main: p.structured_formatting.main_text, sub: p.structured_formatting.secondary_text || '', pid: p.place_id }; });
      } catch (e) {}
    }
    try {
      var j = await (await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=sn&accept-language=fr&limit=6&q=' + encodeURIComponent(q))).json();
      return j.map(function (x) { var parts = x.display_name.split(', '); return { main: parts[0], sub: parts.slice(1, 4).join(', '), ll: [+x.lat, +x.lon] }; });
    } catch (e) { return []; }
  }
  async function resolve(s) {
    if (s.ll) return { ll: s.ll, name: s.main, addr: [s.main, s.sub].filter(Boolean).join(', ') };
    try {
      if (s.g) { var pl = s.g.toPlace(); await pl.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] }); return { ll: [pl.location.lat(), pl.location.lng()], name: pl.displayName, addr: pl.formattedAddress }; }
      if (s.pid) { var ps = new google.maps.places.PlacesService(document.createElement('div')); var d = await new Promise(function (ok) { ps.getDetails({ placeId: s.pid, fields: ['name', 'formatted_address', 'geometry'] }, function (r) { ok(r); }); }); if (d) return { ll: [d.geometry.location.lat(), d.geometry.location.lng()], name: d.name, addr: d.formatted_address }; }
    } catch (e) {}
    return null;
  }
  async function placeAt(ll, o) {
    if (await gok(o)) {
      try {
        var lib = await google.maps.importLibrary('places');
        if (lib.Place && lib.Place.searchNearby) {
          var r = await lib.Place.searchNearby({ fields: ['displayName', 'formattedAddress', 'location', 'photos', 'rating', 'userRatingCount', 'googleMapsURI', 'nationalPhoneNumber', 'primaryTypeDisplayName'], locationRestriction: { center: { lat: ll[0], lng: ll[1] }, radius: 60 }, maxResultCount: 5, rankPreference: lib.SearchNearbyRankPreference ? lib.SearchNearbyRankPreference.DISTANCE : undefined, language: 'fr', region: 'sn' });
          var p = r.places && r.places[0];
          if (p) return { name: p.displayName, addr: p.formattedAddress, type: p.primaryTypeDisplayName || '', rating: p.rating, n: p.userRatingCount, tel: p.nationalPhoneNumber, url: p.googleMapsURI, ll: [p.location.lat(), p.location.lng()], photos: (p.photos || []).slice(0, 6).map(function (ph) { return ph.getURI({ maxWidth: 480 }); }) };
        }
      } catch (e) {}
      try {
        var ps = new google.maps.places.PlacesService(document.createElement('div'));
        var near = await new Promise(function (ok) { ps.nearbySearch({ location: { lat: ll[0], lng: ll[1] }, radius: 60 }, function (rr) { ok(rr || []); }); });
        var f = near.filter(function (x) { return (x.types || []).indexOf('route') < 0 && (x.types || []).indexOf('locality') < 0 && (x.types || []).indexOf('political') < 0; })[0];
        if (f) {
          var d = await new Promise(function (ok) { ps.getDetails({ placeId: f.place_id, fields: ['name', 'formatted_address', 'photos', 'rating', 'user_ratings_total', 'url', 'formatted_phone_number', 'geometry'] }, function (x) { ok(x); }); });
          if (d) return { name: d.name, addr: d.formatted_address, rating: d.rating, n: d.user_ratings_total, tel: d.formatted_phone_number, url: d.url, ll: [d.geometry.location.lat(), d.geometry.location.lng()], photos: (d.photos || []).slice(0, 6).map(function (ph) { return ph.getUrl({ maxWidth: 480 }); }) };
        }
      } catch (e) {}
    }
    try {
      var j = await (await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=fr&zoom=18&lat=' + ll[0] + '&lon=' + ll[1])).json(), a = j.address || {};
      var v = a.city || a.town || a.village || a.county || '', q = a.neighbourhood || a.quarter || a.suburb || '', rd = a.road || '';
      return { name: j.name || rd || q || 'Point sélectionné', addr: [v, q, rd].filter(Boolean).join(', ') || j.display_name, ll: ll, photos: [], url: gmLink(ll), nokey: true };
    } catch (e) { return { name: 'Point sélectionné', addr: ll[0].toFixed(5) + ', ' + ll[1].toFixed(5), ll: ll, photos: [], url: gmLink(ll), nokey: true }; }
  }
  async function routes(a, b, o) {
    if (await gok(o)) {
      try {
        var ds = new google.maps.DirectionsService();
        var r = await ds.route({ origin: { lat: a[0], lng: a[1] }, destination: { lat: b[0], lng: b[1] }, travelMode: 'DRIVING', provideRouteAlternatives: true, drivingOptions: { departureTime: new Date(Date.now() + 60000), trafficModel: 'bestguess' }, language: 'fr', region: 'SN' });
        var out = (r.routes || []).map(function (rt) { var lg = rt.legs[0]; return { coords: rt.overview_path.map(function (p) { return [p.lat(), p.lng()]; }), km: Math.round(lg.distance.value / 100) / 10, min: Math.round(((lg.duration_in_traffic || lg.duration).value) / 60), via: rt.summary || '', g: 1 }; });
        if (out.length) return out;
      } catch (e) {}
    }
    try {
      var j = await (await fetch('https://router.project-osrm.org/route/v1/driving/' + a[1] + ',' + a[0] + ';' + b[1] + ',' + b[0] + '?overview=full&geometries=geojson&alternatives=3&steps=true')).json();
      return (j.routes || []).map(function (rt) {
        var names = {}; (rt.legs[0].steps || []).forEach(function (s) { if (s.name && s.distance > 300) names[s.name] = (names[s.name] || 0) + s.distance; });
        var via = Object.keys(names).sort(function (x, y) { return names[y] - names[x]; }).slice(0, 2).join(', ');
        return { coords: rt.geometry.coordinates.map(function (c) { return [c[1], c[0]]; }), km: Math.round(rt.distance / 100) / 10, min: Math.round(rt.duration / 60), via: via };
      });
    } catch (e) { return []; }
  }

  function layerCtl(map, o) {
    var cur = 'm', tr = true, at = null, box = mk('div', 'display:flex;gap:3px;background:' + D + ';border:1px solid ' + B + ';border-radius:12px;padding:3px;box-shadow:0 2px 8px rgba(0,0,0,.35)');
    var legend = mk('div', 'position:absolute;left:10px;bottom:' + (o.legendBottom || 24) + 'px;z-index:999;display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;max-width:calc(100% - 20px);box-sizing:border-box;background:' + D + ';border:1px solid ' + B + ';border-radius:10px;padding:6px 10px;font:700 11.5px Montserrat,sans-serif;color:#D5D9DE;box-shadow:0 2px 8px rgba(0,0,0,.35);pointer-events:none');
    var sw = function (c, l) { return '<span style="display:flex;align-items:center;gap:4px"><span style="width:16px;height:5px;border-radius:3px;background:' + c + '"></span>' + l + '</span>'; };
    var dot = '<span style="width:8px;height:8px;border-radius:50%;background:#3DDC84;box-shadow:0 0 0 3px rgba(61,220,132,.25)"></span>';
    var paintLeg = function () { var t = at ? ('0' + at.getHours()).slice(-2) + ':' + ('0' + at.getMinutes()).slice(-2) : '--:--', nar = map.getSize().x < 480; legend.innerHTML = dot + '<span style="color:#fff">' + (nar ? 'Trafic · ' : 'Trafic en direct · ') + t + '</span>' + (nar ? '<span style="display:flex;gap:2px"><span style="width:12px;height:5px;border-radius:3px;background:#1EA362"></span><span style="width:12px;height:5px;border-radius:3px;background:#FFA400"></span><span style="width:12px;height:5px;border-radius:3px;background:#E3262F"></span><span style="width:12px;height:5px;border-radius:3px;background:#811F1F"></span></span>' : sw('#1EA362', 'Fluide') + sw('#FFA400', 'Ralenti') + sw('#E3262F', 'Bouchon') + sw('#811F1F', 'Bloqué')); legend.style.display = tr ? 'flex' : 'none'; };
    var url = function (base) { return base.replace(/lyrs=[a-z]+(,traffic)?/, 'lyrs=' + cur + (tr ? ',traffic' : '')).replace(/&t=\d+/, '') + '&t=' + Date.now(); };
    var apply = function () {
      at = new Date(); map.eachLayer(function (ly) { if (ly._url && /google\.com\/vt\/lyrs=/.test(ly._url)) { if (ly.__base == null) ly.__base = ly._url; ly.setUrl(url(ly.__base)); } });
      [].forEach.call(box.children, function (b) { var on = b.dataset.k === cur || (b.dataset.k === 'tr' && tr); b.style.background = on ? (b.dataset.k === 'tr' ? '#3DDC84' : Y) : 'transparent'; b.style.color = on ? D : '#fff'; });
      paintLeg();
    };
    [['m', 'Plan'], ['s', 'Satellite'], ['y', 'Hybride'], ['tr', 'Trafic']].forEach(function (x) { var b = mk('button', 'border:0;border-radius:9px;padding:0 10px;min-height:32px;font:800 12px Montserrat,sans-serif;cursor:pointer;background:transparent;color:#fff', x[1]); b.dataset.k = x[0]; b.type = 'button'; b.onclick = function (e) { e.stopPropagation(); if (x[0] === 'tr') tr = !tr; else cur = x[0]; apply(); }; box.appendChild(b); });
    map.getContainer().appendChild(legend); apply(); map.on('gp-resize resize', paintLeg);
    var iv = setInterval(function () { if (!map.getContainer().isConnected) { clearInterval(iv); return; } if (tr && document.visibilityState !== 'hidden') apply(); }, 60000);
    map.on('unload', function () { clearInterval(iv); });
    return box;
  }

  function attach(map, o) {
    o = o || {}; var L = window.L; if (!L || !map || map.__gplus) return; map.__gplus = true; map.__gpTop = o.top || 10;
    var root = map.getContainer(), overlay = null, svMode = false;
    var stop = function (el) { L.DomEvent.disableClickPropagation(el); L.DomEvent.disableScrollPropagation(el); return el; };
    var closeOv = function () { if (overlay) { overlay.remove(); overlay = null; } };
    var showOv = function (el) { closeOv(); overlay = stop(el); root.appendChild(el); };

    var top = stop(mk('div', 'position:absolute;top:' + (o.top || 10) + 'px;left:50px;right:' + (o.rightPad || 60) + 'px;z-index:1000;display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start;pointer-events:none'));
    var sWrap = mk('div', 'position:relative;flex:1 1 220px;max-width:380px;min-width:180px;pointer-events:auto');
    var inp = mk('input', 'width:100%;box-sizing:border-box;background:' + D + ';color:#fff;border:1px solid ' + B + ';border-radius:12px;padding:10px 12px;font:600 14px Montserrat,sans-serif;outline:none;box-shadow:0 2px 8px rgba(0,0,0,.35)');
    inp.placeholder = o.searchPh || 'Rechercher une adresse ou un lieu'; inp.type = 'search'; inp.autocomplete = 'off';
    var list = mk('div', 'position:absolute;left:0;right:0;top:calc(100% + 4px);background:' + D + ';border:1px solid ' + B + ';border-radius:12px;overflow:hidden;display:none;box-shadow:0 8px 20px rgba(0,0,0,.45)');
    sWrap.appendChild(inp); sWrap.appendChild(list); top.appendChild(sWrap);
    var tools = mk('div', 'display:flex;gap:6px;flex-wrap:wrap;pointer-events:auto');
    tools.appendChild(layerCtl(map, o));
    var svBtn = mk('button', BTN, 'Street View'); svBtn.type = 'button';
    svBtn.onclick = function (e) { e.stopPropagation(); svMode = !svMode; map.__gpSv = svMode; svBtn.style.background = svMode ? Y : P; svBtn.style.color = svMode ? D : '#fff'; svBtn.textContent = svMode ? 'Touchez la rue…' : 'Street View'; root.style.cursor = svMode ? 'crosshair' : ''; };
    tools.appendChild(svBtn);
    var tog = mk('button', BTN + ';min-width:40px;padding:0 10px', '☰'); tog.type = 'button'; tog.title = 'Options de la carte';
    var open = false; tog.onclick = function (e) { e.stopPropagation(); open = !open; tools.style.display = open ? 'flex' : 'none'; tog.style.background = open ? Y : P; tog.style.color = open ? D : '#fff'; };
    var lay = function () { var nar = map.getSize().x < 500; tog.style.display = nar ? 'inline-flex' : 'none'; tog.style.alignItems = 'center'; tog.style.justifyContent = 'center'; if (!nar) tools.style.display = 'flex'; else if (!open) tools.style.display = 'none'; sWrap.style.minWidth = nar ? '0' : '180px'; sWrap.style.flex = nar ? '1 1 0' : '1 1 220px'; [].forEach.call(tools.querySelectorAll('button'), function (b) { b.style.minHeight = nar ? '30px' : ''; }); paintLegSafe(); };
    var paintLegSafe = function () { try { map.fire('gp-resize'); } catch (e) {} };
    var row = mk('div', 'display:flex;gap:6px;flex:1 1 260px;max-width:440px;min-width:0;align-items:flex-start;pointer-events:auto'); top.insertBefore(row, sWrap); row.appendChild(sWrap); row.appendChild(tog);
    top.appendChild(tools); root.appendChild(top); map.on('resize', lay); setTimeout(lay, 0);

    var tmp = null, dropTmp = function (ll) { if (tmp) tmp.remove(); tmp = L.circleMarker(ll, { radius: 9, color: '#fff', weight: 3, fillColor: '#1A73E8', fillOpacity: 1 }).addTo(map); };
    var pick = async function (s) {
      list.style.display = 'none'; inp.value = s.main; var r = await resolve(s); if (!r) return;
      map.setView(r.ll, Math.max(map.getZoom(), 16));
      if (o.onUse) info(r.ll, r); else dropTmp(r.ll);
    };
    var t = 0, seq = 0;
    inp.addEventListener('input', function () {
      clearTimeout(t); var q = inp.value.trim(); if (q.length < 3) { list.style.display = 'none'; return; }
      t = setTimeout(async function () { var my = ++seq, c = map.getCenter(), rs = await suggest(q, o, [c.lat, c.lng]); if (my !== seq) return;
        list.innerHTML = ''; if (!rs.length) { list.appendChild(mk('div', 'padding:10px 12px;font:600 13px Montserrat,sans-serif;color:#AEB4BB', 'Aucun résultat')); }
        rs.forEach(function (s) { var it = mk('button', 'display:flex;flex-direction:column;gap:2px;width:100%;text-align:left;background:transparent;border:0;border-top:1px solid ' + B + ';padding:9px 12px;cursor:pointer;color:#fff', '<span style="font:800 13.5px Montserrat,sans-serif">' + esc(s.main) + '</span><span style="font:500 12px Montserrat,sans-serif;color:#AEB4BB">' + esc(s.sub) + '</span>'); it.type = 'button'; it.onclick = function (e) { e.stopPropagation(); pick(s); }; list.appendChild(it); });
        list.style.display = 'block'; }, 280);
    });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var f = list.querySelector('button'); if (f) f.click(); } if (e.key === 'Escape') list.style.display = 'none'; });
    map.on('click', function () { list.style.display = 'none'; });

    var info = async function (ll, pre) {
      var card = mk('div', 'position:absolute;left:10px;bottom:10px;z-index:1001;width:min(340px,calc(100% - 20px));max-height:calc(100% - 80px);overflow:auto;background:' + D + ';border:1px solid ' + B + ';border-radius:14px;box-shadow:0 10px 26px rgba(0,0,0,.5);color:#fff;font-family:Montserrat,sans-serif');
      card.innerHTML = '<div style="padding:14px;font:600 13px Montserrat,sans-serif;color:#AEB4BB">Recherche du lieu…</div>'; showOv(card); dropTmp(ll);
      var p = await placeAt(ll, o); if (overlay !== card) return;
      if (pre && pre.name) { p = Object.assign({}, p, { name: pre.name || p.name, addr: pre.addr || p.addr, ll: pre.ll }); }
      var h = '';
      if (p.photos && p.photos.length) h += '<div style="display:flex;gap:4px;overflow-x:auto;scroll-snap-type:x mandatory">' + p.photos.map(function (u) { return '<img src="' + esc(u) + '" style="height:150px;width:auto;flex-shrink:0;scroll-snap-align:start;display:block">'; }).join('') + '</div>';
      h += '<div style="padding:12px 14px;display:flex;flex-direction:column;gap:6px">';
      h += '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><span style="font:800 15px Montserrat,sans-serif;line-height:1.3">' + esc(p.name) + '</span><button data-x="1" type="button" style="background:transparent;border:0;color:#AEB4BB;font:800 18px Montserrat,sans-serif;cursor:pointer;line-height:1">×</button></div>';
      if (p.type) h += '<span style="font:600 12px Montserrat,sans-serif;color:#AEB4BB">' + esc(p.type) + '</span>';
      if (p.rating) h += '<span style="font:700 12.5px Montserrat,sans-serif;color:' + Y + '">★ ' + String(p.rating).replace('.', ',') + (p.n ? ' <span style="color:#AEB4BB">(' + p.n + ' avis)</span>' : '') + '</span>';
      h += '<span style="font:500 13px Montserrat,sans-serif;color:#D5D9DE;line-height:1.45">' + esc(p.addr) + '</span>';
      if (p.tel) h += '<a href="tel:' + esc(p.tel) + '" style="font:700 13px Montserrat,sans-serif;color:' + Y + '">' + esc(p.tel) + '</a>';
      if (p.nokey) h += '<span style="font:500 11.5px Montserrat,sans-serif;color:#8A9199">Photos et fiches Google : ajoutez votre clé Google Maps dans Paramètres.</span>';
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">';
      if (o.onUse) h += '<button data-a="from" type="button" style="' + BTN + ';background:#0E9F4A;border-color:#0E9F4A">Départ (A)</button><button data-a="to" type="button" style="' + BTN + ';background:#E3262F;border-color:#E3262F">Arrivée (B)</button>';
      h += '<button data-sv="1" type="button" style="' + BTN + '">Street View</button><a href="' + esc(p.url || gmLink(p.ll)) + '" target="_blank" rel="noopener" style="' + BTN + ';display:inline-flex;align-items:center;text-decoration:none">Google Maps</a></div></div>';
      card.innerHTML = h;
      card.querySelector('[data-x]').onclick = function () { closeOv(); if (tmp) { tmp.remove(); tmp = null; } };
      card.querySelector('[data-sv]').onclick = function () { sv(p.ll); };
      [].forEach.call(card.querySelectorAll('[data-a]'), function (b) { b.onclick = function () { o.onUse(b.dataset.a, p.ll, p.addr || p.name); closeOv(); if (tmp) { tmp.remove(); tmp = null; } }; });
    };
    var sv = async function (ll) {
      if (!(await gok(o))) { window.open(svLink(ll), '_blank'); return; }
      var box = mk('div', 'position:absolute;inset:0;z-index:1002;background:#000');
      var pano = mk('div', 'position:absolute;inset:0'); box.appendChild(pano);
      var x = mk('button', 'position:absolute;top:10px;right:10px;z-index:2;' + BTN, 'Fermer Street View'); x.type = 'button'; x.onclick = closeOv; box.appendChild(x);
      showOv(box);
      try {
        var svc = new google.maps.StreetViewService();
        var r = await svc.getPanorama({ location: { lat: ll[0], lng: ll[1] }, radius: 120, source: google.maps.StreetViewSource ? google.maps.StreetViewSource.OUTDOOR : undefined });
        new google.maps.StreetViewPanorama(pano, { pano: r.data.location.pano, pov: { heading: 0, pitch: 0 }, addressControl: true, fullscreenControl: false, motionTracking: false });
      } catch (e) { pano.innerHTML = '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#fff;font:700 14px Montserrat,sans-serif;padding:20px;text-align:center">Pas d’image Street View à cet endroit.<a href="' + svLink(ll) + '" target="_blank" rel="noopener" style="color:' + Y + '">Ouvrir dans Google Maps</a></div>'; }
    };
    map.on('click', function (e) {
      if (!svMode) return; map.__gpBusy = true; setTimeout(function () { map.__gpBusy = false; }, 0);
      svMode = false; map.__gpSv = false; svBtn.style.background = P; svBtn.style.color = '#fff'; svBtn.textContent = 'Street View'; root.style.cursor = '';
      sv([e.latlng.lat, e.latlng.lng]);
    });
    map.on('contextmenu', function (e) { info([e.latlng.lat, e.latlng.lng]); });
    if (!o.onUse) map.on('click', function (e) { if (svMode || map.__gpBusy || o.noInfoClick) return; if (e.originalEvent && e.originalEvent.target && e.originalEvent.target.closest && e.originalEvent.target.closest('.leaflet-marker-icon,.leaflet-interactive')) return; info([e.latlng.lat, e.latlng.lng]); });
  }

  function altPanel(map, list, sel, onPick) {
    var root = map.getContainer(), old = root.querySelector('[data-gp-alt]'); if (old) old.remove(); if (!list || list.length < 2) return;
    var box = mk('div', 'position:absolute;right:10px;top:' + ((map.__gpTop || 10) + 50) + 'px;z-index:1000;display:flex;flex-direction:column;gap:5px;max-width:230px');
    box.setAttribute('data-gp-alt', '1'); window.L.DomEvent.disableClickPropagation(box);
    list.forEach(function (r, i) {
      var on = i === sel, b = mk('button', 'text-align:left;display:flex;flex-direction:column;gap:2px;background:' + (on ? Y : D) + ';color:' + (on ? D : '#fff') + ';border:1px solid ' + (on ? Y : B) + ';border-radius:10px;padding:7px 10px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.35);font-family:Montserrat,sans-serif',
        '<span style="font:800 13px Montserrat,sans-serif">' + r.min + ' min · ' + String(r.km).replace('.', ',') + ' km</span>' + (r.via ? '<span style="font:600 11.5px Montserrat,sans-serif;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">par ' + esc(r.via) + '</span>' : ''));
      b.type = 'button'; b.onclick = function (e) { e.stopPropagation(); onPick(i); }; box.appendChild(b);
    });
    root.appendChild(box);
  }

  window.GPlus = { attach: attach, routes: routes, altPanel: altPanel, busy: function (m) { return !!(m && (m.__gpSv || m.__gpBusy)); } };
})();
