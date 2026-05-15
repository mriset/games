import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, off, push, remove, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { firebaseConfig } from '../config/firebase.js';

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getDatabase(firebaseApp);
export { ref, set, get, update, onValue, off, push, remove, serverTimestamp };
