import { initializeApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence, browserPopupRedirectResolver, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { firebaseConfig } from './firebase-config';
const app = initializeApp({ ...firebaseConfig, authDomain: window.location.hostname === 'inprogress-planner.vercel.app' ? window.location.hostname : firebaseConfig.authDomain });
export const auth = initializeAuth(app, { persistence: browserLocalPersistence, popupRedirectResolver: browserPopupRedirectResolver });
export const db = getFirestore(app);
export { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, doc, onSnapshot, runTransaction, serverTimestamp };

// Read the redirect result once, including under React Strict Mode.
export const redirectResult = getRedirectResult(auth);
