# Closed list

Based on the open/closed list idea in *Four Thousand Weeks* by Oliver Burkeman.

- **Open list:** unlimited capture. Everything you might do.
- **Closed list:** hard cap of 10. You can only commit a task when a slot is free.
- **Finish** frees a slot. **Let go** drops a task without finishing it.

```
npm install
npm run dev
```

Change `LIMIT` in `src/App.jsx` to resize the closed list. Data is stored in localStorage.

## Excluding your visits from analytics

Open `https://inprogress-planner.vercel.app/?analytics=off` in each browser you use.
This saves a browser-local preference and excludes the activation visit and future
Web Analytics events. Other visitors are unaffected. Clearing site storage or using
another browser/profile requires activating the link again. Historical counts
cannot be changed. Open `?analytics=on` to include this browser again.
