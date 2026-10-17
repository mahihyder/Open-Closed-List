import { useEffect, useState } from "react";
import "./App.css";

const LIMIT = 5;
const KEY = "closed-list:v1";
const EMPTY = { open: [], closed: [], done: 0 };

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export default function App() {
  const [state, setState] = useState(load);
  const [text, setText] = useState("");
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("closed-list:theme") || "light";
    } catch {
      return "light";
    }
  });
  const { open, closed } = state;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("closed-list:theme", theme);
    } catch {
      /* storage unavailable: keep the selected theme for this session */
    }
  }, [theme]);
  const full = closed.length >= LIMIT;

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable: keep working in memory */
    }
  }, [state]);

  const capture = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setState((s) => ({ ...s, open: [{ id: uid(), text: t }, ...s.open] }));
    setText("");
  };

  // Only moves if the closed list has room. The cap is enforced here, not just in the UI.
  const commit = (id) =>
    setState((s) => {
      const item = s.open.find((i) => i.id === id);
      if (!item || s.closed.length >= LIMIT) return s;
      return {
        ...s,
        open: s.open.filter((i) => i.id !== id),
        closed: [...s.closed, item],
      };
    });

  const finish = (id) =>
    setState((s) => ({
      ...s,
      closed: s.closed.filter((i) => i.id !== id),
      done: s.done + 1,
    }));

  const letGo = (list, id) =>
    setState((s) => ({ ...s, [list]: s[list].filter((i) => i.id !== id) }));

  return (
    <main className="app">
      <header className="head">
        <div className="head-row">
          <h1>Tudu list</h1>
          <button
            className="btn theme-toggle"
            type="button"
            onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          >
            {theme === "light" ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13Z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
              </svg>
            )}
          </button>
        </div>
        <p className="lede">
          Everything you wish to do goes on the open list. Only five things get to
          be on the closed list, and nothing new gets in until something
          leaves.
        </p>
      </header>

      <section className="meter" aria-label={`${closed.length} of ${LIMIT} slots used`}>
        <div className="slots" aria-hidden="true">
          {Array.from({ length: LIMIT }, (_, i) => (
            <span key={i} className={i < closed.length ? "slot on" : "slot"} />
          ))}
        </div>
        <p className={full ? "status full" : "status"} role="status">
          {full
            ? "Closed list is full. Finish or let go of something to make room."
            : `${LIMIT - closed.length} of ${LIMIT} slots free. `}
        </p>
      </section>

      <div className="cols">
        <section className="col" aria-labelledby="closed-h">
          <h2 id="closed-h">Closed list</h2>
          {closed.length === 0 ? (
            <p className="empty">Nothing committed. Pick from the open list.</p>
          ) : (
            <ul>
              {closed.map((item) => (
                <li key={item.id} className="item closed">
                  <span className="txt">{item.text}</span>
                  <button className="btn primary" onClick={() => finish(item.id)}>
                    Finish
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => letGo("closed", item.id)}
                    aria-label={`Let go of ${item.text}`}
                  >
                    Let go
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="col" aria-labelledby="open-h">
          <h2 id="open-h">Open list</h2>
          <form onSubmit={capture} className="capture">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write any task"
              aria-label="Capture a task"
            />
            <button className="btn primary" type="submit">
              Add
            </button>
          </form>
          {open.length === 0 ? (
            <p className="empty">Empty. Capture what's on your mind.</p>
          ) : (
            <ul>
              {open.map((item) => (
                <li key={item.id} className="item">
                  <span className="txt">{item.text}</span>
                  <button
                    className="btn"
                    disabled={full}
                    title={full ? "Closed list is full" : "Move to closed list"}
                    onClick={() => commit(item.id)}
                  >
                    Commit
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => letGo("open", item.id)}
                    aria-label={`Let go of ${item.text}`}
                  >
                    Let go
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
