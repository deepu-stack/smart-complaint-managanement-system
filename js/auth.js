/* ============================================================
   js/auth.js — Student Authentication & Session Management
   ──────────────────────────────────────────────────────────
   Login strategy:
     1. findStudentByRoom() → checks Firestore, falls back to
        STUDENT_SEED_DATA if DB is empty (fixes first-run issue)
     2. Password compared against stored/seed value
     3. If mustChangePassword → redirect to change-password.html
     4. Otherwise → create session → redirect to student.html
   ============================================================ */

const SESSION_KEY        = 'scs_student_session';
const PENDING_PWD_KEY    = 'scs_pending_pwd';

// ── Main Login Handler ────────────────────────────────────────
async function studentLogin(room, password, errEl, btn) {
  if (!room || !password) {
    showAuthError(errEl, 'Please enter your room number and password.');
    return;
  }

  // UI loading state
  const origLabel  = btn.innerHTML;
  btn.disabled     = true;
  btn.innerHTML    = '<span class="spin"></span> Verifying...';
  hideAuthError(errEl);

  try {
    // ── Step 1: Find student (Firestore + seed fallback) ──
    const student = await findStudentByRoom(room);

    if (!student) {
      showAuthError(errEl,
        '❌ Room number not registered in the system. ' +
        'Contact your warden to add your room, or ask them to click ' +
        '"Seed Students to Database" in the Admin Panel.'
      );
      return;
    }

    // ── Step 2: Check password ────────────────────────────
    if (student.password !== password) {
      showAuthError(errEl,
        '❌ Incorrect password. ' +
        'First-time login? Use the default password shown in the table above. ' +
        'Forgot your password? Contact the warden.'
      );
      return;
    }

    // ── Step 3: First-login check ─────────────────────────
    if (student.mustChangePassword) {
      sessionStorage.setItem(PENDING_PWD_KEY, JSON.stringify({
        id: student.id, name: student.name,
        room: student.room, block: student.block
      }));
      window.location.href = 'change-password.html';
      return;
    }

    // ── Step 4: Authenticated ─────────────────────────────
    createStudentSession(student);
    window.location.href = 'student.html';

  } catch (err) {
    console.error('[Auth] Login error:', err);
    showAuthError(errEl,
      '⚠️ Could not connect to the database. ' +
      'Check your internet connection and try again. (' + err.message + ')'
    );
  } finally {
    btn.disabled  = false;
    btn.innerHTML = origLabel;
  }
}

// ── Session Helpers ───────────────────────────────────────────
function createStudentSession(student) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    id: student.id, name: student.name,
    room: student.room, block: student.block
  }));
}

function getStudentSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}

function getPendingSession() {
  try { return JSON.parse(sessionStorage.getItem(PENDING_PWD_KEY) || 'null'); }
  catch { return null; }
}

function studentLogout() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(PENDING_PWD_KEY);
  window.location.href = 'index.html';
}

// ── Route Guards ──────────────────────────────────────────────
// Call at top of student.js — redirects if not logged in
function requireStudentSession() {
  const s = getStudentSession();
  if (!s) { window.location.href = 'index.html'; return null; }
  return s;
}

// Call at top of change-password.js — redirects if no pending session
function requirePendingSession() {
  const s = getPendingSession();
  if (!s) { window.location.href = 'index.html'; return null; }
  return s;
}

// ── Error Helpers ─────────────────────────────────────────────
function showAuthError(el, msg) {
  el.innerHTML  = msg;
  el.className  = 'alert alert-error show';
}
function hideAuthError(el) {
  el.className = 'alert';
}

// Expose
window.studentLogin          = studentLogin;
window.createStudentSession  = createStudentSession;
window.getStudentSession     = getStudentSession;
window.getPendingSession     = getPendingSession;
window.studentLogout         = studentLogout;
window.requireStudentSession = requireStudentSession;
window.requirePendingSession = requirePendingSession;
