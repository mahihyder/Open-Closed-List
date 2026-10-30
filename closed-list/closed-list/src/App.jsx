import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import "./App.css";

const LIMIT = 5;
const KEY = "closed-list:v1";
const EMPTY = { open: [], closed: [], done: 0 };
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? EMPTY; } catch { return EMPTY; } };

export default function App() {
  const [state, setState] = useState(load);
  const [text, setText] = useState("");
  const [undoAction, setUndoAction] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState("");
  const cancelEdit = useRef(false);
  const [newDueAt, setNewDueAt] = useState(null);
  const [deadlineTarget, setDeadlineTarget] = useState(null);
  const [today, setToday] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [dateHover, setDateHover] = useState(null);
  const [dateHoverReady, setDateHoverReady] = useState(false);
  const tooltipRef = useRef(null);
  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    if (!tooltip || !dateHover || !dateHoverReady) return;
    const bounds = tooltip.getBoundingClientRect();
    const left = Math.max(12, Math.min(dateHover.x + 16, window.innerWidth - bounds.width - 12));
    const top = Math.max(12, Math.min(dateHover.y + 16, window.innerHeight - bounds.height - 12));
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }, [dateHover, dateHoverReady]);
  useEffect(() => {
    setDateHoverReady(false);
    if (!dateHover?.key) return;
    const delay = window.setTimeout(() => setDateHoverReady(true), 550);
    return () => window.clearTimeout(delay);
  }, [dateHover?.key]);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("closed-list:theme") || "light"; } catch { return "light"; } });
  const priority = (item) => {
    if (!item.dueAt) return 2;
    const due = new Date(item.dueAt);
    const days = Math.round((new Date(due.getFullYear(), due.getMonth(), due.getDate()) - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
    return days <= 1 ? 0 : days === 2 ? 1 : 2;
  };
  const sortedTasks = (items) => [...items].sort((a, b) => priority(a) - priority(b));
  const open = sortedTasks(state.open);
  const closed = sortedTasks(state.closed);
  const full = closed.length >= LIMIT;
  const openListRef = useRef(null);
  const draggedTask = useRef(null);

  const skipScrollReset = useRef(false);
  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const reorderTask = (list, id, targetId, after) => {
    setState((current) => {
      const rows = sortedTasks(current[list]);
      const from = rows.findIndex((row) => row.id === id);
      if (from < 0 || id === targetId) return current;
      const [task] = rows.splice(from, 1);
      const target = rows.findIndex((row) => row.id === targetId);
      if (target < 0 || priority(task) !== priority(rows[target])) return current;
      rows.splice(target + (after ? 1 : 0), 0, task);
      if (list === "open" && rows[0]?.id !== current.open[0]?.id) skipScrollReset.current = true;
      return { ...current, [list]: rows };
    });
  };
  const endDrag = () => {
    const drag = draggedTask.current;
    draggedTask.current = null;
    drag?.overlay?.remove();
    drag?.node.parentElement?.querySelectorAll("[data-task-id]").forEach((row) => { row.style.translate = ""; });
    if (drag?.node.hasPointerCapture(drag.pointerId)) drag.node.releasePointerCapture(drag.pointerId);
    document.body.classList.remove("task-drag-active");
    setDragId(null);
    setDropTarget(null);
  };
  useEffect(() => () => {
    draggedTask.current?.overlay?.remove();
    document.body.classList.remove("task-drag-active");
  }, []);
  const beginPointerDrag = (event, list, item) => {
    if (event.button !== 0 || event.target.closest("button, input")) return;
    const node = event.currentTarget;
    const rect = node.getBoundingClientRect();
    draggedTask.current = { list, id: item.id, priority: priority(item), node, pointerId: event.pointerId,
      startX: event.clientX, startY: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    node.setPointerCapture(event.pointerId);
  };
  const movePointerDrag = (event) => {
    const drag = draggedTask.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.overlay) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
      const rect = drag.node.getBoundingClientRect();
      const scale = rect.width / drag.node.offsetWidth;
      const overlay = document.createElement("div");
      overlay.className = "col drag-overlay";
      overlay.setAttribute("aria-hidden", "true");
      const clone = drag.node.cloneNode(true);
      clone.removeAttribute("tabindex");
      clone.style.width = `${drag.node.offsetWidth}px`;
      clone.style.height = `${drag.node.offsetHeight}px`;
      clone.style.margin = "0";
      overlay.appendChild(clone);
      overlay.style.transform = `scale(${scale})`;
      document.body.appendChild(overlay);
      drag.overlay = overlay;
      drag.rowBounds = new Map(Array.from(drag.node.parentElement.children).map((row) => [row.dataset.taskId, row.getBoundingClientRect()]));
      drag.startScroll = drag.node.parentElement.scrollTop;
      drag.scale = scale;
      document.body.classList.add("task-drag-active");
      setDragId(drag.id);
      setDateHover(null);
    }
    event.preventDefault();
    drag.overlay.style.left = `${event.clientX - drag.offsetX}px`;
    drag.overlay.style.top = `${event.clientY - drag.offsetY}px`;
    const container = drag.node.parentElement;
    const area = container.getBoundingClientRect();
    if (container.scrollHeight > container.clientHeight) {
      if (event.clientY < area.top + 48) container.scrollTop -= 14;
      if (event.clientY > area.bottom - 48) container.scrollTop += 14;
    }
    const eligible = Array.from(container.children).filter((row) => row.dataset.priority === String(drag.priority));
    let target = null;
    if (event.clientX >= area.left - 40 && event.clientX <= area.right + 40) {
      const row = eligible.find((row) => { const bounds = drag.rowBounds.get(row.dataset.taskId); return event.clientY < bounds.top - (container.scrollTop - drag.startScroll) * drag.scale + bounds.height / 2; });
      if (row) target = { list: drag.list, id: row.dataset.taskId, after: false };
      else if (eligible.length) target = { list: drag.list, id: eligible.at(-1).dataset.taskId, after: true };
    }
    const sourceIndex = eligible.findIndex((row) => row.dataset.taskId === drag.id);
    let insertIndex = target ? eligible.findIndex((row) => row.dataset.taskId === target.id) + (target.after ? 1 : 0) : sourceIndex;
    if (insertIndex > sourceIndex) insertIndex -= 1;
    const distance = drag.node.offsetHeight + parseFloat(getComputedStyle(container).rowGap || 0);
    eligible.forEach((row, index) => {
      let shift = 0;
      if (index !== sourceIndex && index >= insertIndex && index < sourceIndex) shift = distance;
      if (index !== sourceIndex && index > sourceIndex && index <= insertIndex) shift = -distance;
      row.style.translate = shift ? `0 ${shift}px` : "";
    });
    drag.target = target;
    setDropTarget(target);
  };
  const finishPointerDrag = (event) => {
    const drag = draggedTask.current;
    if (drag && event.pointerId === drag.pointerId) {
      if (drag.overlay && drag.target) reorderTask(drag.list, drag.id, drag.target.id, drag.target.after);
      endDrag();
    }
  };
  useLayoutEffect(() => {
    const list = openListRef.current;
    if (!list || open.length <= 10) return;
    const measure = () => {
      const tenth = list.querySelectorAll(":scope > [data-task-id]")[9];
      if (tenth) list.style.maxHeight = `${tenth.offsetTop + tenth.offsetHeight + 2}px`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    Array.from(list.querySelectorAll(":scope > [data-task-id]")).slice(0, 10).forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, [open]);

  useEffect(() => {
    if (skipScrollReset.current) { skipScrollReset.current = false; return; }
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
    x, y,


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
  const finish = (id) => {
    const index = state.closed.findIndex((task) => task.id === id);
    if (index < 0) return;
    setUndoAction({ type: "finish", list: "closed", task: state.closed[index], index, message: "Task finished" });
    setState((s) => ({ ...s, closed: s.closed.filter((task) => task.id !== id), done: s.done + 1 }));
  };
  const letGo = (list, id) => {
    const index = state[list].findIndex((task) => task.id === id);
    if (index < 0) return;
    const task = state[list][index];
    setUndoAction({ type: list === "closed" ? "release" : "remove", list, task, index, message: list === "closed" ? "Returned to Open list" : "Task removed" });
    setState((s) => ({ ...s, [list]: s[list].filter((row) => row.id !== id), ...(list === "closed" ? { open: [task, ...s.open] } : {}) }));
  };
  const undoLastAction = () => {
    if (!undoAction) return;
    const action = undoAction;
    setState((s) => {
      const currentTask = [...s.open, ...s.closed].find((task) => task.id === action.task.id) || action.task;
      const openRows = s.open.filter((task) => task.id !== currentTask.id);
      const closedRows = s.closed.filter((task) => task.id !== currentTask.id);
      const destination = action.list === "closed" && closedRows.length >= LIMIT ? openRows : action.list === "closed" ? closedRows : openRows;
      destination.splice(Math.min(action.index, destination.length), 0, currentTask);
      return { ...s, open: openRows, closed: closedRows, done: action.type === "finish" ? Math.max(0, s.done - 1) : s.done };
    });
    setUndoAction(null);
  };
  const saveEdit = (id) => {
    if (cancelEdit.current) { cancelEdit.current = false; return; }
    const value = editText.trim();
    if (value) setState((s) => ({ ...s, open: s.open.map((task) => task.id === id ? { ...task, text: value } : task), closed: s.closed.map((task) => task.id === id ? { ...task, text: value } : task) }));
    setEditing(null);
  };  const timerControl = (item) => <div className="timer-control" key={item.id}>
    {item.dueAt
      ? <button type="button" className="btn ghost" aria-label={"Clear deadline for " + item.text} onClick={() => setTaskDeadline(item.id, null)}>Clear</button>
      : <button type="button" className="btn" title="Choose a deadline from the calendar" aria-label={"Set deadline for " + item.text} onClick={() => setDeadlineTarget((current) => current?.type === "task" && current.id === item.id ? null : { type: "task", id: item.id, text: item.text })}>Timer</button>}
  </div>;
  const taskItems = (items, type) => items.map((item, index) => <Fragment key={item.id}><li key={item.id}
    data-task-id={item.id}
    data-priority={priority(item)}
    tabIndex={0}
    aria-label={item.text + ". Drag within its color group, or use Alt and arrow keys."}
    onDoubleClick={(event) => { if (!event.target.closest("button, input")) { cancelEdit.current = false; setEditText(item.text); setEditing(item.id); } }}
    onPointerDown={(event) => beginPointerDrag(event, type, item)}
    onPointerMove={movePointerDrag}
    onPointerUp={finishPointerDrag}
    onPointerCancel={endDrag}
    onLostPointerCapture={() => { if (draggedTask.current) endDrag(); }}
    onDragStart={(event) => event.preventDefault()}
    onKeyDown={(event) => {
      if (event.key === "Escape") { endDrag(); return; }
      if (event.target !== event.currentTarget || !event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const index = items.findIndex((row) => row.id === item.id);
      const next = items[index + (event.key === "ArrowUp" ? -1 : 1)];
      if (next) reorderTask(type, item.id, next.id, event.key === "ArrowDown");
    }}
    data-dragging={dragId === item.id || undefined}
    data-drop={dropTarget?.list === type && dropTarget.id === item.id && dragId !== item.id ? (dropTarget.after ? "after" : "before") : undefined}
    className={(type === "closed" ? "item closed" : "item") + (countdown(item) === null ? "" : countdown(item) <= 1 ? " deadline-urgent" : countdown(item) === 2 ? " deadline-soon" : "")}>

    <span className={"txt" + (item.dueAt ? " has-timer" : "")}>{editing === item.id ? <input className="task-edit" autoFocus aria-label="Edit task title" value={editText} onChange={(event) => setEditText(event.target.value)} onBlur={() => saveEdit(item.id)} onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Enter") { event.preventDefault(); saveEdit(item.id); } if (event.key === "Escape") { cancelEdit.current = true; setEditing(null); } }} /> : <span className="task-title" title="Double-click to edit" onDoubleClick={() => { cancelEdit.current = false; setEditText(item.text); setEditing(item.id); }}>{item.text}</span>}{countdown(item) !== null && <small className="countdown">{countdownLabel(item)}</small>}</span>
    {type !== "closed" && timerControl(item)}
    {type === "closed" ? <button className="btn primary" onClick={() => finish(item.id)}>Finish</button> : <button className="btn" disabled={full} title={full ? "Closed list is full" : "Move to closed list"} onClick={() => commit(item.id)}>Commit</button>}
    {type === "closed" && timerControl(item)}
    <button className="btn ghost" onClick={() => letGo(type, item.id)} title={type === "closed" ? "Return to Open list" : "Remove task"} aria-label={"Let go of " + item.text}>Let go</button>
  </li></Fragment>);

  return <><main className="app">
    <div className="left-column">
      <header className="head"><div className="head-row"><h1>InProgress</h1><button className="btn theme-toggle" type="button" onClick={() => setTheme((current) => current === "light" ? "dark" : "light")} aria-label={"Switch to " + (theme === "light" ? "dark" : "light") + " theme"} title={"Switch to " + (theme === "light" ? "dark" : "light") + " theme"}>{theme === "light" ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13Z" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" /></svg>}</button></div><p className="lede">Everything you wish to do goes on the open list. Only five things get to be on the closed list, and nothing new gets in until something leaves.</p></header>
      <section className="meter" aria-label={closed.length + " of " + LIMIT + " slots used"}><div className="slots" aria-hidden="true">{Array.from({ length: LIMIT }, (_, i) => <span key={i} className={i < closed.length ? "slot on" : "slot"} />)}</div><p className={full ? "status full" : "status"} role="status">{full ? "Closed list is full. Finish or let go of something to make room." : LIMIT - closed.length + " of " + LIMIT + " slots free."}</p></section>
      <section className="col closed-column" aria-labelledby="closed-h"><h2 id="closed-h">Closed list</h2>{closed.length === 0 ? <p className="empty">Nothing committed. Pick from the open list.</p> : <ul>{taskItems(closed, "closed")}</ul>}</section>
    </div>
    <div className="right-column">
      <section className="calendar panel" aria-label="Next 30 days calendar"><div className="calendar-head"><div><p>{days[0].date.toLocaleDateString(undefined, { month: "long", year: "numeric" })}{days[0].date.getMonth() !== days[29].date.getMonth() ? " – " + days[29].date.toLocaleDateString(undefined, { month: "long", year: "numeric" }) : ""}</p></div><span className="calendar-count">30 DAYS</span></div>{deadlineTarget && <p className="calendar-prompt" role="status">Choose a deadline for {deadlineTarget.type === "new" ? "this task" : deadlineTarget.text}.</p>}<div className="calendar-grid weekdays" aria-hidden="true">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <span key={d}>{d}</span>)}</div><div className="calendar-grid date-grid">{Array.from({ length: days[0].date.getDay() }, (_, i) => <span className="calendar-spacer" key={"spacer-" + i} />)}{days.map(({ date, key }) => { const due = taskDueOn(key); return <button key={key} type="button" className={"day" + (key === dayKey(today) ? " today" : "") + (selectedDay === key ? " selected" : "") + (due.length ? " has-task" : "") + (deadlineTarget ? " picking" : "")} onMouseEnter={(e) => showDateTasks(date, key, e.clientX, e.clientY)} onMouseMove={(e) => showDateTasks(date, key, e.clientX, e.clientY)} onMouseLeave={() => setDateHover(null)} onFocus={(e) => { const rect = e.currentTarget.getBoundingClientRect(); showDateTasks(date, key, rect.right, rect.top); }} onBlur={() => setDateHover(null)} onKeyDown={(e) => { if (e.key === "Escape") setDateHover(null); }} aria-describedby={dateHoverReady && dateHover?.key === key ? "date-tasks-tooltip" : undefined} onClick={() => deadlineTarget ? chooseDeadline(date, key) : setSelectedDay(selectedDay === key ? null : key)} aria-label={deadlineTarget ? "Set deadline to " + date.toLocaleDateString() : date.toLocaleDateString() + ", " + due.length + " tasks due"} ><span>{date.getDate()}</span>{date.getDate() === 1 && <small className="month-marker">{date.toLocaleDateString(undefined, { month: "short" })}</small>}{due.length > 0 && <span className="date-dots" aria-hidden="true">{Array.from({ length: Math.min(due.length, 3) }, (_, index) => <i key={index} />)}</span>}</button>; })}</div>{selectedDay && <div className="calendar-note"><strong>{(() => { const [year, month, date] = selectedDay.split("-").map(Number); return new Date(year, month, date).toLocaleDateString(undefined, { month: "short", day: "numeric" }); })()}</strong>{taskDueOn(selectedDay).length ? taskDueOn(selectedDay).map((t) => <span key={t.id}>{t.text}</span>) : <span>No timers due</span>}</div>}</section>
      <section className="col open-column" aria-labelledby="open-h"><h2 id="open-h">Open list <span className="task-count">{open.length}</span></h2><form onSubmit={capture} className="capture"><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write any task" aria-label="Capture a task" /><div className="timer-entry"><button type="button" className="btn deadline-picker" aria-expanded={deadlineTarget?.type === "new"} onClick={() => setDeadlineTarget((current) => current?.type === "new" ? null : { type: "new" })}>{formatDeadline(newDueAt)}</button>{newDueAt && <button type="button" className="btn ghost" onClick={() => setNewDueAt(null)} aria-label="Clear new task deadline">Clear</button>}</div><button className="btn primary" type="submit">Add</button></form>{open.length === 0 ? <p className="empty">Empty. Capture what's on your mind.</p> : <ul ref={openListRef} className={open.length > 10 ? "open-tasks scrollable" : "open-tasks"} style={open.length <= 10 ? { maxHeight: "none" } : undefined} tabIndex={open.length > 10 ? 0 : undefined} aria-label="Open tasks" aria-describedby={open.length > 10 ? "open-scroll-hint" : undefined}>{taskItems(open, "open")}</ul>}{open.length > 10 && <p id="open-scroll-hint" className="scroll-hint">Scroll for more · {open.length} tasks</p>}</section>
    </div>
  </main>
    {undoAction && <div className="undo-toast" role="status"><span>{undoAction.message}</span><button className="btn" onClick={undoLastAction}>Undo</button><button className="btn ghost" aria-label="Dismiss notification" onClick={() => setUndoAction(null)}>×</button></div>}
    {dateHover && dateHoverReady && <div ref={tooltipRef} id="date-tasks-tooltip" className="date-tooltip" role="tooltip" style={{ left: 0, top: 0 }}>

      {taskDueOn(dateHover.key).length ? <ul>{taskDueOn(dateHover.key).map((task) => <li key={task.id}>{task.text}</li>)}</ul> : <p>No tasks due</p>}
    </div>}
  </>;
}
