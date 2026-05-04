/* ============================================================
   js/config.js — Firebase Init + App Config
   NOTE: Firebase Storage is NOT used. Images are compressed
   client-side and stored as base64 inside Firestore documents.
   ============================================================ */

// ── Paste YOUR values from Firebase Console ───────────────────
const firebaseConfig = {
    apiKey: "AIzaSyBukJq8bZY-UlKVbT7l61UjQiB4eMJUgZ0",
    authDomain: "hostel-complaints-aa048.firebaseapp.com",
    projectId: "hostel-complaints-aa048",
    storageBucket: "hostel-complaints-aa048.firebasestorage.app",
    messagingSenderId: "909095740043",
    appId: "1:909095740043:web:94ecddd62cc0ebc0ffaa8e"
};

// ── Admin credentials (change before deployment) ──────────────
const ADMIN_CONFIG = {
  username: "warden",
  password: "hostel@123"
};

// ── Pre-registered Students ───────────────────────────────────
// Default password format: FirstName@RoomWithoutHyphen
// e.g. Room A-101 → Rahul@A101
// mustChangePassword:true → student must set new password on first login
//
// TO ADD MORE STUDENTS: add entries here, then
// Admin Panel → Students → "Seed Students to Database"
const STUDENT_SEED_DATA = [
  {
    id: "STU-001", name: "Rahul Sharma",
    room: "A-101", block: "Block A",
    email: "rahul@hostel.in", phone: "9812345601",
    password: "Rahul@A101", mustChangePassword: true
  },
  {
    id: "STU-002", name: "Priya Singh",
    room: "B-205", block: "Block B",
    email: "priya@hostel.in", phone: "9812345602",
    password: "Priya@B205", mustChangePassword: true
  },
  {
    id: "STU-003", name: "Amit Kumar",
    room: "A-203", block: "Block A",
    email: "amit@hostel.in", phone: "9812345603",
    password: "Amit@A203", mustChangePassword: true
  },
  {
    id: "STU-004", name: "Neha Gupta",
    room: "C-108", block: "Block C",
    email: "neha@hostel.in", phone: "9812345604",
    password: "Neha@C108", mustChangePassword: true
  },
  {
    id: "STU-005", name: "Ravi Patel",
    room: "D-302", block: "Block D",
    email: "ravi@hostel.in", phone: "9812345605",
    password: "Ravi@D302", mustChangePassword: true
  }
];

// ── Firebase Init (NO Storage) ────────────────────────────────
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Enable offline persistence (works on spotty WiFi)
db.enablePersistence({ synchronizeTabs: true })
  .catch(err => {
    if (err.code === 'failed-precondition')
      console.warn('[Firestore] Multiple tabs open — offline persistence limited.');
    else if (err.code === 'unimplemented')
      console.warn('[Firestore] Browser does not support offline persistence.');
  });

// Expose globals
window.ADMIN_CONFIG      = ADMIN_CONFIG;
window.STUDENT_SEED_DATA = STUDENT_SEED_DATA;
