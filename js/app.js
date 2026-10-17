/* Skyrim Interactive Map — static app, no backend.
   Base data lives in data/*.json. Local edits are kept in localStorage as overrides
   and can be exported as JSON to be committed to the repository. */
(() => {
  const W = 1300, H = 867;                 // map image size in px
  const LS_OVR = "skyrimmap.overrides.v1";
  const LS_FILTERS = "skyrimmap.filters.v1";
  const LS_LANG = "skyrimmap.lang";
  const GROUP_OF_CAT = { settlement: "locations", dungeon: "locations", landmark: "locations", ore: "ores", ingredient: "ingredients", other: "other" };

  const S = {
    lang: new URLSearchParams(location.search).get("lang") || localStorage.getItem(LS_LANG) || (navigator.language.startsWith("pt") ? "pt" : "en"),
    cats: {}, base: { holds: {}, items: {} }, ovr: loadOvr(),
    filters: null, holdFilter: "", edit: false, showHolds: true, showLabels: true,
    layers: {}, markers: {}, polys: {}
  };
  const T = (k, ...a) => { const v = (I18N[S.lang] || I18N.en)[k]; return typeof v === "function" ? v(...a) : (v ?? k); };
  const L10 = (obj) => obj ? (obj[S.lang] || obj.en || obj.pt || "") : "";
  const $ = (s) => document.querySelector(s);
  const xy = (x, y) => L.latLng(H - y, x);
  const toXY = (ll) => ({ x: +ll.lng.toFixed(1), y: +(H - ll.lat).toFixed(1) });

  function loadOvr() { try { return JSON.parse(localStorage.getItem(LS_OVR)) || { holds: {}, items: {} }; } catch { return { holds: {}, items: {} }; } }
  function saveOvr() { localStorage.setItem(LS_OVR, JSON.stringify(S.ovr)); updateChangeCount(); }
  function ovrCount() { return Object.keys(S.ovr.holds).length + Object.keys(S.ovr.items).length; }

  // ---------- effective data (base + overrides) ----------
  function allHolds() { return merged(S.base.holds, S.ovr.holds); }
  function allItems() { return merged(S.base.items, S.ovr.items); }
  function merged(base, ovr) {
    const out = {};
    for (const id in base) if (!(id in ovr)) out[id] = base[id];
    for (const id in ovr) if (ovr[id]) out[id] = ovr[id];
    return out;
  }
  function holdName(id) { const h = allHolds()[id]; return h ? L10(h.name) : (id || T("none")); }
  function catOf(item) { return S.cats[item.cat] || { icon: "📍", color: "#777", label: { en: item.cat, pt: item.cat }, subs: {} }; }
  function subInfo(item) { const c = catOf(item); return c.subs[item.sub] || { en: item.sub, pt: item.sub, icon: c.icon }; }
  function subLabel(item) { const s = subInfo(item); return s[S.lang] || s.en || item.sub; }
  function colorOf(item) { const s = subInfo(item); return s.color || catOf(item).color; }
  function iconOf(item) { return subInfo(item).icon || catOf(item).icon; }

  // ---------- map ----------
  const map = L.map("map", { crs: L.CRS.Simple, minZoom: -1, maxZoom: 3, zoomSnap: 0.25, zoomDelta: 0.5, attributionControl: false, wheelPxPerZoomLevel: 90 });
  const bounds = [[0, 0], [H, W]];
  L.imageOverlay("assets/skyrim_map.jpg", bounds).addTo(map);
  map.fitBounds(bounds);
  map.setMinZoom(map.getZoom());             // never zoom out past "whole map"
  map.setMaxBounds([[-200, -300], [H + 200, W + 300]]);
  S.layers.holds = L.layerGroup().addTo(map);
  S.layers.holdLabels = L.layerGroup().addTo(map);
  S.layers.points = L.layerGroup().addTo(map);
  map.on("mousemove", (e) => { const p = toXY(e.latlng); $("#coords").textContent = `x ${p.x}  y ${p.y}`; });

  // ---------- render ----------
  function renderHolds() {
    S.layers.holds.clearLayers(); S.layers.holdLabels.clearLayers(); S.polys = {};
    if (!S.showHolds) return;
    for (const h of Object.values(allHolds())) {
      const dim = S.holdFilter && S.holdFilter !== h.id;
      const poly = L.polygon(h.points.map(([x, y]) => xy(x, y)), {
        color: h.color, weight: dim ? 1 : 2, fillColor: h.color, fillOpacity: dim ? 0.04 : 0.16, dashArray: "6 5", pmIgnore: !S.edit
      });
      poly._holdId = h.id;
      poly.bindPopup(() => holdPopup(h));
      poly.on("pm:edit", (e) => {
        const cur = allHolds()[h.id];
        const pts = e.layer.getLatLngs()[0].map((ll) => { const p = toXY(ll); return [p.x, p.y]; });
        S.ovr.holds[h.id] = { ...cur, points: pts }; saveOvr();
      });
      S.layers.holds.addLayer(poly); S.polys[h.id] = poly;
      if (S.showLabels) {
        const c = poly.getBounds().getCenter();
        S.layers.holdLabels.addLayer(L.marker(c, { interactive: false, icon: L.divIcon({ className: "hold-label", html: L10(h.name).toUpperCase(), iconSize: [160, 20], iconAnchor: [80, 10] }) }));
      }
    }
  }

  function isVisible(it) {
    if (S.holdFilter && it.hold !== S.holdFilter) return false;
    return S.filters.has(`${it.cat}:${it.sub}`);
  }

  function renderPoints() {
    S.layers.points.clearLayers(); S.markers = {};
    const z = map.getZoom();
    for (const it of Object.values(allItems())) {
      if (!isVisible(it)) continue;
      const big = !!catOf(it).big && (it.sub === "city" || it.sub === "town");
      const size = big ? 30 : 22;
      const m = L.marker(xy(it.x, it.y), {
        draggable: S.edit, pmIgnore: true, riseOnHover: true,
        icon: L.divIcon({ className: "", html: `<div class="poi${big ? " big" : ""}" style="background:${colorOf(it)};width:${size}px;height:${size}px">${iconOf(it)}</div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2] })
      });
      m._itemId = it.id;
      m.bindPopup(() => itemPopup(it), { maxWidth: 300 });
      const label = L10(it.name);
      if (S.showLabels && it.cat === "settlement" && (big || z >= 0.5)) m.bindTooltip(label, { permanent: true, direction: "bottom", className: "poi-label", offset: [0, size / 2 - 2] });
      else m.bindTooltip(label, { direction: "top", className: "poi-label", offset: [0, -size / 2] });
      m.on("dragend", () => { const p = toXY(m.getLatLng()); S.ovr.items[it.id] = { ...allItems()[it.id], ...p, approx: false }; saveOvr(); });
      S.layers.points.addLayer(m); S.markers[it.id] = m;
    }
  }
  map.on("zoomend", renderPoints);

  function esc(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function itemPopup(it) {
    it = allItems()[it.id] || it;
    const tags = (it.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
    return `<div class="popup"><h3>${iconOf(it)} ${esc(L10(it.name))}</h3>
      <div class="meta">${esc(L10(catOf(it).label))} · ${esc(subLabel(it))} · ${esc(holdName(it.hold))}</div>
      <div>${esc(L10(it.desc))}</div>
      ${tags ? `<div class="tags">${tags}</div>` : ""}
      ${it.approx ? `<div class="approx">${T("approx")}</div>` : ""}
      ${S.edit ? `<button class="edit-btn" onclick="SkyrimMap.editItem('${it.id}')">${T("editBtn")}</button>` : ""}</div>`;
  }
  function holdPopup(h) {
    h = allHolds()[h.id] || h;
    const cap = h.capital && allItems()[h.capital];
    return `<div class="popup"><h3>${esc(L10(h.name))}</h3>
      ${cap ? `<div class="meta">${T("capital")}: <a href="#" onclick="SkyrimMap.goTo('${cap.id}');return false">${esc(L10(cap.name))}</a></div>` : ""}
      <div>${esc(L10(h.desc))}</div>
      ${S.edit ? `<button class="edit-btn" onclick="SkyrimMap.editHold('${h.id}')">${T("editBtn")}</button>` : ""}</div>`;
  }

  // ---------- filters UI ----------
  function allSubs() {
    // union of configured subtypes and subtypes present in data (user-added ones included)
    const out = {};
    for (const [cid, c] of Object.entries(S.cats)) { out[cid] = {}; for (const sid of Object.keys(c.subs)) out[cid][sid] = 0; }
    for (const it of Object.values(allItems())) { out[it.cat] ??= {}; out[it.cat][it.sub] = (out[it.cat][it.sub] || 0) + 1; }
    return out;
  }
  function initFilters() {
    const subs = allSubs();
    const saved = (() => { try { return JSON.parse(localStorage.getItem(LS_FILTERS)); } catch { return null; } })();
    S.filters = new Set();
    for (const cid in subs) for (const sid in subs[cid]) { const k = `${cid}:${sid}`; if (!saved || saved.includes(k)) S.filters.add(k); }
  }
  function saveFilters() { localStorage.setItem(LS_FILTERS, JSON.stringify([...S.filters])); }
  function renderFilters() {
    const subs = allSubs(); const root = $("#filters"); root.innerHTML = "";
    const openCats = new Set([...root.querySelectorAll(".cat.open")].map((e) => e.dataset.cat));
    for (const cid in subs) {
      const c = S.cats[cid] || { icon: "📍", color: "#777", label: { en: cid, pt: cid }, subs: {} };
      const keys = Object.keys(subs[cid]); const on = keys.filter((s) => S.filters.has(`${cid}:${s}`)).length;
      const total = keys.reduce((a, s) => a + subs[cid][s], 0);
      const el = document.createElement("div"); el.className = "cat" + (openCats.has(cid) ? " open" : ""); el.dataset.cat = cid;
      el.innerHTML = `<div class="cat-head"><span class="caret">▶</span><input type="checkbox" ${on === keys.length ? "checked" : ""} ${on && on < keys.length ? "data-ind=1" : ""}>
        <span class="ico">${c.icon}</span><span>${esc(L10(c.label))}</span><span class="count">${total}</span></div><div class="subs"></div>`;
      const cb = el.querySelector("input"); cb.indeterminate = on > 0 && on < keys.length;
      cb.addEventListener("click", (e) => { e.stopPropagation(); for (const s of keys) cb.checked ? S.filters.add(`${cid}:${s}`) : S.filters.delete(`${cid}:${s}`); apply(); });
      el.querySelector(".cat-head").addEventListener("click", () => el.classList.toggle("open"));
      const subsEl = el.querySelector(".subs");
      for (const sid of keys) {
        const si = c.subs[sid] || { en: sid, pt: sid, icon: c.icon };
        const lab = document.createElement("label");
        lab.innerHTML = `<input type="checkbox" ${S.filters.has(`${cid}:${sid}`) ? "checked" : ""}><span class="dot" style="background:${si.color || c.color}"></span><span class="ico">${si.icon || c.icon}</span><span>${esc(si[S.lang] || si.en || sid)}</span><span class="count">${subs[cid][sid]}</span>`;
        lab.querySelector("input").addEventListener("change", (e) => { e.target.checked ? S.filters.add(`${cid}:${sid}`) : S.filters.delete(`${cid}:${sid}`); apply(); });
        subsEl.appendChild(lab);
      }
      root.appendChild(el);
    }
  }
  function apply() { saveFilters(); renderFilters(); renderPoints(); }

  function renderHoldSelects() {
    const holds = Object.values(allHolds());
    for (const sel of [$("#hold-filter"), $("#f-hold")]) {
      const cur = sel.value; sel.innerHTML = `<option value="">${T("none")}</option>`;
      for (const h of holds) sel.innerHTML += `<option value="${h.id}">${esc(L10(h.name))}</option>`;
      sel.value = cur;
    }
  }

  // ---------- search ----------
  $("#search").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase(); const box = $("#search-results");
    if (!q) { box.classList.add("hidden"); return; }
    const hits = [];
    for (const h of Object.values(allHolds())) if (L10(h.name).toLowerCase().includes(q)) hits.push({ kind: "hold", id: h.id, label: L10(h.name), icon: "🗺️", sub: "" });
    for (const it of Object.values(allItems())) {
      const hay = [it.name.en, it.name.pt, subLabel(it), holdName(it.hold), ...(it.tags || [])].join(" ").toLowerCase();
      if (hay.includes(q)) hits.push({ kind: "item", id: it.id, label: L10(it.name), icon: iconOf(it), sub: subLabel(it) });
    }
    box.innerHTML = hits.length ? hits.slice(0, 40).map((h) => `<div data-kind="${h.kind}" data-id="${h.id}"><span class="ico">${h.icon}</span>${esc(h.label)}<small>${esc(h.sub)}</small></div>`).join("") : `<div>${T("noResults")}</div>`;
    box.classList.remove("hidden");
    box.querySelectorAll("div[data-id]").forEach((d) => d.addEventListener("click", () => { d.dataset.kind === "hold" ? goToHold(d.dataset.id) : goTo(d.dataset.id); box.classList.add("hidden"); }));
  });
  function goTo(id) {
    const it = allItems()[id]; if (!it) return;
    if (!isVisible(it)) { S.filters.add(`${it.cat}:${it.sub}`); if (S.holdFilter && S.holdFilter !== it.hold) { S.holdFilter = ""; $("#hold-filter").value = ""; renderHolds(); } apply(); }
    map.flyTo(xy(it.x, it.y), Math.max(map.getZoom(), 1.5), { duration: 0.6 });
    setTimeout(() => S.markers[id]?.openPopup(), 650);
    location.hash = id;
  }
  function goToHold(id) { const p = S.polys[id]; if (p) { map.flyToBounds(p.getBounds(), { duration: 0.6 }); setTimeout(() => p.openPopup(), 650); } }

  // ---------- edit mode ----------
  $("#edit-mode").addEventListener("change", (e) => {
    S.edit = e.target.checked; $("#edit-tools").classList.toggle("hidden", !S.edit);
    if (S.edit) {
      map.pm.addControls({ position: "topright", drawMarker: false, drawCircleMarker: false, drawPolyline: false, drawRectangle: false, drawCircle: false, drawText: false, cutPolygon: false, rotateMode: false, removalMode: false, editMode: true, dragMode: false, drawPolygon: true });
      map.pm.setLang(S.lang === "pt" ? "pt_br" : "en");
    } else { map.pm.removeControls(); map.pm.disableGlobalEditMode(); }
    renderHolds(); renderPoints();
  });
  map.on("click", (e) => { if (!S.edit || map.pm.globalDrawModeEnabled() || map.pm.globalEditModeEnabled()) return; const p = toXY(e.latlng); openForm(null, { kind: "point", ...p }); });
  map.on("pm:create", (e) => {
    if (e.shape !== "Polygon") return;
    const pts = e.layer.getLatLngs()[0].map((ll) => { const p = toXY(ll); return [p.x, p.y]; });
    e.layer.remove();
    openForm(null, { kind: "area", points: pts });
  });

  const F = (id) => document.getElementById(id);
  function fillCatSelect() { const sel = F("f-cat"); sel.innerHTML = Object.entries(S.cats).map(([id, c]) => `<option value="${id}">${c.icon} ${esc(L10(c.label))}</option>`).join(""); }
  function fillSubList() { const cid = F("f-cat").value; const subs = allSubs()[cid] || {}; F("sub-list").innerHTML = Object.keys(subs).map((s) => `<option value="${s}">${esc((S.cats[cid]?.subs[s] || {})[S.lang] || s)}</option>`).join(""); }
  F("f-cat").addEventListener("change", fillSubList);

  function openForm(item, defaults = {}) {
    const kind = item ? (item.points ? "area" : "point") : defaults.kind;
    F("f-kind").value = kind; F("f-id").value = item?.id || "";
    F("form-title").textContent = item ? T("formEdit") : (kind === "area" ? T("newArea") : T("formNew"));
    const isArea = kind === "area";
    F("f-cat").parentElement.parentElement.classList.toggle("hidden", isArea);
    F("f-xy-row").classList.toggle("hidden", isArea);
    F("f-color-row").classList.toggle("hidden", !isArea);
    F("f-hold").parentElement.classList.toggle("hidden", isArea);
    F("f-tags").parentElement.classList.toggle("hidden", isArea);
    F("f-delete").classList.toggle("hidden", !item);
    fillCatSelect(); F("f-cat").value = item?.cat || "settlement"; fillSubList();
    F("f-sub").value = item?.sub || ""; F("f-name-en").value = item?.name?.en || ""; F("f-name-pt").value = item?.name?.pt || "";
    F("f-hold").value = item?.hold || (defaults.x != null ? holdAt(defaults.x, defaults.y) : "");
    F("f-desc-en").value = item?.desc?.en || ""; F("f-desc-pt").value = item?.desc?.pt || "";
    F("f-tags").value = (item?.tags || []).join(", "); F("f-color").value = item?.color || "#c08a3e";
    F("f-x").value = item?.x ?? defaults.x ?? ""; F("f-y").value = item?.y ?? defaults.y ?? "";
    F("poi-form")._points = item?.points || defaults.points || null;
    F("poi-form")._capital = item?.capital || "";
    $("#form-backdrop").classList.remove("hidden"); F("f-name-en").focus();
  }
  function closeForm() { $("#form-backdrop").classList.add("hidden"); }
  F("f-cancel").addEventListener("click", closeForm);
  $("#form-backdrop").addEventListener("click", (e) => { if (e.target.id === "form-backdrop") closeForm(); });
  F("f-delete").addEventListener("click", () => {
    if (!confirm(T("confirmDelete"))) return;
    const id = F("f-id").value, isArea = F("f-kind").value === "area";
    const bucket = isArea ? S.ovr.holds : S.ovr.items, base = isArea ? S.base.holds : S.base.items;
    if (base[id]) bucket[id] = null; else delete bucket[id];
    saveOvr(); closeForm(); refreshAll();
  });
  F("poi-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const isArea = F("f-kind").value === "area";
    const nameEn = F("f-name-en").value.trim(), namePt = F("f-name-pt").value.trim() || nameEn;
    const id = F("f-id").value || slug(nameEn);
    if (isArea) {
      S.ovr.holds[id] = { id, kind: "area", color: F("f-color").value, capital: F("poi-form")._capital, name: { en: nameEn, pt: namePt },
        desc: { en: F("f-desc-en").value.trim(), pt: F("f-desc-pt").value.trim() }, points: F("poi-form")._points || [] };
    } else {
      const sub = F("f-sub").value.trim().toLowerCase().replace(/\s+/g, "_") || "misc";
      S.ovr.items[id] = { id, cat: F("f-cat").value, sub, x: +F("f-x").value, y: +F("f-y").value, hold: F("f-hold").value,
        name: { en: nameEn, pt: namePt }, desc: { en: F("f-desc-en").value.trim(), pt: F("f-desc-pt").value.trim() },
        tags: F("f-tags").value.split(",").map((t) => t.trim()).filter(Boolean) };
      S.filters.add(`${F("f-cat").value}:${sub}`);
    }
    saveOvr(); closeForm(); refreshAll();
  });
  function slug(s) { let b = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "item"; let id = b, n = 2; const all = { ...allItems(), ...allHolds() }; while (all[id]) id = `${b}_${n++}`; return id; }
  function holdAt(x, y) { for (const h of Object.values(allHolds())) if (pointInPoly([x, y], h.points)) return h.id; return ""; }
  function pointInPoly(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c; } return c; }

  // ---------- import / export ----------
  function download(name, obj) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
  function fullDataset() {
    const out = { holds: Object.values(allHolds()), locations: [], ores: [], ingredients: [], other: [] };
    for (const it of Object.values(allItems())) out[GROUP_OF_CAT[it.cat] || "other"].push(it);
    return out;
  }
  $("#btn-export").addEventListener("click", () => download("skyrim-map-data.json", { _type: "skyrim-map-full", ...fullDataset() }));
  $("#btn-export-changes").addEventListener("click", () => download("skyrim-map-changes.json", { _type: "skyrim-map-overrides", ...S.ovr }));
  $("#btn-import").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (d._type === "skyrim-map-overrides") { Object.assign(S.ovr.holds, d.holds || {}); Object.assign(S.ovr.items, d.items || {}); }
      else if (d.holds || d.locations) {
        // full dataset: store as overrides only where it differs from base
        const items = {}; for (const g of ["locations", "ores", "ingredients", "other"]) for (const it of d[g] || []) items[it.id] = it;
        S.ovr = { holds: {}, items: {} };
        for (const [id, h] of Object.entries(Object.fromEntries((d.holds || []).map((h) => [h.id, h])))) if (JSON.stringify(h) !== JSON.stringify(S.base.holds[id])) S.ovr.holds[id] = h;
        for (const id in S.base.holds) if (!(d.holds || []).some((h) => h.id === id)) S.ovr.holds[id] = null;
        for (const [id, it] of Object.entries(items)) if (JSON.stringify(it) !== JSON.stringify(S.base.items[id])) S.ovr.items[id] = it;
        for (const id in S.base.items) if (!items[id]) S.ovr.items[id] = null;
      } else throw new Error("format");
      saveOvr(); refreshAll(); alert(T("imported"));
    } catch { alert(T("importFail")); }
    e.target.value = "";
  });
  $("#btn-reset").addEventListener("click", () => { if (confirm(T("confirmReset"))) { S.ovr = { holds: {}, items: {} }; saveOvr(); refreshAll(); } });
  function updateChangeCount() { $("#change-count").textContent = T("changes", ovrCount()); }

  // ---------- misc UI ----------
  $("#toggle-holds").addEventListener("change", (e) => { S.showHolds = e.target.checked; renderHolds(); });
  $("#toggle-labels").addEventListener("change", (e) => { S.showLabels = e.target.checked; renderHolds(); renderPoints(); });
  $("#hold-filter").addEventListener("change", (e) => { S.holdFilter = e.target.value; renderHolds(); renderPoints(); if (S.holdFilter) goToHold(S.holdFilter); });
  $("#all-on").addEventListener("click", () => { const s = allSubs(); for (const c in s) for (const k in s[c]) S.filters.add(`${c}:${k}`); apply(); });
  $("#all-off").addEventListener("click", () => { S.filters.clear(); apply(); });
  $("#sb-toggle").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  document.querySelectorAll(".lang-btn").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.lang)));
  function setLang(l) {
    S.lang = l; localStorage.setItem(LS_LANG, l); document.documentElement.lang = l === "pt" ? "pt-BR" : "en";
    document.querySelectorAll(".lang-btn").forEach((b) => b.classList.toggle("active", b.dataset.lang === l));
    document.querySelectorAll("[data-i18n]").forEach((el) => el.textContent = T(el.dataset.i18n));
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => el.placeholder = T(el.dataset.i18nPh));
    document.title = T("title");
    if (S.edit) map.pm.setLang(l === "pt" ? "pt_br" : "en");
    refreshAll();
  }
  function refreshAll() { renderHoldSelects(); renderFilters(); renderHolds(); renderPoints(); updateChangeCount(); map.closePopup(); }

  window.SkyrimMap = {
    goTo, goToHold,
    editItem: (id) => { map.closePopup(); openForm(allItems()[id]); },
    editHold: (id) => { map.closePopup(); openForm(allHolds()[id]); }
  };

  // ---------- boot ----------
  (async () => {
    const j = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u); return r.json(); });
    S.cats = await j("data/categories.json");
    const idx = await j("data/index.json");
    $("#gh-link").href = idx.repo || "#";
    for (const f of idx.files) {
      const arr = await j(`data/${f}`);
      for (const it of arr) (it.kind === "area" ? S.base.holds : S.base.items)[it.id] = it;
    }
    initFilters();
    setLang(S.lang);
    if (location.hash.length > 1) setTimeout(() => goTo(decodeURIComponent(location.hash.slice(1))), 300);
  })().catch((err) => { console.error(err); alert("Failed to load data: " + err.message); });
})();
