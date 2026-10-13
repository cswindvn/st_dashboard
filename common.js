/* Thư viện dùng chung cho paint.html và qc.html */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = n => n.toLocaleString("vi-VN");
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const startOfDay = d => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const weekStart = d => { const x = startOfDay(d); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const dmy = d => `${pad(d.getDate())}/${pad(d.getMonth()+1)}`;
const safeUrl = u => /^https?:\/\//i.test(u) ? u : "";
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const PALETTE = () => ["--c1","--c2","--c3","--c4","--c5","--c6"].map(cssVar);
const shortType = t => String(t || "").split("/")[0].trim();
const countBy = (arr, f) => { const m = new Map(); arr.forEach(i => { const k = f(i) || "(trống)"; m.set(k, (m.get(k) || 0) + 1); }); return [...m.entries()].sort((a,b) => b[1] - a[1]); };

/* ---------- Dữ liệu demo ---------- */
function demoData(view){
  const types = ["Sơn chảy / Sagging","Sơn hở mặt / Holiday","Hạt / Inclusion","Vệ sinh không sạch","Lỗi bích tạm","Súng đái","Lỗ kim / Pinhole","Lỗi DFT","Sơn nhăn","Lỗi khác / Other"];
  const projects = {VESTAS:["Offshore Fengmiao 33T","Salo-Ylikoski VAS_7 towers","LDST Heyen 1T","Zolochiv PJ (UA)_2T"], SGRE:["HORNSEA 3_30T","BALTYK 2_8T"]};
  const insp = [["4463","N.D.Anh"],["4499","N.V.Toan"],["4291","H.S.Tan"],["4274","N.D.Thach"],["4190","K.H.Hai"],["4011","M.H.Du"],["4464","N.V.Hung"],["1624","V.K.Quoc"],["4753","N.T.Hoan"]];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const out = [], now = new Date();
  for(let i = 0; i < 380; i++){
    const d = new Date(now.getTime() - Math.pow(rnd(), 1.4) * 120 * 864e5);
    const cust = rnd() < .75 ? "VESTAS" : "SGRE", p = pick(insp.slice(0, i % 11 < 9 ? 9 : 6));
    const o = { ts: `${ymd(d)}T${pad(Math.floor(rnd()*24))}:${pad(Math.floor(rnd()*60))}:00`,
      customer: cust, project: pick(projects[cust]), factory: rnd() < .55 ? "Fac 1" : "Fac 2", section: String(437000 + Math.floor(rnd()*11000)),
      process: rnd() < .85 ? "Final" : "Prime", type: pick(types), desc: "Dữ liệu demo — chưa cấu hình API_URL.",
      folder: "https://drive.google.com/drive/my-drive", photos: 1 + Math.floor(rnd()*5), thumb: "" };
    if(view === "qc"){ o.inspectorId = p[0]; o.inspector = p[1]; }
    out.push(o);
  }
  return { issues: out, users: view === "qc" ? insp.map(x => ({ id: x[0], name: x[1] })) : [],
    issueTypes: [{name:"Sơn hở mặt / Holiday",severity:"Critical"},{name:"Lỗi DFT",severity:"Critical"},{name:"Lỗ kim / Pinhole",severity:"Critical"}],
    updatedAt: new Date().toISOString() };
}

/* ---------- Tải dữ liệu / vòng đời trang ---------- */
let DATA = { issues: [], users: [], issueTypes: [], updatedAt: null };

function normalize(raw){
  const sev = {};
  (raw.issueTypes || []).forEach(t => { sev[String(t.name).toLowerCase()] = t.severity; });
  const issues = (raw.issues || []).map(r => {
    const d = new Date(r.ts);
    return { ...r, date: d, day: ymd(d), severity: sev[String(r.type || "").toLowerCase()] || sev[shortType(r.type).toLowerCase()] || "" };
  }).filter(r => !isNaN(r.date)).sort((a,b) => b.date - a.date);
  return { issues, users: raw.users || [], issueTypes: raw.issueTypes || [], updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date() };
}

async function fetchRaw(view){
  if(!CONFIG.API_URL){
    if(!CONFIG.SNAPSHOT) return demoData(view);
    const r = await fetch("data/" + view + ".json?_=" + Date.now());      // ảnh chụp dữ liệu thật (tools/build-snapshot.js)
    if(!r.ok) throw new Error("Không đọc được data/" + view + ".json (HTTP " + r.status + ")");
    return r.json();
  }
  const u = new URL(CONFIG.API_URL);
  u.searchParams.set("view", view);
  const key = view === "qc" ? CONFIG.QC_KEY : CONFIG.API_KEY;
  if(key) u.searchParams.set("key", key);
  u.searchParams.set("_", Date.now());
  const res = await fetch(u.toString());
  if(!res.ok) throw new Error("HTTP " + res.status);
  const j = await res.json();
  if(j.error) throw new Error(j.error);
  return j;
}

function setStatus(kind, txt){ $("#dot").className = "dot " + (kind === "ok" ? "" : kind); $("#statusTxt").textContent = txt; }
function showBanner(html, info){ const b = $("#banner"); b.innerHTML = html; b.className = "banner" + (info ? " info" : ""); b.style.display = "block"; }

/** Khởi động trang. opts: { view, onData() — gọi sau mỗi lần có dữ liệu mới, onRedraw() — gọi khi đổi theme } */
function startApp(opts){
  const cacheKey = "issueDash.cache." + opts.view;
  const pr = safeUrl(opts.view === "qc" ? CONFIG.PHOTO_ROOT_QC : CONFIG.PHOTO_ROOT_PAINT), pb = $("#btnPhotos");
  if(pb && pr){ pb.href = pr; pb.hidden = false; }
  let lastLoad = 0;
  async function load(){
    setStatus("load", "Đang tải…");
    try{
      const raw = await fetchRaw(opts.view);
      DATA = normalize(raw);
      try{ localStorage.setItem(cacheKey, JSON.stringify(raw)); }catch(e){}
      $("#banner").style.display = "none";
      if(!CONFIG.API_URL) showBanner(CONFIG.SNAPSHOT ? "Đang xem ẢNH CHỤP dữ liệu thật (cập nhật " + DATA.updatedAt.toLocaleString("vi-VN") + "). Dữ liệu sẽ không tự cập nhật cho đến khi điền API_URL trong config.js." : "Đang hiển thị DỮ LIỆU DEMO. Điền API_URL trong config.js để dùng dữ liệu thật.", true);
      setStatus("ok", "Cập nhật " + DATA.updatedAt.toLocaleTimeString("vi-VN") + " · " + fmt(DATA.issues.length) + " issue");
    }catch(err){
      if(err.message === "unauthorized" && opts.onAuthFail){
        try{ localStorage.removeItem(cacheKey); }catch(e){}
        DATA = { issues: [], users: [], issueTypes: [], updatedAt: null };
        setStatus("err", "Cần mã truy cập"); lastLoad = Date.now(); opts.onAuthFail(); return;
      }
      let cached = null; try{ cached = JSON.parse(localStorage.getItem(cacheKey)); }catch(e){}
      if(cached){ DATA = normalize(cached); showBanner("Không tải được dữ liệu mới (" + esc(err.message) + "). Đang hiển thị dữ liệu lưu gần nhất.", true); }
      else showBanner("Không tải được dữ liệu: " + esc(err.message));
      setStatus("err", "Lỗi kết nối");
    }
    lastLoad = Date.now();
    opts.onData();
  }
  $("#btnRefresh").onclick = load;
  $("#btnTv").onclick = () => { document.body.classList.toggle("tv"); setTimeout(() => Object.values(charts).forEach(c => c.resize()), 50); };
  $("#btnTheme").onclick = () => { const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = t; try{ localStorage.setItem("issueDash.theme", t); }catch(e){} opts.onData(true); };
  document.addEventListener("visibilitychange", () => { if(!document.hidden && Date.now() - lastLoad > CONFIG.REFRESH_MS) load(); });
  let theme = null; try{ theme = localStorage.getItem("issueDash.theme"); }catch(e){}
  document.documentElement.dataset.theme = theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  setInterval(() => { if(!document.hidden) load(); }, CONFIG.REFRESH_MS);
  load();
}

/* ---------- Biểu đồ ---------- */
const charts = {};
function mkChart(id, cfg){
  if(charts[id]) charts[id].destroy();
  Chart.defaults.color = cssVar("--muted"); Chart.defaults.font.family = '"IBM Plex Sans","Segoe UI",system-ui,sans-serif';
  cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: { duration: 250 } }, cfg.options || {});
  if(cfg.options.scales) Object.values(cfg.options.scales).forEach(s => { s.grid = Object.assign({ color: cssVar("--border") }, s.grid); });
  charts[id] = new Chart($("#" + id), cfg);
}

/* ---------- Bộ lọc dựa trên select + URL hash ---------- */
const RANGES = [["all","Tất cả"],["today","Hôm nay"],["7","7 ngày"],["30","30 ngày"],["90","90 ngày"],["custom","Tuỳ chọn…"]];
function readHash(F){ const p = new URLSearchParams(location.hash.slice(1)); Object.keys(F).forEach(k => { if(p.has(k)) F[k] = p.get(k); }); }
function writeHash(F, defaults){ const p = new URLSearchParams(); Object.keys(F).forEach(k => { if(F[k] && F[k] !== defaults[k]) p.set(k, F[k]); }); history.replaceState(null, "", "#" + p.toString()); }
function rangeBounds(F){
  const today = startOfDay(new Date()); let from = null, to = null;
  if(F.range === "today") from = today;
  else if(["7","30","90"].includes(F.range)) from = addDays(today, -(+F.range - 1));
  else if(F.range === "custom"){ if(F.from) from = new Date(F.from + "T00:00:00"); if(F.to) to = new Date(F.to + "T23:59:59"); }
  return { from, to };
}
/** defs: [[key,label,field]]; opts.range: thêm bộ lọc thời gian; opts.extra: HTML thêm. Trả về hàm rebuild. */
function buildFilters(el, F, defs, defaults, rows, onChange, opts = {}){
  const options = f => [...new Set(rows.map(i => i[f]).filter(Boolean))].sort((a,b) => a.localeCompare(b, "vi"));
  let h = "";
  if(opts.range){
    h += `<label>Khoảng thời gian<select data-k="range">${RANGES.map(([v,t]) => `<option value="${v}"${F.range===v?" selected":""}>${t}</option>`).join("")}</select></label>`;
    if(F.range === "custom") h += `<label>Từ ngày<input type="date" data-k="from" value="${esc(F.from)}"></label><label>Đến ngày<input type="date" data-k="to" value="${esc(F.to)}"></label>`;
  }
  (opts.pre || []).forEach(x => h += x);
  defs.forEach(([k,label,field]) => h += `<label>${label}<select data-k="${k}"><option value="">Tất cả</option>${options(field).map(o => `<option${F[k]===o?" selected":""} value="${esc(o)}">${esc(o)}</option>`).join("")}</select></label>`);
  h += `<label>&nbsp;<button class="btn" data-reset>Đặt lại bộ lọc</button></label>`;
  el.innerHTML = h;
  el.querySelectorAll("[data-k]").forEach(x => x.addEventListener("change", e => {
    F[e.target.dataset.k] = e.target.value;
    if(e.target.dataset.k === "range") buildFilters(el, F, defs, defaults, rows, onChange, opts);
    onChange();
  }));
  el.querySelector("[data-reset]").onclick = () => { Object.assign(F, defaults); buildFilters(el, F, defs, defaults, rows, onChange, opts); onChange(true); };
}

/* ---------- Bảng chi tiết có sắp xếp / phân trang / CSV ---------- */
function makeDetail(o){
  // o: { el, pager, cols:[{k,t,html(i),val(i)}], csv:[[header,fn]], name }
  let sortKey = "date", sortDir = -1, page = 0, list = [], rowsRef = [], pageList = [];
  function render(rows, q){
    rowsRef = rows; q = (q || "").trim().toLowerCase();
    list = q ? rows.filter(i => o.search(i).toLowerCase().includes(q)) : rows.slice();
    const col = o.cols.find(c => c.k === sortKey), val = i => col ? col.val(i) : 0;
    list.sort((a,b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sortDir);
    const pages = Math.max(1, Math.ceil(list.length / CONFIG.PAGE_SIZE)); if(page >= pages) page = pages - 1;
    if(!list.length){ o.el.innerHTML = `<div class="empty">Không có issue nào khớp bộ lọc</div>`; o.pager.innerHTML = ""; return; }
    const arrow = k => k === sortKey ? (sortDir > 0 ? " ▲" : " ▼") : "";
    o.el.innerHTML = `<table><thead><tr><th>Ảnh</th>${o.cols.map(c => `<th data-s="${c.k}">${c.t}${arrow(c.k)}</th>`).join("")}</tr></thead><tbody>` +
      (pageList = list.slice(page * CONFIG.PAGE_SIZE, (page + 1) * CONFIG.PAGE_SIZE)).map((i, idx) =>
        `<tr><td>${thumbHtml(i, idx)}</td>${o.cols.map(c => `<td${c.cls ? ` class="${c.cls}"` : ""}>${c.html(i)}</td>`).join("")}</tr>`).join("") + `</tbody></table>`;
    bindThumbs(o.el, pageList);
    o.el.querySelectorAll("th[data-s]").forEach(th => th.onclick = () => { const k = th.dataset.s; if(sortKey === k) sortDir *= -1; else { sortKey = k; sortDir = k === "date" ? -1 : 1; } render(rowsRef, q); });
    o.pager.innerHTML = `<span>${fmt(list.length)} dòng · trang ${page+1}/${pages}</span><button class="btn" id="pp"${page===0?" disabled":""}>‹</button><button class="btn" id="pn"${page>=pages-1?" disabled":""}>›</button>`;
    $("#pp").onclick = () => { page--; render(rowsRef, q); }; $("#pn").onclick = () => { page++; render(rowsRef, q); };
  }
  function exportCsv(){
    const q = v => '"' + String(v ?? "").replace(/"/g, '""').replace(/^([=+\-@])/, "'$1") + '"';
    const lines = [o.csv.map(c => q(c[0])).join(",")].concat(list.map(i => o.csv.map(c => q(c[1](i))).join(",")));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    a.download = `${o.name}_${ymd(new Date())}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  return { render, exportCsv, resetPage(){ page = 0; } };
}

/* ---------- Thanh xếp hạng nằm ngang (nhãn trực tiếp; nhấn thanh đầu, còn lại xám) ---------- */
/** list: [[name,count]]; o: {total, active (giá trị đang lọc), onPick(name), extra(i)->text, max} */
function rankBars(el, list, o = {}){
  if(!list.length){ el.innerHTML = `<div class="empty">Không có dữ liệu trong bộ lọc này</div>`; return; }
  const max = o.max || Math.max(...list.map(x => x[1])), total = o.total || list.reduce((s,x) => s + x[1], 0) || 1;
  el.innerHTML = `<div class="rb">` + list.map(([n,c], idx) => {
    const lab = o.label ? o.label(n) : n;
    return `<button class="n" data-n="${esc(n)}" title="${esc(n)}">${esc(lab)}</button>
      <div class="t"><i class="${idx === 0 ? "hi" : ""}${o.active === n ? " on" : ""}" style="width:${Math.max(1.5, c / max * 100)}%"></i></div>
      <div class="c">${fmt(c)}<small>${Math.round(c / total * 100)}%${o.extra ? " · " + o.extra(idx, c) : ""}</small></div>`; }).join("") + `</div>`;
  if(o.onPick) el.querySelectorAll(".n").forEach(b => b.onclick = () => o.onPick(b.dataset.n));
}

/* ---------- Tab ---------- */
function initTabs(onShow){
  const btns = [...document.querySelectorAll(".tabs button")];
  const show = id => { btns.forEach(b => b.setAttribute("aria-selected", b.dataset.p === id)); document.querySelectorAll(".pane").forEach(p => p.classList.toggle("on", p.id === id)); try{ sessionStorage.setItem("issueDash.tab." + location.pathname, id); }catch(e){} Object.values(charts).forEach(c => c.resize()); if(onShow) onShow(id); };
  btns.forEach(b => b.onclick = () => show(b.dataset.p));
  let id = btns[0].dataset.p; try{ id = sessionStorage.getItem("issueDash.tab." + location.pathname) || id; }catch(e){}
  if(!btns.some(b => b.dataset.p === id)) id = btns[0].dataset.p;
  show(id);
}


/* ---------- Ảnh issue: ô xem nhanh + trình xem lớn + link thư mục ---------- */
const thumbHtml = (i, idx) => { const th = safeUrl(i.thumb);
  return `<button class="thumbbtn" data-i="${idx}" title="Xem ảnh và chi tiết" aria-label="Xem ảnh issue ${esc(i.section)}">${th ? `<img class="thumb" loading="lazy" referrerpolicy="no-referrer" src="${esc(th)}" alt="">` : `<span class="thumb ph">Không có ảnh</span>`}</button>`; };
const photoLink = i => { const fo = safeUrl(i.folder); return fo ? `<a class="plink" href="${esc(fo)}" target="_blank" rel="noopener" title="Mở thư mục ảnh trên Google Drive">📁 Mở thư mục (${i.photos} ảnh)</a>` : `<span style="color:var(--muted)">${i.photos} ảnh</span>`; };
function bindThumbs(el, list){ el.querySelectorAll(".thumbbtn").forEach(b => b.onclick = () => openIssue(list[+b.dataset.i])); }

function openIssue(i){
  let m = $("#issueModal");
  if(!m){
    m = document.createElement("div"); m.id = "issueModal"; m.className = "modal"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true");
    m.innerHTML = `<div class="mbox"><button class="btn mclose" aria-label="Đóng">Đóng ✕</button><div class="mimg"></div><div class="minfo"></div></div>`;
    document.body.appendChild(m);
    m.addEventListener("click", e => { if(e.target === m || e.target.closest(".mclose")) m.classList.remove("on"); });
    document.addEventListener("keydown", e => { if(e.key === "Escape") m.classList.remove("on"); });
  }
  const th = safeUrl(i.thumb), big = th ? th.replace(/sz=wd+/, "sz=w1600") : "", fo = safeUrl(i.folder);
  const row = (k, v) => v ? `<tr><th>${k}</th><td>${esc(v)}</td></tr>` : "";
  m.querySelector(".mimg").innerHTML = big ? `<img referrerpolicy="no-referrer" src="${esc(big)}" alt="Ảnh issue ${esc(i.section)}">` : `<div class="empty">Issue này chưa có ảnh xem trước.</div>`;
  const img = m.querySelector(".mimg img"); if(img) img.onerror = () => { m.querySelector(".mimg").innerHTML = `<div class="empty">Không tải được ảnh xem trước. Mở thư mục ảnh để xem đầy đủ.</div>`; };
  m.querySelector(".minfo").innerHTML = `<h3>${esc(shortType(i.type))}</h3><table>${row("Thời gian", i.date.toLocaleString("vi-VN"))}${row("Nhà máy", i.factory)}${row("Khách hàng", i.customer)}${row("Dự án", i.project)}${row("Section", i.section)}${row("Công đoạn", i.process)}${row("Inspector", i.inspector)}${row("Mô tả", i.desc)}</table>${fo ? `<p><a class="btn" href="${esc(fo)}" target="_blank" rel="noopener">Mở thư mục ảnh (${i.photos} ảnh) ↗</a></p>` : ""}`;
  m.classList.add("on"); m.querySelector(".mclose").focus();
}

/* ---------- Bảng "Issue mới nhất" gọn, dùng ngay ở tab tổng quan ---------- */
function latestTable(el, rows, o = {}){
  const list = rows.slice(0, o.n || 8);
  if(!list.length){ el.innerHTML = `<div class="empty">Chưa có issue nào trong bộ lọc này.</div>`; return; }
  el.innerHTML = `<table><thead><tr><th>Ảnh</th><th>Thời gian</th><th>Loại lỗi</th><th>Dự án · Section</th><th>Nhà máy</th>${o.inspector ? "<th>Inspector</th>" : ""}<th>Mô tả</th><th>Ảnh gốc</th></tr></thead><tbody>` +
    list.map((i, idx) => `<tr><td>${thumbHtml(i, idx)}</td><td style="white-space:nowrap">${i.date.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td><td><span class="tag${/critical/i.test(i.severity) ? " crit" : ""}">${esc(shortType(i.type))}</span></td><td>${esc(i.project)}<br><small style="color:var(--muted)">${esc(i.section)}</small></td><td>${esc(i.factory)}</td>${o.inspector ? `<td>${esc(i.inspector)}</td>` : ""}<td class="desc">${esc(i.desc)}</td><td>${photoLink(i)}</td></tr>`).join("") + `</tbody></table>`;
  bindThumbs(el, list);
}

/* ---------- So sánh 2 tuần liên tiếp (tăng/giảm theo %) ---------- */
let CMP_DIM = 0;
/** o: { el, titleEl, rows (đã lọc theo bộ lọc khác, chưa lọc ngày), w (Thứ 2 của tuần đang xem), dims:[[nhãn, fn(i)]], who:"tuần" } */
function renderWeekCompare(o){
  const now = new Date(), w = o.w, wPrev = addDays(w, -7), isCur = +w === +weekStart(now);
  const span = isCur ? now - w : 7 * 864e5;                       // tuần hiện tại: so cùng số giờ đã trôi qua
  const cur = o.rows.filter(i => i.date >= w && i.date <= new Date(+w + span));
  const prev = o.rows.filter(i => i.date >= wPrev && i.date < new Date(+wPrev + span));
  const pc = (a, b) => b ? Math.round((a - b) / b * 100) : null;
  const dtxt = (a, b) => { const p = pc(a, b); return p === null ? (a ? "mới phát sinh" : "không đổi") : (p === 0 ? "không đổi" : (p > 0 ? "▲ +" : "▼ ") + p + "%"); };
  const kls = (a, b) => a > b ? "k-red" : a < b ? "k-green" : "k-cyan";                // tăng issue = xấu
  const crit = l => l.filter(i => /critical/i.test(i.severity)).length;
  const tile = (label, a, b) => `<div class="kpi ${kls(a, b)}"><div class="l">${label}</div><div class="v">${fmt(a)}</div><div class="d"><b>${dtxt(a, b)}</b> · tuần trước ${fmt(b)}</div></div>`;
  const wk = x => `${dmy(x)}–${dmy(addDays(x, 6))}`;
  const p = pc(cur.length, prev.length);
  o.titleEl.textContent = !cur.length && !prev.length ? "Hai tuần này chưa có issue nào"
    : p === null ? `Tuần ${wk(w)}: ${fmt(cur.length)} issue, tuần trước chưa có issue`
    : `Tuần ${wk(w)}: ${fmt(cur.length)} issue, ${p === 0 ? "bằng" : p > 0 ? "tăng " + p + "%" : "giảm " + (-p) + "%"} so với tuần trước (${fmt(prev.length)})`;
  const dim = o.dims[Math.min(CMP_DIM, o.dims.length - 1)];
  const m = new Map(); cur.forEach(i => { const k = dim[1](i) || "(trống)"; const e = m.get(k) || [0, 0]; e[0]++; m.set(k, e); });
  prev.forEach(i => { const k = dim[1](i) || "(trống)"; const e = m.get(k) || [0, 0]; e[1]++; m.set(k, e); });
  const list = [...m.entries()].map(([k, [a, b]]) => ({ k, a, b, d: a - b })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d) || y.a - x.a).slice(0, 10);
  const maxD = Math.max(1, ...list.map(x => Math.abs(x.d)));
  const rows = list.map(x => { const pp = pc(x.a, x.b), up = x.d > 0, dn = x.d < 0, w2 = Math.abs(x.d) / maxD * 50;
    const txt = pp === null ? (x.a ? "mới" : "—") : (pp > 0 ? "▲ +" : pp < 0 ? "▼ " : "= ") + pp + "%";
    return `<div class="cmp-n" title="${esc(x.k)}">${esc(o.shorten ? o.shorten(x.k) : x.k)}</div><div class="cmp-v">${x.b} → <b>${x.a}</b></div>
      <div class="cmp-t"><span class="mid"></span>${up ? `<i class="up" style="left:50%;width:${w2}%"></i>` : dn ? `<i class="dn" style="right:50%;width:${w2}%"></i>` : ""}</div>
      <div class="cmp-p ${up ? "up" : dn ? "dn" : ""}">${txt}</div>`; }).join("");
  o.el.innerHTML = `<div class="kpis">${tile("Tổng issue", cur.length, prev.length)}${tile("Issue critical", crit(cur), crit(prev))}</div>
    <div class="cmp-head"><span class="seg2" role="group" aria-label="Chiều so sánh">${o.dims.map((d, idx) => `<button class="btn${idx === CMP_DIM ? " on" : ""}" data-d="${idx}">${d[0]}</button>`).join(" ")}</span>
      <span class="cmp-note">${isCur ? "Tuần này mới đến " + now.toLocaleDateString("vi-VN", { weekday: "long" }) + ", nên tuần trước chỉ tính đến cùng thời điểm. " : ""}Đỏ = tăng issue (xấu), xanh = giảm (tốt). Cột: tuần trước → tuần này.</span></div>
    ${list.length ? `<div class="cmp">${rows}</div>` : `<div class="empty">Không có dữ liệu để so sánh.</div>`}`;
  o.el.querySelectorAll("[data-d]").forEach(b => b.onclick = () => { CMP_DIM = +b.dataset.d; renderWeekCompare(o); });
}
