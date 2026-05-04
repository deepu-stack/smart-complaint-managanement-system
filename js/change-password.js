/* ============================================================
   js/change-password.js — First-Login Password Change
   ============================================================ */

const pendingSession = requirePendingSession();  // guard: redirects if no pending session

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('student-name').textContent  = pendingSession.name;
  document.getElementById('student-room').textContent  = pendingSession.room;
  document.getElementById('student-block').textContent = pendingSession.block;
});

// ── Strength Meter ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('new-password').addEventListener('input', function () {
    const v = this.value;
    const s = getStrength(v);
    document.getElementById('strength-bar').style.width      = (s.score / 4 * 100) + '%';
    document.getElementById('strength-bar').style.background = s.color;
    document.getElementById('strength-text').textContent     = s.label;
    document.getElementById('strength-text').style.color     = s.color;
    updateReq('req-len',     v.length >= 8);
    updateReq('req-upper',   /[A-Z]/.test(v));
    updateReq('req-num',     /[0-9]/.test(v));
    updateReq('req-special', /[^A-Za-z0-9]/.test(v));
  });

  document.getElementById('confirm-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') changePassword();
  });
});

function getStrength(pwd) {
  let score = 0;
  if (pwd.length >= 8)           score++;
  if (/[A-Z]/.test(pwd))        score++;
  if (/[0-9]/.test(pwd))        score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  const levels = [
    { label: 'Too weak',    color: '#ef4444' },
    { label: 'Weak',        color: '#f97316' },
    { label: 'Fair',        color: '#eab308' },
    { label: 'Strong',      color: '#22c55e' },
    { label: 'Very strong', color: '#00d4a8' }
  ];
  return { score, ...levels[score] };
}

function updateReq(id, met) {
  const el = document.getElementById(id);
  el.classList.toggle('met', met);
  el.querySelector('.req-icon').textContent = met ? '●' : '○';
}

function toggleVisibility(inputId, btn) {
  const inp = document.getElementById(inputId);
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁️' : '🙈';
}

// ── Submit ────────────────────────────────────────────────────
async function changePassword() {
  const newPwd  = document.getElementById('new-password').value;
  const confirm = document.getElementById('confirm-password').value;
  const alertEl = document.getElementById('pwd-alert');
  const btn     = document.getElementById('change-btn');

  if (!newPwd || !confirm) {
    showAlert(alertEl, 'Please fill in both fields.', 'error'); return;
  }
  if (newPwd.length < 8) {
    showAlert(alertEl, 'Password must be at least 8 characters.', 'error'); return;
  }
  if (getStrength(newPwd).score < 2) {
    showAlert(alertEl, 'Password is too weak. Add uppercase letters and numbers.', 'error'); return;
  }
  if (newPwd !== confirm) {
    showAlert(alertEl, 'Passwords do not match.', 'error'); return;
  }

  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Saving...';
  alertEl.className = 'alert';

  try {
    await updateStudentPassword(pendingSession.id, newPwd);
    sessionStorage.removeItem('scs_pending_pwd');
    createStudentSession(pendingSession);
    showAlert(alertEl, '✅ Password set! Redirecting...', 'success');
    setTimeout(() => { window.location.href = 'student.html'; }, 1100);
  } catch (err) {
    showAlert(alertEl, 'Error: ' + err.message, 'error');
    btn.disabled = false; btn.innerHTML = 'Set New Password →';
  }
}

function showAlert(el, msg, type) { el.textContent = msg; el.className = `alert alert-${type} show`; }
