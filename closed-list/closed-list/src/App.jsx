import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./App.css";

const LIMIT = 5;
const KEY = "closed-list:v1";
const EMPTY = { open: [], closed: [], done: 0 };
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? EMPTY; } catch { return EMPTY; } };

export default function App() {
  const [state, setState] = useState(load);
  const [text, setText] = useState("");
  const [newDueAt, setNewDueAt] = useState(null);
  const [deadlineTarget, setDeadlineTarget] = useState(null);
  const [today, setToday] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [dateHover, setDateHover] = useState(null);
  const [dateHoverReady, setDateHoverReady] = useState(false);
  useEffect(() => {
    setDateHoverReady(false);
    if (!dateHover?.key) return;
    const delay = window.setTimeout(() => setDateHoverReady(true), 550);
    return () => window.clearTimeout(delay);
  }, [dateHover?.key]);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("closed-list:theme") || "light"; } catch { return "light"; } });
  const { open, closed } = state;
  const full = closed.length >= LIMIT;
  const openListRef = useRef(null);

  useLayoutEffect(() => {
    const list = openListRef.current;
    if (!list || open.length <= 10) return;
    const measure = () => {
      const tenth = list.children[9];
      if (tenth) list.style.maxHeight = `${tenth.offsetTop + tenth.offsetHeight + 2}px`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    Array.from(list.children).slice(0, 10).forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, [open]);

  useEffect(() => {
    if (openListRef.current) openListRef.current.scrollTop = 0;
  }, [open[0]?.id]);

  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem("closed-list:theme", theme); } catch { /* storage unavailable */ } }, [theme]);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ } }, [state]);
  useEffect(() => { const timer = window.setInterval(() => setToday(new Date()), 60_000); return () => window.clearInterval(timer); }, []);

  const dayKey = (date) => date.getFullYear() + "-" + date.getMonth() + "-" + date.getDate();
  const days = Array.from({ length: 30 }, (_, index) => { const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + index); return { date, key: dayKey(date) }; });
  const allTasks = [...open, ...closed];
  const taskDueOn = (key) => allTasks.filter((item) => item.dueAt && dayKey(new Date(item.dueAt)) === key);
  const showDateTasks = (date, key, x, y) => setDateHover(taskDueOn(key).length ? {
    key, label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    left: Math.max(12, Math.min(x + 16, window.innerWidth - 312)),
    top: y < window.innerHeight / 2 ? y + 16 : undefined,
    bottom: y >= window.innerHeight / 2 ? window.innerHeight - y + 16 : undefined,
  } : null);
  const setTaskDeadline = (id, dueAt) => setState((s) => ({ ...s, open: s.open.map((i) => i.id === id ? { ...i, dueAt } : i), closed: s.closed.map((i) => i.id === id ? { ...i, dueAt } : i) }));
  const chooseDeadline = (date, key) => {
    const dueAt = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
    if (deadlineTarget?.type === "new") setNewDueAt(dueAt);
    if (deadlineTarget?.type === "task") setTaskDeadline(deadlineTarget.id, dueAt);
    setSelectedDay(key);
    setDeadlineTarget(null);
  };
  const formatDeadline = (value) => value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Pick date";
  const countdown = (item) => {
    if (!item.dueAt) return null;
    const d = new Date(item.dueAt);
    return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86_400_000);
  };
  const countdownLabel = (item) => countdown(item) < 0 ? "Overdue " + Math.abs(countdown(item)) + "d" : countdown(item) === 0 ? "Due today" : countdown(item) + " days left";
  const capture = (e) => {
    e.preventDefault(); const t = text.trim(); if (!t) return;
    setState((s) => ({ ...s, open: [{ id: uid(), text: t, dueAt: newDueAt }, ...s.open] }));
    setText(""); setNewDueAt(null); setDeadlineTarget(null);
  };
  const commit = (id) => setState((s) => { const item = s.open.find((i) => i.id === id); if (!item || s.closed.length >= LIMIT) return s; return { ...s, open: s.open.filter((i) => i.id !== id), closed: [...s.closed, item] }; });
  const finish = (id) => setState((s) => ({ ...s, closed: s.closed.filter((i) => i.id !== id), done: s.done + 1 }));
  const letGo = (list, id) => setState((s) => ({ ...s, [list]: s[list].filter((i) => i.id !== id) }));
  const timerControl = (item) => <div className="timer-control" key={item.id}>
    {item.dueAt
      ? <button type="button" className="btn ghost" aria-label={"Clear deadline for " + item.text} onClick={() => setTaskDeadline(item.id, null)}>Clear</button>
      : <button type="button" className="btn" title="Choose a deadline from the calendar" aria-label={"Set deadline for " + item.text} onClick={() => setDeadlineTarget((current) => current?.type === "task" && current.id === item.id ? null : { type: "task", id: item.id, text: item.text })}>Timer</button>}
  </div>;
  const taskItems = (items, type) => items.map((item) => <li key={item.id} className={(type === "closed" ? "item closed" : "item") + (countdown(item) === null ? "" : countdown(item) <= 1 ? " deadline-urgent" : countdown(item) === 2 ? " deadline-soon" : "")}>
    <span className={"txt" + (item.dueAt ? " has-timer" : "")}>{item.text}{countdown(item) !== null && <small className="countdown">{countdownLabel(item)}</small>}</span>
    {type !== "closed" && timerControl(item)}
    {type === "closed" ? <button className="btn primary" onClick={() => finish(item.id)}>Finish</button> : <button className="btn" disabled={full} title={full ? "Closed list is full" : "Move to closed list"} onClick={() => commit(item.id)}>Commit</button>}
    {type === "closed" && timerControl(item)}
    <button className="btn ghost" onClick={() => letGo(type, item.id)} aria-label={"Let go of " + item.text}>Let go</button>
  </li>);

  return <><main className="app">
    <div className="left-column">
      <header className="head"><div className="head-row"><h1>InProgress</h1><button className="btn theme-toggle" type="button" onClick={() => setTheme((current) => current === "light" ? "dark" : "light")} aria-label={"Switch to " + (theme === "light" ? "dark" : "light") + " theme"} title={"Switch to " + (theme === "light" ? "dark" : "light") + " theme"}>{theme === "light" ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13Z" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l-1.42-1.42m11.3-11.3-1.42-1.42" /></svg>}</button></div><p className="lede">Everything you wish to do goes on the open list. Only five things get to be on the closed list, and nothing new gets in until something leaves.</p></header>
      <section className="meter" aria-label={closed.length + " of " + LIMIT + " slots used"}><div className="slots" aria-hidden="true">{Array.from({ length: LIMIT }, (_, i) => <span key={i} className={i < closed.length ? "slot on" : "slot"} />)}</div><p className={full ? "status full" : "status"} role="status">{full ? "Closed list is full. Finish or let go of something to make room." : LIMIT - closed.length + " of " + LIMIT + " slots free."}</p></section>
      <section className="col closed-column" aria-labelledby="closed-h"><h2 id="closed-h">Closed list</h2>{closed.length === 0 ? <p className="empty">Nothing committed. Pick from the open list.</p> : <ul>{taskItems(closed, "closed")}</ul>}</section>
    </div>
    <div className="right-column">
      <section className="calendar panel" aria-label="Next 30 days calendar"><div className="calendar-head"><div><p>{days[0].date.toLocaleDateString(undefined, { month: "long", year: "numeric" })}{days[0].date.getMonth() !== days[29].date.getMonth() ? " – " + days[29].date.toLocaleDateString(undefined, { month: "long", year: "numeric" }) : ""}</p></div><span className="calendar-count">30 DAYS</span></div>{deadlineTarget && <p className="calendar-prompt" role="status">Choose a deadline for {deadlineTarget.type === "new" ? "this task" : deadlineTarget.text}.</p>}<div className="calendar-grid weekdays" aria-hidden="true">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <span key={d}>{d}</span>)}</div><div className="calendar-grid date-grid">{Array.from({ length: days[0].date.getDay() }, (_, i) => <span className="calendar-spacer" key={"spacer-" + i} />)}{days.map(({ date, key }) => { const due = taskDueOn(key); return <button key={key} type="button" className={"day" + (key === dayKey(today) ? " today" : "") + (selectedDay === key ? " selected" : "") + (due.length ? " has-task" : "") + (deadlineTarget ? " picking" : "")} onMouseEnter={(e) => showDateTasks(date, key, e.clientX, e.clientY)} onMouseMove={(e) => showDateTasks(date, key, e.clientX, e.clientY)} onMouseLeave={() => setDateHover(null)} onFocus={(e) => { const rect = e.currentTarget.getBoundingClientRect(); showDateTasks(date, key, rect.right, rect.top); }} onBlur={() => setDateHover(null)} onKeyDown={(e) => { if (e.key === "Escape") setDateHover(null); }} aria-describedby={dateHoverReady && dateHover?.key === key ? "date-tasks-tooltip" : undefined} onClick={() => deadlineTarget ? chooseDeadline(date, key) : setSelectedDay(selectedDay === key ? null : key)} aria-label={deadlineTarget ? "Set deadline to " + date.toLocaleDateString() : date.toLocaleDateString() + ", " + due.length + " tasks due"} ><span>{date.getDate()}</span>{due.length > 0 && <span className="date-dots" aria-hidden="true">{Array.from({ length: Math.min(due.length, 3) }, (_, index) => <i key={index} />)}</span>}</button>; })}</div>{selectedDay && <div className="calendar-note"><strong>{(() => { const [year, month, date] = selectedDay.split("-").map(Number); return new Date(year, month, date).toLocaleDateString(undefined, { month: "short", day: "numeric" }); })()}</strong>{taskDueOn(selectedDay).length ? taskDueOn(selectedDay).map((t) => <span key={t.id}>{t.text}</span>) : <span>No timers due</span>}</div>}<div className="calendar-legend"><i /> Timed tasks</div></section>
      <section className="col open-column" aria-labelledby="open-h"><h2 id="open-h">Open list <span className="task-count">{open.length}</span></h2><form onSubmit={capture} className="capture"><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write any task" aria-label="Capture a task" /><div className="timer-entry"><button type="button" className="btn deadline-picker" aria-expanded={deadlineTarget?.type === "new"} onClick={() => setDeadlineTarget((current) => current?.type === "new" ? null : { type: "new" })}>{formatDeadline(newDueAt)}</button>{newDueAt && <button type="button" className="btn ghost" onClick={() => setNewDueAt(null)} aria-label="Clear new task deadline">Clear</button>}</div><button className="btn primary" type="submit">Add</button></form>{open.length === 0 ? <p className="empty">Empty. Capture what's on your mind.</p> : <ul ref={openListRef} className={open.length > 10 ? "open-tasks scrollable" : "open-tasks"} style={open.length <= 10 ? { maxHeight: "none" } : undefined} tabIndex={open.length > 10 ? 0 : undefined} aria-label="Open tasks" aria-describedby={open.length > 10 ? "open-scroll-hint" : undefined}>{taskItems(open, "open")}</ul>}{open.length > 10 && <p id="open-scroll-hint" className="scroll-hint">Scroll for more · {open.length} tasks</p>}</section>
    </div>
  </main>
    {dateHover && dateHoverReady && <div id="date-tasks-tooltip" className="date-tooltip" role="tooltip" style={{ left: dateHover.left, top: dateHover.top, bottom: dateHover.bottom }}>
      <strong>{dateHover.label}</strong>
      {taskDueOn(dateHover.key).length ? <ul>{taskDueOn(dateHover.key).map((task) => <li key={task.id}>{task.text}</li>)}</ul> : <p>No tasks due</p>}
    </div>}
  </>;
}
