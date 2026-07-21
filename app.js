const state = {
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  events: [],
  filtered: [],
};

const $ = (selector) => document.querySelector(selector);
const pad = (value) => String(value).padStart(2, "0");
const ymd = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const statusNames = {confirmed: "官方确认", estimated: "预计日期", changed: "日期变更"};
const typeNames = {earnings: "财报", macro: "宏观", conference: "会议", industry: "行业", rating: "评级", capital_market: "资本市场", other: "其他"};

async function loadEvents() {
  const response = await fetch(`./events.json?v=${Date.now()}`, {cache: "no-store"});
  if (!response.ok) throw new Error("无法读取公开日历数据");
  const payload = await response.json();
  state.events = payload.events;
  $("#updatedAt").textContent = `数据更新：${formatChinaDateTime(payload.generated_at)}`;
  applyFilters();
}

function applyFilters() {
  const q = $("#search").value.trim().toLowerCase();
  const action = $("#actionFilter").value;
  const status = $("#statusFilter").value;
  state.filtered = state.events.filter((event) => {
    const haystack = `${event.title} ${event.company} ${event.ticker} ${event.notes || ""}`.toLowerCase();
    return (!q || haystack.includes(q)) && (!action || event.action === action) && (!status || event.status === status);
  });
  renderStats();
  renderCalendar();
  renderList();
}

function monthEvents() {
  const prefix = `${state.month.getFullYear()}-${pad(state.month.getMonth() + 1)}`;
  return state.filtered.filter((event) => event.strategy_date.startsWith(prefix));
}

function renderStats() {
  const visible = monthEvents();
  const values = [
    ["本月事件", visible.length],
    ["建议停机", visible.filter((event) => event.action === "STOP").length],
    ["官方确认", visible.filter((event) => event.status === "confirmed").length],
    ["最高风险", visible.length ? Math.max(...visible.map((event) => event.risk_score)) : 0],
  ];
  $("#stats").innerHTML = values.map(([label, value]) => `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>`).join("");
}

function renderCalendar() {
  const year = state.month.getFullYear();
  const month = state.month.getMonth();
  $("#monthTitle").textContent = `${year}年 ${month + 1}月`;
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
  const today = ymd(new Date());
  const items = [];
  for (let i = 0; i < 42; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const key = ymd(day);
    const events = state.filtered.filter((event) => event.strategy_date === key);
    const pills = events.slice(0, 3).map((event) => `<button class="event-pill ${event.action.toLowerCase()}" data-id="${event.id}" data-short="${event.action[0]}" title="${escapeHtml(event.title)}"><strong>${event.action}</strong> · ${escapeHtml(event.title)}</button>`).join("");
    const more = events.length > 3 ? `<div class="more-events">另有 ${events.length - 3} 项</div>` : "";
    items.push(`<div class="day ${day.getMonth() !== month ? "outside" : ""} ${key === today ? "today" : ""}"><span class="day-number">${day.getDate()}</span>${pills}${more}</div>`);
  }
  $("#calendarGrid").innerHTML = items.join("");
  document.querySelectorAll(".event-pill").forEach((button) => button.addEventListener("click", () => showDetail(Number(button.dataset.id))));
}

function renderList() {
  const events = monthEvents().sort((a, b) => a.strategy_date.localeCompare(b.strategy_date) || b.risk_score - a.risk_score);
  $("#resultCount").textContent = `${events.length} 个事件`;
  if (!events.length) {
    $("#eventList").innerHTML = `<div class="empty">这个月份没有符合筛选条件的事件。</div>`;
    return;
  }
  $("#eventList").innerHTML = events.map((event) => `<article class="event-row" data-id="${event.id}"><div class="event-date">${event.strategy_date.slice(5)}</div><span class="badge ${event.action.toLowerCase()}">${event.action}</span><div><div class="event-title">${escapeHtml(event.title)}</div><div class="event-meta">${escapeHtml(event.company)} ${escapeHtml(event.ticker)} · ${typeNames[event.event_type] || event.event_type}</div></div><div class="optional status">${statusNames[event.status] || event.status}</div><div class="optional status">${formatChinaDateTime(event.event_time_utc)}</div><div class="risk">${event.risk_score}</div></article>`).join("");
  document.querySelectorAll(".event-row").forEach((row) => row.addEventListener("click", () => showDetail(Number(row.dataset.id))));
}

function formatChinaDateTime(iso) {
  return new Intl.DateTimeFormat("zh-CN", {timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false}).format(new Date(iso));
}

function showDetail(id) {
  const event = state.events.find((item) => item.id === id);
  if (!event) return;
  $("#detailTitle").textContent = event.title;
  const source = event.source_url ? `<a class="button ghost" href="${escapeHtml(event.source_url)}" target="_blank" rel="noopener">查看官方来源</a>` : "";
  $("#detailBody").innerHTML = `<div class="form-grid"><p><strong>策略日期</strong><br>${event.strategy_date}</p><p><strong>北京时间</strong><br>${formatChinaDateTime(event.event_time_utc)}</p><p><strong>公司 / 代码</strong><br>${escapeHtml(event.company)} ${escapeHtml(event.ticker)}</p><p><strong>建议 / 风险</strong><br>${event.action} · ${event.risk_score} · ${event.importance}</p><p class="wide"><strong>状态</strong><br>${statusNames[event.status] || event.status}</p><p class="wide"><strong>备注</strong><br>${escapeHtml(event.notes || "—")}</p><div class="wide">${source}</div></div>`;
  $("#detailDialog").showModal();
}

$("#prevMonth").addEventListener("click", () => { state.month.setMonth(state.month.getMonth() - 1); state.month = new Date(state.month); applyFilters(); });
$("#nextMonth").addEventListener("click", () => { state.month.setMonth(state.month.getMonth() + 1); state.month = new Date(state.month); applyFilters(); });
$("#today").addEventListener("click", () => { state.month = new Date(new Date().getFullYear(), new Date().getMonth(), 1); applyFilters(); });
$("#search").addEventListener("input", applyFilters);
$("#actionFilter").addEventListener("change", applyFilters);
$("#statusFilter").addEventListener("change", applyFilters);
$("#closeDetail").addEventListener("click", () => $("#detailDialog").close());

loadEvents().catch((error) => {
  document.body.innerHTML = `<div class="empty"><h2>无法读取日历</h2><p>${escapeHtml(error.message)}</p></div>`;
});
