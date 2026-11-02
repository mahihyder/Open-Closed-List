import { useEffect, useRef, useState } from "react";
import "./SidePanel.css";
import AccountControls from "./sync/AccountControls";

const sections = [
  { key: "completed", label: "Completed tasks", path: "m5 12 4 4L19 6" },
  { key: "settings", label: "Appearance", path: "M12 3a9 9 0 1 0 9 9h-9z" },
  { key: "guide", label: "Quick guide", path: "M5 4h14v16H5zM9 8h6M9 12h6M9 16h4" },
  { key: "note", label: "Developer’s note", path: "M4 5h16v12H9l-5 4zM8 9h8M8 13h5" },
];
export default function SidePanel({ state, theme, setTheme, onRestore, cloud }) {
  const trigger = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [active, setActive] = useState(null);
  const completed = state.completed || [];
  const close = () => { setIsOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    document.body.classList.toggle("panel-open", isOpen);
    const onKey = (event) => { if (event.key === "Escape" && isOpen) close(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.classList.remove("panel-open"); };
  }, [isOpen]);
  return <>
    <button ref={trigger} className="panel-trigger" aria-label="Open menu" aria-expanded={isOpen} aria-controls="workspace-sidebar" title="Menu" onClick={() => setIsOpen(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg></button>
    <aside id="workspace-sidebar" className={"side-panel" + (isOpen ? " is-open" : "")} aria-labelledby="panel-title" aria-hidden={!isOpen} inert={isOpen ? undefined : ""}>
      <div className="panel-inner">
        <header className="panel-header"><img src={theme === "light" ? "/logo-light.svg" : "/favicon.svg"} width="28" height="28" alt="" /><h2 id="panel-title">InProgress</h2><button className="panel-close" aria-label="Close menu" onClick={close}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4zM9 4v16m7-11-3 3 3 3" /></svg></button></header>
        <AccountControls cloud={cloud} />
        <div className="panel-nav">
          {sections.map((section) => <div key={section.key}>
            <button className={"panel-nav-row" + (active === section.key ? " is-active" : "")} aria-expanded={active === section.key} aria-controls={"panel-" + section.key} onClick={() => setActive(active === section.key ? null : section.key)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={section.path} /></svg><span>{section.label}</span>{section.key === "completed" && <small>{completed.length}</small>}</button>
            <div className={"panel-section-reveal" + (active === section.key ? " is-expanded" : "")} aria-hidden={active !== section.key} inert={active === section.key ? undefined : ""}><div className="panel-section-clip"><section className="panel-content" id={"panel-" + section.key} aria-label={section.label}>
              {section.key === "completed" && <>{completed.length ? <ul className="completed-history">{completed.map((task) => <li key={task.completionId}><span>{task.text}<small>{new Date(task.completedAt).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</small></span><button title="Return to Open list" aria-label={"Restore " + task.text} onClick={() => onRestore(task.completionId)}>↶</button></li>)}</ul> : <p>Tasks you finish from now on will appear here. You can restore them to Open.</p>}</>}
              {section.key === "settings" && <div className="panel-appearance"><span>Theme</span><button aria-pressed={theme === "light"} onClick={() => setTheme("light")}>Light</button><button aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>Dark</button></div>}
              {section.key === "guide" && <div className="panel-guide"><p><strong>Focus on five.</strong> Capture everything in Open. Commit to up to five tasks in Closed.</p><p><strong>Let go, keep the task.</strong> Let go in Closed returns a task to Open. In Open, it removes the task. Undo can reverse either action.</p><p><strong>Plan ahead.</strong> Use the clock to choose a date. Gold means two days left; red means tomorrow, today, or overdue.</p><p><strong>Make it yours.</strong> Double-click titles to edit. Drag within a color group, or focus a task and use Alt + Up/Down to reorder.</p><p className="panel-storage-note">Guest tasks stay in this browser. Sign in with Google to sync your account tasks across devices.</p></div>}
              {section.key === "note" && <div className="developer-note"><p>InProgress is built around a simple idea: a longer list is not always a better plan.</p><p>There will always be more to do than time to do it. The point is to choose what deserves your attention, instead of treating everything as a commitment.</p><p>Finishing matters. So does deciding that something can wait, or letting it go altogether.</p><span className="note-signature">— A note from the developer</span></div>}
            </section></div></div>
          </div>)}
        </div>
        <div className="panel-bottom"><span className="panel-local-label">A little less. A little clearer.</span></div>
      </div>
    </aside>
  </>;
}