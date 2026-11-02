export const emptyWorkspace = () => ({ open: [], closed: [], completed: [], done: 0 });
const groups = ['open', 'closed', 'completed'];
export function normalizeWorkspace(value) {
  if (!value || !Array.isArray(value.open) || !Array.isArray(value.closed)) return emptyWorkspace();
  const seen = new Set();
  const result = { done: Number.isSafeInteger(value.done) && value.done >= 0 ? value.done : 0 };
  for (const group of groups) result[group] = (Array.isArray(value[group]) ? value[group] : []).filter(task => {
    if (!task || typeof task.id !== 'string' || typeof task.text !== 'string' || seen.has(task.id)) return false;
    seen.add(task.id); return true;
  }).map(task => JSON.parse(JSON.stringify(task)));
  if (result.closed.length > 5) result.open.unshift(...result.closed.splice(5));
  return result;
}
function records(workspace) {
  return new Map(groups.flatMap(group => workspace[group].map(task => [task.id, { group, task }])));
}
export function workspaceChange(before, after, id) {
  const previous = records(normalizeWorkspace(before));
  const next = records(normalizeWorkspace(after));
  const changes = [];
  for (const [taskId, old] of previous) if (!next.has(taskId)) changes.push({ id: taskId, remove: true });
  for (const [taskId, entry] of next) {
    const old = previous.get(taskId);
    if (!old) changes.push({ id: taskId, add: entry });
    else {
      const patch = {}, unset = [];
      for (const key of new Set([...Object.keys(old.task), ...Object.keys(entry.task)])) {
        if (JSON.stringify(old.task[key]) !== JSON.stringify(entry.task[key])) {
          if (entry.task[key] === undefined) unset.push(key); else patch[key] = entry.task[key];
        }
      }
      if (old.group !== entry.group || Object.keys(patch).length || unset.length) changes.push({ id: taskId, group: old.group !== entry.group ? entry.group : null, patch, unset });
    }
  }
  const order = {};
  for (const group of groups) {
    const ids = after[group]?.map(task => task.id) || [];
    if (JSON.stringify(ids) !== JSON.stringify(before[group]?.map(task => task.id) || [])) order[group] = ids;
  }
  return { id, changes, order, doneDelta: (after.done || 0) - (before.done || 0) };
}
export function applyWorkspaceChange(remote, operation) {
  const result = normalizeWorkspace(remote), current = records(result);
  let effectiveDelta = operation.doneDelta;
  for (const change of operation.changes) {
    if (change.group === 'completed' && current.get(change.id)?.group === 'completed' && effectiveDelta > 0) effectiveDelta--;
    if (change.group && change.group !== 'completed' && change.unset?.includes('completedAt') && current.get(change.id)?.group !== 'completed' && effectiveDelta < 0) effectiveDelta++;
  }
  for (const change of operation.changes) {
    if (change.remove) current.delete(change.id);
    else if (change.add) { if (!current.has(change.id)) current.set(change.id, change.add); }
    else if (current.has(change.id)) {
      const entry = current.get(change.id), task = { ...entry.task, ...change.patch };
      for (const field of change.unset || []) delete task[field];
      current.set(change.id, { group: change.group || entry.group, task });
    }
  }
  for (const group of groups) {
    const entries = [...current.values()].filter(entry => entry.group === group).map(entry => entry.task);
    const requested = operation.order[group];
    if (!requested) result[group] = entries;
    else {
      const byId = new Map(entries.map(task => [task.id, task]));
      result[group] = requested.filter(id => byId.has(id)).map(id => byId.get(id));
      result[group].push(...entries.filter(task => !requested.includes(task.id)));
    }
  }
  result.done = Math.max(0, result.done + effectiveDelta);
  if (result.closed.length > 5) result.open.unshift(...result.closed.splice(5));
  return result;
}
export function mergeGuestWorkspace(cloud, guest) {
  const merged = normalizeWorkspace(cloud), source = normalizeWorkspace(guest);
  const existing = new Set(groups.flatMap(group => merged[group].map(task => task.id)));
  const signatures = new Set(groups.flatMap(group => merged[group].map(task => JSON.stringify([task.text, task.dueAt || null]))));
  for (const group of groups) for (const task of source[group]) {
    const signature = JSON.stringify([task.text, task.dueAt || null]);
    if (existing.has(task.id) || signatures.has(signature)) continue;
    merged[group === 'closed' && merged.closed.length >= 5 ? 'open' : group].push(task);
    existing.add(task.id); signatures.add(signature);
  }
  merged.done = Math.max(merged.done, source.done);
  return merged;
}
