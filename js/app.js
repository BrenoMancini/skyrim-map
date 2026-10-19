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

  // ---------- shared database (Supabase REST, optional) ----------
  const CFG = window.SKYRIM_CONFIG || {};
  const REMOTE = !!(CFG.supabaseUrl && CFG.supabaseKey);
  const rHeaders = () => ({ apikey: CFG.supabaseKey, Authorization: "Bearer " + CFG.supabaseKey, "Content-Type": "application/json" });
  const rUrl = () => CFG.supabaseUrl.replace(/\/$/, "") + "/rest/v1/map_overrides";
  async function remoteLoad() {
    const r = await fetch(rUrl() + "?select=id,kind,data&order=updated_at.asc", { headers: rHeaders() });
    if (!r.ok) throw new Error("load " + r.status);
    const ovr = { holds: {}, items: {} };
    for (const row of await r.json()) (row.kind === "hold" ? ovr.holds : ovr.items)[row.id] = row.data;
    return ovr;
  }
  async function remoteSave(changes) {   // changes: [{kind:"item"|"hold", id}]
    const rows = changes.map(({ kind, id }) => ({ id, kind, data: (kind === "hold" ? S.ovr.holds : S.ovr.items)[id] ?? null }));
    const r = await fetch(rUrl() + "?on_conflict=id", { method: "POST", headers: { ...rHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
    if (!r.ok) throw new Error("save " + r.status);
  }
  let pending = (() => { try { return JSON.parse(localStorage.getItem(LS_OVR + ".pending")) || []; } catch { return []; } })();
  function setSync(msg, bad) { const el = $("#sync-status"); if (el) { el.textContent = msg; el.style.color = bad ? "#f0a08f" : ""; } }
  async function flushPending() {
    if (!REMOTE || !pending.length) return;
    try { await remoteSave(pending); pending = []; localStorage.removeItem(LS_OVR + ".pending"); setSync(T("syncOn")); }
    catch (e) { console.warn(e); setSync(T("syncErr"), true); }
  }

  // persist overrides. `changes` lists what was touched so the shared database gets only those rows.
  function saveOvr(changes) {
    localStorage.setItem(LS_OVR, JSON.stringify(S.ovr)); updateChangeCount();
    if (REMOTE && changes && changes.length && !S.noRemote) {
      pending.push(...changes); localStorage.setItem(LS_OVR + ".pending", JSON.stringify(pending));
      flushPending();
    }
  }
  const allChanges = () => [...Object.keys(S.ovr.holds).map((id) => ({ kind: "hold", id })), ...Object.keys(S.ovr.items).map((id) => ({ kind: "item", id }))];
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
  function nameOf(item) { return L10(item.name) || subLabel(item); }
  function imgOf(item) { return item.img || subInfo(item).img || catOf(item).img || ""; }
  function iconHtml(item, cls) { const im = imgOf(item); return im ? `<img class="${cls || ""}${im.endsWith(".svg") ? " svg" : ""}" src="assets/icons/${im}" alt="">` : iconOf(item); }

  // ---------- map ----------
  const map = L.map("map", { crs: L.CRS.Simple, minZoom: -1, maxZoom: 4, zoomSnap: 0, zoomDelta: 0.5, attributionControl: false, wheelPxPerZoomLevel: 80 });
  const bounds = [[0, 0], [H, W]];
  L.imageOverlay("assets/skyrim_map.jpg", bounds).addTo(map);
  map.fitBounds(bounds, { padding: [0, 0] });
  map.setMinZoom(map.getZoom());             // never zoom out past "whole map"
  window.addEventListener("resize", () => { const z = map.getZoom(); map.setMinZoom(-2); map.fitBounds(bounds); map.setMinZoom(map.getZoom()); if (z > map.getZoom()) map.setZoom(z); });
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
        color: h.color, weight: dim ? 1 : 2, fillColor: h.color, fillOpacity: dim ? 0.04 : 0.16, dashArray: "6 5", pmIgnore: !S.edit, interactive: S.edit
      });
      poly._holdId = h.id;
      poly.bindPopup(() => holdPopup(h));
      poly.on("pm:edit", (e) => {
        const cur = allHolds()[h.id];
        const pts = e.layer.getLatLngs()[0].map((ll) => { const p = toXY(ll); return [p.x, p.y]; });
        S.ovr.holds[h.id] = { ...cur, points: pts }; saveOvr([{ kind: "hold", id: h.id }]);
      });
      S.layers.holds.addLayer(poly); S.polys[h.id] = poly;
      if (S.showLabels) {
        const c = poly.getBounds().getCenter();
        S.layers.holdLabels.addLayer(L.marker(c, { interactive: false, icon: L.divIcon({ className: "hold-label", html: `<span class="lbl" data-text="${esc(L10(h.name).toUpperCase())}">${esc(L10(h.name).toUpperCase())}</span>`, iconSize: [220, 24], iconAnchor: [110, 12] }) }));
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
      const size = big ? 36 : 26;
      const m = L.marker(xy(it.x, it.y), {
        draggable: S.edit, pmIgnore: true, riseOnHover: true,
        icon: L.divIcon({ className: "", html: `<div class="poi${big ? " big" : ""}" style="background:${colorOf(it)};width:${size}px;height:${size}px">${iconHtml(it)}</div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2] })
      });
      m._itemId = it.id;
      m.bindPopup(() => itemPopup(it), { maxWidth: 300 });
      const label = nameOf(it);
      const permanent = S.showLabels && (it.cat === "settlement" ? (big || z >= 0.3) : z >= 1.4);
      m.bindTooltip(`<span class="lbl" data-text="${esc(label)}">${esc(label)}</span>`, { permanent, direction: permanent ? "bottom" : "top", className: "poi-label" + (big ? " big" : ""), offset: permanent ? [0, size / 2 - 4] : [0, -size / 2], opacity: 1 });
      m.on("mouseover", () => m.getTooltip()?.getElement()?.classList.add("hover"));
      m.on("mouseout", () => m.getTooltip()?.getElement()?.classList.remove("hover"));
      m.on("dragend", () => { const p = toXY(m.getLatLng()); S.ovr.items[it.id] = { ...allItems()[it.id], ...p, approx: false }; saveOvr([{ kind: "item", id: it.id }]); });
      S.layers.points.addLayer(m); S.markers[it.id] = m;
    }
  }
  map.on("zoomend", renderPoints);

  function esc(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function itemPopup(it) {
    it = allItems()[it.id] || it;
    const tags = (it.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
    return `<div class="popup"><h3>${esc(nameOf(it))}</h3>
      <div class="meta">${esc(L10(catOf(it).label))} · ${esc(subLabel(it))} · ${esc(holdName(it.hold))}</div>
      <div>${esc(L10(it.desc))}</div>
      ${tags ? `<div class="tags">${tags}</div>` : ""}
      ${it.approx ? `<div class="approx">${T("approx")}</div>` : ""}
      <button class="edit-btn" onclick="SkyrimMap.editItem('${it.id}')">${T("editBtn")}</button></div>`;
  }
  function holdPopup(h) {
    h = allHolds()[h.id] || h;
    const cap = h.capital && allItems()[h.capital];
    return `<div class="popup"><h3>${esc(L10(h.name))}</h3>
      ${cap ? `<div class="meta">${T("capital")}: <a href="#" onclick="SkyrimMap.goTo('${cap.id}');return false">${esc(nameOf(cap))}</a></div>` : ""}
      <div>${esc(L10(h.desc))}</div>
      <button class="edit-btn" onclick="SkyrimMap.editHold('${h.id}')">${T("editBtn")}</button></div>`;
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
        <span class="ico">${iconHtml({ cat: cid, sub: "" })}</span><span>${esc(L10(c.label))}</span><span class="count">${total}</span></div><div class="subs"></div>`;
      const cb = el.querySelector("input"); cb.indeterminate = on > 0 && on < keys.length;
      cb.addEventListener("click", (e) => { e.stopPropagation(); for (const s of keys) cb.checked ? S.filters.add(`${cid}:${s}`) : S.filters.delete(`${cid}:${s}`); apply(); });
      el.querySelector(".cat-head").addEventListener("click", () => el.classList.toggle("open"));
      const subsEl = el.querySelector(".subs");
      for (const sid of keys) {
        const si = c.subs[sid] || { en: sid, pt: sid, icon: c.icon };
        const lab = document.createElement("label");
        lab.innerHTML = `<input type="checkbox" ${S.filters.has(`${cid}:${sid}`) ? "checked" : ""}><span class="dot" style="background:${si.color || c.color}"></span><span class="ico">${iconHtml({ cat: cid, sub: sid })}</span><span>${esc(si[S.lang] || si.en || sid)}</span><span class="count">${subs[cid][sid]}</span>`;
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
      const hay = [it.name?.en, it.name?.pt, subLabel(it), holdName(it.hold), ...(it.tags || [])].join(" ").toLowerCase();
      if (hay.includes(q)) hits.push({ kind: "item", id: it.id, label: nameOf(it), icon: iconHtml(it), sub: subLabel(it) });
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
    if (S.edit && map.pm) {
      map.pm.addControls({ position: "topright", drawMarker: false, drawCircleMarker: false, drawPolyline: false, drawRectangle: false, drawCircle: false, drawText: false, cutPolygon: false, rotateMode: false, removalMode: false, editMode: true, dragMode: false, drawPolygon: true });
      map.pm.setLang(S.lang === "pt" ? "pt_br" : "en");
    } else if (map.pm) { map.pm.removeControls(); map.pm.disableGlobalEditMode(); }
    renderHolds(); renderPoints();
  });
  // click menu (left click on empty map, right click too)
  const ctx = $("#ctx"); let ctxPoint = null, popupWasOpen = false;
  map.on("preclick", () => { popupWasOpen = !!(map._popup && map._popup.isOpen()); });
  function showMenu(e) {
    ctxPoint = toXY(e.latlng);
    const hid = holdAt(ctxPoint.x, ctxPoint.y);
    const hb = ctx.querySelector('[data-act="hold"]');
    hb.classList.toggle("hidden", !hid); hb.dataset.hold = hid; hb.querySelector("span:last-child").textContent = hid ? holdName(hid) : "";
    // menu is position:fixed, so viewport coordinates of the click are used directly
    let x = e.originalEvent.clientX + 2, y = e.originalEvent.clientY + 2;
    ctx.classList.remove("hidden");
    if (x + ctx.offsetWidth > window.innerWidth) x -= ctx.offsetWidth + 4; if (y + ctx.offsetHeight > window.innerHeight) y -= ctx.offsetHeight + 4;
    ctx.style.left = x + "px"; ctx.style.top = y + "px";
  }
  map.on("click", (e) => {
    if (!ctx.classList.contains("hidden")) { hideCtx(); return; }   // click outside the menu closes it
    if (popupWasOpen) return;                                           // click that closed a popup does nothing else
    if (map.pm && (map.pm.globalDrawModeEnabled() || map.pm.globalEditModeEnabled())) return;
    showMenu(e);
  });
  map.on("contextmenu", (e) => { L.DomEvent.preventDefault(e.originalEvent); showMenu(e); });
  const hideCtx = () => ctx.classList.add("hidden");
  map.on("movestart zoomstart", hideCtx); document.addEventListener("keydown", (e) => { if (e.key === "Escape") { hideCtx(); } });
  ctx.querySelectorAll("button").forEach((b) => b.addEventListener("click", (ev) => {
    ev.stopPropagation(); const act = b.dataset.act; hideCtx();
    if (act === "add") openForm(null, { kind: "point", ...ctxPoint });
    else if (act === "hold") { const h = allHolds()[b.dataset.hold]; if (h) L.popup().setLatLng(xy(ctxPoint.x, ctxPoint.y)).setContent(holdPopup(h)).openOn(map); }
    else if (act === "area") { if (!S.edit) { $("#edit-mode").checked = true; $("#edit-mode").dispatchEvent(new Event("change")); } map.pm?.enableDraw("Polygon"); }
    else if (act === "copy") { navigator.clipboard?.writeText(`${ctxPoint.x}, ${ctxPoint.y}`); toast(T("copied")); }
  }));
  function toast(msg) { const t = document.createElement("div"); t.className = "coords"; t.style.bottom = "34px"; t.textContent = msg; $("#map").appendChild(t); setTimeout(() => t.remove(), 1800); }
  map.on("pm:create", (e) => {
    if (e.shape !== "Polygon") return;
    const pts = e.layer.getLatLngs()[0].map((ll) => { const p = toXY(ll); return [p.x, p.y]; });
    e.layer.remove();
    openForm(null, { kind: "area", points: pts });
  });

  const F = (id) => document.getElementById(id);
  function fillCatSelect() { const sel = F("f-cat"); sel.innerHTML = Object.entries(S.cats).map(([id, c]) => `<option value="${id}">${esc(L10(c.label))}</option>`).join(""); }
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
    F("f-sub").value = item?.sub || ""; F("f-name-en").value = L10(item?.name); F("f-name-pt").value = item?.name?.pt || "";
    F("poi-form")._orig = { name: item?.name, desc: item?.desc };
    F("f-hold").value = item?.hold || (defaults.x != null ? holdAt(defaults.x, defaults.y) : "");
    F("f-desc-en").value = L10(item?.desc); F("f-desc-pt").value = item?.desc?.pt || "";
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
    bucket[id] = null;                       // null = deleted (also for ids that only exist in the database)
    saveOvr([{ kind: isArea ? "hold" : "item", id }]); closeForm(); refreshAll();
  });
  F("poi-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const isArea = F("f-kind").value === "area";
    const orig = F("poi-form")._orig || {};
    const both = (val, prev) => (val === L10(prev) && prev) ? prev : { en: val, pt: val };   // untouched → keep both languages
    const nameVal = F("f-name-en").value.trim(), descVal = F("f-desc-en").value.trim();
    const name = both(nameVal, orig.name), desc = both(descVal, orig.desc);
    const nameEn = nameVal;
    const subRaw = F("f-sub").value.trim().toLowerCase().replace(/\s+/g, "_");
    if (!isArea && !nameEn && !subRaw) { alert(T("needName")); F("f-sub").focus(); return; }
    if (isArea && !nameEn) { alert(T("needName")); F("f-name-en").focus(); return; }
    const id = F("f-id").value || slug(nameEn || subRaw);
    if (isArea) {
      S.ovr.holds[id] = { id, kind: "area", color: F("f-color").value, capital: F("poi-form")._capital, name, desc, points: F("poi-form")._points || [] };
    } else {
      const sub = subRaw || "misc";
      const prev = allItems()[id] || {};
      S.ovr.items[id] = { ...(prev.img ? { img: prev.img } : {}), id, cat: F("f-cat").value, sub, x: +F("f-x").value, y: +F("f-y").value, hold: F("f-hold").value,
        name: nameEn ? name : { en: "", pt: "" }, desc,
        tags: F("f-tags").value.split(",").map((t) => t.trim()).filter(Boolean) };
      S.filters.add(`${F("f-cat").value}:${sub}`);
    }
    saveOvr([{ kind: isArea ? "hold" : "item", id }]); closeForm(); refreshAll();
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
      saveOvr(allChanges()); refreshAll(); alert(T("imported"));
    } catch { alert(T("importFail")); }
    e.target.value = "";
  });
  $("#btn-reset").addEventListener("click", async () => {
    if (REMOTE) { try { S.ovr = await remoteLoad(); saveOvr(); refreshAll(); } catch (e) { setSync(T("syncLoadErr"), true); } return; }
    if (confirm(T("confirmReset"))) { S.ovr = { holds: {}, items: {} }; saveOvr(); refreshAll(); }
  });
  function updateChangeCount() { $("#change-count").textContent = REMOTE ? T("changesRemote", ovrCount()) : T("changes", ovrCount()); }

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
    if (REMOTE) setSync(pending.length ? T("syncErr") : T("syncOn"), !!pending.length); else setSync(T("syncOff"));
    if (S.edit && map.pm) map.pm.setLang(l === "pt" ? "pt_br" : "en");
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
    if (REMOTE) {
      try { S.ovr = await remoteLoad(); localStorage.setItem(LS_OVR, JSON.stringify(S.ovr)); setSync(T("syncOn")); }
      catch (e) { console.warn(e); setSync(T("syncLoadErr"), true); }
      flushPending();
    } else setSync(T("syncOff"));
    initFilters();
    setLang(S.lang);
    if (location.hash.length > 1) setTimeout(() => goTo(decodeURIComponent(location.hash.slice(1))), 300);
    if (new URLSearchParams(location.search).get("selftest")) {
      try {
        S.noRemote = true;
        openForm(null, { kind: "point", x: 700, y: 400 });
        F("f-cat").value = "ingredient"; fillSubList(); F("f-sub").value = "nirnroot"; F("f-name-en").value = "Selftest Nirnroot";
        F("poi-form").requestSubmit();
        const it = allItems()["selftest_nirnroot"];
        const mk = S.markers["selftest_nirnroot"];
        map.closePopup(); popupWasOpen = false;
        map.fire("click", { latlng: xy(600, 450), originalEvent: { clientX: 700, clientY: 500 } });
        openForm(null, { kind: "point", x: 900, y: 650 });
        F("f-cat").value = "ingredient"; fillSubList(); F("f-sub").value = "nordic_barnacle"; F("f-name-en").value = "";
        F("poi-form").requestSubmit();
        const nn = Object.values(allItems()).find((i) => i.sub === "nordic_barnacle" && i.x === 900);
        const namelessOk = nn && nameOf(nn) === subLabel(nn) && nameOf(nn).length > 0;
        if (nn) { S.ovr.items[nn.id] = null; saveOvr([{ kind: "item", id: nn.id }]); }
        S.ovr.items["selftest_nirnroot"] = null; saveOvr([{ kind: "item", id: "selftest_nirnroot" }]);
        document.title = "NAMELESS " + (namelessOk ? "OK" : "FAIL") + " ";
        const menuOk = !ctx.classList.contains("hidden") && ctx.querySelector('[data-act="hold"] span:last-child').textContent.length > 0;
        document.title += "SELFTEST " + (it && it.hold === "whiterun" && it.x === 700 && mk ? "OK" : "FAIL " + JSON.stringify(it)) + " MENU " + (menuOk ? "OK" : "FAIL");
      } catch (e) { document.title = "SELFTEST ERR " + e.message; }
    }
  })().catch((err) => { console.error(err); alert("Failed to load data: " + err.message); });
})();
