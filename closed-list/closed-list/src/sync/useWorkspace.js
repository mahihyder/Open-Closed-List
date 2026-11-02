import { useCallback, useEffect, useRef, useState } from 'react';
import { auth, db, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, redirectResult, signOut, doc, onSnapshot, runTransaction, serverTimestamp } from './firebase';
import { normalizeWorkspace, emptyWorkspace, workspaceChange, applyWorkspaceChange, mergeGuestWorkspace } from './workspace';
const GUEST_KEY = 'closed-list:v1';
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
const operationId = () => crypto.randomUUID();
export function useWorkspace() {
  const [workspace, renderWorkspace] = useState(() => normalizeWorkspace(read(GUEST_KEY, emptyWorkspace())));
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [guestAvailable, setGuestAvailable] = useState(false);
  const current = useRef(workspace), session = useRef(null), flushRef = useRef(() => {});
  const persist = (s) => {
    if (!s.uid) return save(GUEST_KEY, current.current);
    return save(`inprogress:account:${s.uid}`, { workspace: current.current, pending: s.pending });
  };
  const show = (value) => { current.current = normalizeWorkspace(value); renderWorkspace(current.current); };
  const derive = (s) => {
    let data = normalizeWorkspace(s.base.workspace);
    for (const operation of s.pending) if (!(s.base.applied || []).includes(operation.id)) data = applyWorkspaceChange(data, operation);
    show(data); persist(s);
  };
  const setWorkspace = useCallback((updater) => {
    const s = session.current;
    if (!s || (s.uid && !s.ready)) return;
    const before = current.current;
    const next = normalizeWorkspace(typeof updater === 'function' ? updater(before) : updater);
    if (JSON.stringify(next) === JSON.stringify(before)) return;
    if (s.uid) s.pending.push(workspaceChange(before, next, operationId()));
    show(next);
    if (!persist(s)) setError('Browser storage is full. Keep this page open until your changes sync.');
    if (s.uid) { setStatus('saving'); flushRef.current(); }
  }, []);
  useEffect(() => {
    let stopSnapshot = () => {}, disposed = false;
    const connectionTimeout = window.setTimeout(() => { if (!disposed && !session.current) setError('Sign-in is taking longer than expected. Reload this page to reconnect. Your browser tasks are safe.'); }, 20000);
    redirectResult.catch(() => { if (!disposed) setError('Google sign-in could not finish. Please try again.'); });
    const stopAuth = onAuthStateChanged(auth, (nextUser) => {
      stopSnapshot();
      const s = { uid: nextUser?.uid || null, ready: !nextUser, pending: [], base: { workspace: emptyWorkspace(), revision: 0, applied: [] }, saving: false };
      window.clearTimeout(connectionTimeout); session.current = s; setUser(nextUser); setError('');
      if (!nextUser) {
        show(normalizeWorkspace(read(GUEST_KEY, emptyWorkspace()))); setStatus('guest'); setGuestAvailable(false); return;
      }
      const cache = read(`inprogress:account:${nextUser.uid}`, null);
      s.pending = Array.isArray(cache?.pending) ? cache.pending : [];
      show(cache?.workspace || emptyWorkspace()); setStatus('connecting');
      const guest = normalizeWorkspace(read(GUEST_KEY, emptyWorkspace()));
      const hasGuest = guest.open.length + guest.closed.length + guest.completed.length > 0;
      setGuestAvailable(hasGuest && !read(`inprogress:imported:${nextUser.uid}`, false));
      s.document = doc(db, 'workspaces', nextUser.uid);
      stopSnapshot = onSnapshot(s.document, { includeMetadataChanges: true }, (snapshot) => {
        if (session.current !== s || disposed || snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
        const data = snapshot.exists() ? snapshot.data() : { workspace: emptyWorkspace(), revision: 0, applied: [] };
        if ((data.revision || 0) < (s.base.revision || 0)) return;
        s.base = data; s.ready = true;
        s.pending = s.pending.filter(operation => !(data.applied || []).includes(operation.id));
        derive(s); setStatus(s.pending.length ? 'saving' : 'synced'); setError('');
        if (s.pending.length) flushRef.current();
      }, () => { if (session.current === s) { setStatus('error'); setError('Cloud storage is unavailable. Your browser copy is safe. Try again when connected.'); } });
    }, () => { session.current = { uid: null, ready: true, pending: [] }; setUser(null); setStatus('guest'); setError('Google sign-in is unavailable. You can keep using guest mode and reload to retry.'); });
    flushRef.current = async () => {
      const s = session.current;
      if (!s?.uid || !s.ready || s.saving || !s.pending.length) return;
      s.saving = true;
      try {
        while (session.current === s && s.pending.length) {
          const operation = s.pending[0];
          const result = await runTransaction(db, async (transaction) => {
            const snapshot = await transaction.get(s.document);
            const stored = snapshot.exists() ? snapshot.data() : { workspace: emptyWorkspace(), revision: 0, applied: [] };
            if ((stored.applied || []).includes(operation.id)) return stored;
            const value = { workspace: applyWorkspaceChange(stored.workspace, operation), revision: (stored.revision || 0) + 1, applied: [...(stored.applied || []), operation.id].slice(-256), updatedAt: serverTimestamp() };
            transaction.set(s.document, value); return value;
          });
          if (session.current !== s) break;
          s.pending = s.pending.filter(item => item.id !== operation.id);
          if (result.revision >= (s.base.revision || 0)) s.base = result;
          derive(s);
        }
        if (session.current === s) { setStatus(s.pending.length ? 'saving' : 'synced'); setError(''); }
      } catch { if (session.current === s) { setStatus('error'); setError('Changes are saved on this device and waiting to sync. Check your connection and retry.'); persist(s); } }
      finally { s.saving = false; }
    };
    const retry = () => flushRef.current();
    const offline = () => { if (session.current?.uid) setStatus('offline'); };
    window.addEventListener('online', retry); window.addEventListener('offline', offline);
    const timer = window.setInterval(retry, 15000);
    return () => { disposed = true; window.clearTimeout(connectionTimeout); stopAuth(); stopSnapshot(); session.current = null; window.clearInterval(timer); window.removeEventListener('online', retry); window.removeEventListener('offline', offline); };
  }, []);
  const login = async (sameTab = window.location.hostname === 'inprogress-planner.vercel.app') => {
    if (busy) return;
    setBusy(true); setError('');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      if (sameTab === true) { await signInWithRedirect(auth, provider); return; }
      await signInWithPopup(auth, provider);
      setPopupBlocked(false);
    } catch (e) {
      if (e.code === 'auth/popup-blocked') {
        setPopupBlocked(true);
        setError('The sign-in popup was blocked. Continue in this tab instead.');
      } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        setError('Google sign-in could not finish. Please try again.');
      }
    } finally { setBusy(false); }
  };
  const logout = async () => {
    if (session.current?.pending.length || session.current?.saving) { setError('Wait for your changes to sync before signing out.'); return; }
    setBusy(true);
    try { await signOut(auth); } catch { setError('Sign-out failed. Please try again.'); } finally { setBusy(false); }
  };
  const importGuest = () => {
    const s = session.current;
    if (!s?.uid || !s.ready) return;
    setWorkspace(value => mergeGuestWorkspace(value, normalizeWorkspace(read(GUEST_KEY, emptyWorkspace()))));
    save(`inprogress:imported:${s.uid}`, true); setGuestAvailable(false);
  };
  return { workspace, setWorkspace, user, status, error, busy, popupBlocked, login, logout, importGuest, guestAvailable, retry: () => { if (!session.current?.ready) window.location.reload(); else flushRef.current(); }, ready: status !== 'connecting' && (!user || !!session.current?.ready) };
}
