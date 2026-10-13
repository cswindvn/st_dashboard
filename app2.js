/* Tiện ích biểu đồ kiểu "thẻ sáng" cho giao diện thanh bên (dùng cùng common.js) */
const L = { blue: "#1F6FEB", teal: "#0E9AA7", green: "#3FA34D", orange: "#F59E0B", red: "#E5484D", purple: "#7C4DCC", yellow: "#F2C037", gray: "#9AA9C2" };
const SEV_ORDER = ["Critical", "High", "Medium", "Low"];
const SEV_COLOR = { Critical: L.red, High: L.orange, Medium: L.yellow, Low: L.green };
const SEV_VI = { Critical: "Nghiêm trọng", High: "Cao", Medium: "Trung bình", Low: "Thấp" };

const centerLight = { id: "centerLight",
  afterDraw(c){ const o = c.options.plugins.centerLight; if(!o) return; const a = c.chartArea, cx = (a.left + a.right) / 2, cy = (a.top + a.bottom) / 2, x = c.ctx;
    x.save(); x.textAlign = "center"; x.fillStyle = "#0F1E3A"; x.font = '800 30px "Be Vietnam Pro","Segoe UI",sans-serif'; x.fillText(o.value, cx, cy + 6);
    x.fillStyle = "#5B6B86"; x.font = '12px "Be Vietnam Pro","Segoe UI",sans-serif'; x.fillText(o.label, cx, cy + 24); x.restore(); } };
const barValues = { id: "barValues",
  afterDatasetsDraw(c){ c.data.datasets.forEach((d, di) => { if(!d.showValues) return; const m = c.getDatasetMeta(di), x = c.ctx; x.save(); x.fillStyle = "#0F1E3A"; x.font = '700 12px "Be Vietnam Pro","Segoe UI",sans-serif'; x.textAlign = "center";
    m.data.forEach((b, i) => { const v = d.data[i]; if(v == null) return; if(c.options.indexAxis === "y"){ x.textAlign = "left"; x.fillText(v, b.x + 6, b.y + 4); } else x.fillText(v, b.x, b.y - 6); }); x.restore(); }); } };

function mkLight(id, cfg){
  if(charts[id]) charts[id].destroy();
  Chart.defaults.font.family = '"Be Vietnam Pro","Segoe UI",system-ui,sans-serif'; Chart.defaults.color = "#475569";
  cfg.plugins = (cfg.plugins || []).concat([centerLight, barValues]);
  cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: { duration: 300 } }, cfg.options || {});
  charts[id] = new Chart($("#" + id), cfg);
}
const lightScales = (y = {}, x = {}) => ({
  x: Object.assign({ grid: { display: false }, ticks: { color: "#475569", maxRotation: 0 }, border: { color: "#CBD5E1" } }, x),
  y: Object.assign({ beginAtZero: true, grid: { color: "#E8EDF5" }, border: { display: false }, ticks: { color: "#64748B", precision: 0 } }, y)
});

/** Biểu đồ vòng + danh sách chú thích (tên, số lượng, %) — o: {canvas, legend, list:[[name,n]], colors, label, onPick} */
function donutCard(o){
  const total = o.list.reduce((s, x) => s + x[1], 0);
  const legend = $("#" + o.legend);
  if(!total){ if(charts[o.canvas]) charts[o.canvas].destroy(); legend.innerHTML = `<div class="empty">Không có dữ liệu</div>`; return; }
  mkLight(o.canvas, { type: "doughnut", data: { labels: o.list.map(x => x[0]), datasets: [{ data: o.list.map(x => x[1]), backgroundColor: o.list.map((_, i) => o.colors[i % o.colors.length]), borderColor: "#fff", borderWidth: 2 }] },
    options: { cutout: "66%", plugins: { legend: { display: false }, centerLight: { value: fmt(total), label: o.label } },
      onClick: (ev, els) => { if(els.length && o.onPick) o.onPick(o.list[els[0].index][0]); } } });
  legend.innerHTML = o.list.map(([n, c], i) => `<button data-n="${esc(n)}" title="${esc(n)}"><i style="background:${o.colors[i % o.colors.length]}"></i><span><b>${esc(o.nameOf ? o.nameOf(n) : n)}</b><small>${fmt(c)} (${(c / total * 100).toFixed(1)}%)</small></span></button>`).join("");
  if(o.onPick) legend.querySelectorAll("button").forEach(b => b.onclick = () => o.onPick(b.dataset.n));
}

/** Thẻ KPI có icon: {cls:blue|green|…, icon, label, value, sub, txt} */
const kcard = k => `<div class="kc ${k.cls}"><div class="ic" aria-hidden="true">${k.icon}</div><div class="tx"><div class="l">${k.label}</div><div class="v${k.txt ? " txt" : ""}" title="${esc(k.value)}">${k.txt ? esc(k.value) : k.value}</div><div class="d">${k.sub || ""}</div></div></div>`;

/** Ô màu theo số ngày: nhỏ = mới = đỏ */
const dayChip = d => `<span class="hc ${d <= 3 ? "r" : d <= 7 ? "o" : d <= 14 ? "y" : "g"}">${d}</span>`;

const sevOf = type => { const t = String(type || "").toLowerCase(); const f = DATA.issueTypes.find(x => String(x.name).toLowerCase() === t); return f ? f.severity : ""; };
function setPill(txt){ $("#pillTitle").textContent = txt; }
function setUpdated(){ const u = $("#updated"); if(u && DATA.updatedAt) u.innerHTML = `Cập nhật đến<b>${DATA.updatedAt.toLocaleDateString("vi-VN")} ${DATA.updatedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</b>`; }

/* Nút tạm dừng/chạy hoạt hình tuabin ở thanh bên (nhớ lựa chọn trong trình duyệt) */
(function(){
  const w = document.querySelector(".wind"), b = document.querySelector(".wind-toggle"); if(!w || !b) return;
  const set = p => { w.classList.toggle("paused", p); b.textContent = p ? "▶" : "⏸"; b.setAttribute("aria-pressed", String(p)); b.setAttribute("aria-label", p ? "Chạy hoạt hình tuabin" : "Tạm dừng hoạt hình tuabin"); };
  let p = false; try{ p = localStorage.getItem("issueDash.windPaused") === "1"; }catch(e){}
  set(p);
  b.onclick = () => { p = !p; set(p); try{ localStorage.setItem("issueDash.windPaused", p ? "1" : "0"); }catch(e){} };
})();
