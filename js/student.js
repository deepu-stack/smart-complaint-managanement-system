/* ============================================================
   js/student.js — Student Portal UI Logic
   ============================================================ */

// ── Session Guard ─────────────────────────────────────────────
const session = requireStudentSession();   // redirects to index.html if not logged in

// ── State ─────────────────────────────────────────────────────
let selectedPriority = 'Low';
let unsubscribe      = null;
let userPhotoFile    = null;

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('user-name-display').textContent = session.name;
  document.getElementById('user-room-display').textContent = `${session.room} · ${session.block}`;
  startComplaintsListener();
});

// ── Tab Switching ─────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById('tab-submit').classList.toggle('active',      tab === 'submit');
  document.getElementById('tab-complaints').classList.toggle('active',  tab === 'complaints');
  document.getElementById('pane-submit').style.display     = tab === 'submit'      ? '' : 'none';
  document.getElementById('pane-complaints').style.display = tab === 'complaints'  ? '' : 'none';
}

// ── Priority Buttons ──────────────────────────────────────────
function setPriority(val) {
  selectedPriority = val;
  document.querySelectorAll('.prio-btn').forEach(b => {
    b.className = 'prio-btn';
    if (b.dataset.priority === val) b.classList.add(`sel-${val.toLowerCase()}`);
  });
}

// ── Photo Preview ─────────────────────────────────────────────
function handlePhotoChange(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showToast('Photo must be under 5 MB.', 'error');
    input.value = '';
    return;
  }
  userPhotoFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('photo-preview');
    img.src = e.target.result;
    img.style.display = 'block';
    document.getElementById('upload-ph').style.display = 'none';
    document.querySelector('#pane-submit .upload-zone').classList.add('has-file');
  };
  reader.readAsDataURL(file);
}

// ── Submit Complaint ──────────────────────────────────────────
async function submitComplaint() {
  const category    = document.getElementById('f-category').value;
  const title       = document.getElementById('f-title').value.trim();
  const description = document.getElementById('f-desc').value.trim();
  const location    = document.getElementById('f-location').value.trim();
  const errEl       = document.getElementById('submit-alert');

  if (!category || !title || !description || !location) {
    errEl.textContent = 'Please fill in all required fields.';
    errEl.className   = 'alert alert-error show';
    return;
  }
  errEl.className = 'alert';

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Uploading & Submitting...';

  try {
    const id = await addComplaint({
      studentId:    session.id,
      studentName:  session.name,
      studentRoom:  session.room,
      studentBlock: session.block,
      category, title, description, location,
      priority: selectedPriority
    }, userPhotoFile);

    // Reset form
    ['f-category','f-title','f-desc','f-location'].forEach(fid => {
      document.getElementById(fid).value = '';
    });
    document.getElementById('f-photo').value = '';
    document.getElementById('photo-preview').style.display = 'none';
    document.getElementById('upload-ph').style.display = '';
    document.querySelector('#pane-submit .upload-zone').classList.remove('has-file');
    userPhotoFile = null;
    setPriority('Low');

    showToast(`✅ Submitted! ID: ${id}`, 'success');
    setTimeout(() => switchTab('complaints'), 900);

  } catch (err) {
    errEl.textContent = '❌ Error: ' + err.message;
    errEl.className   = 'alert alert-error show';
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Submit Complaint →';
  }
}

// ── Real-time Listener ────────────────────────────────────────
function startComplaintsListener() {
  if (unsubscribe) unsubscribe();
  unsubscribe = watchStudentComplaints(session.id, (data, err) => {
    if (err) {
      document.getElementById('complaint-list').innerHTML =
        buildEmpty('Connection Error', err.message);
      return;
    }
    renderComplaints(data);
  });
}

// ── Render Complaints ─────────────────────────────────────────
function renderComplaints(data) {
  // Badge on tab
  const badge = document.getElementById('complaints-badge');
  badge.textContent    = data.length || '';
  badge.style.display  = data.length ? '' : 'none';

  // Summary counts
  setEl('ss-total',    data.length);
  setEl('ss-pending',  data.filter(c => c.status === 'pending').length);
  setEl('ss-resolved', data.filter(c => c.status === 'resolved').length);
  setEl('ss-rejected', data.filter(c => c.status === 'rejected').length);

  document.getElementById('complaint-list').innerHTML = data.length
    ? data.map(buildStudentCard).join('')
    : buildEmpty('No complaints yet', 'Switch to "New Complaint" to submit your first one.');
}

// ── Card Builder ──────────────────────────────────────────────
function buildStudentCard(c) {
  let extra = '';

  // Student's own attached photo
  if (c.photoBase64) {
    extra += `
      <div class="c-photo">
        <img src="${c.photoBase64}" loading="lazy" alt="Your photo">
        <div class="c-photo-label blue">📷 Your attached photo</div>
      </div>`;
  }

  // Admin resolution proof
  if (c.status === 'resolved') {
    if (c.resolvedPhotoBase64) {
      extra += `
        <div class="c-photo" style="margin-top:10px">
          <img src="${c.resolvedPhotoBase64}" loading="lazy" alt="Resolution proof">
          <div class="c-photo-label green">✅ Resolved · ${formatDate(c.resolvedAt)}</div>
        </div>`;
    } else {
      extra += `<div class="c-photo-label green" style="padding:10px 0 0;">✅ Marked resolved · ${formatDate(c.resolvedAt)}</div>`;
    }
    if (c.adminNote) {
      extra += `<div class="c-admin-note">📝 Admin note: ${esc(c.adminNote)}</div>`;
    }
  }

  if (c.status === 'rejected' && c.rejectReason) {
    extra += `<div class="c-reject-note">❌ Rejected: ${esc(c.rejectReason)}</div>`;
  }

  return `
    <div class="c-card status-${c.status}">
      <div class="c-card-title">${esc(c.title)}</div>
      <div class="c-card-tags">
        <span class="tag tag-cat">${esc(c.category)}</span>
        ${priorityTag(c.priority)} ${statusTag(c.status)}
        <span class="c-id">${c.id}</span>
      </div>
      <div class="c-card-body">${esc(c.description)}</div>
      ${extra}
      <div class="c-card-footer">
        <span>📍 ${esc(c.location)}</span>
        <span>🕒 ${formatDate(c.createdAt)}</span>
      </div>
    </div>`;
}

// ── Logout ────────────────────────────────────────────────────
function logout() {
  if (unsubscribe) unsubscribe();
  studentLogout();
}

// ── Helpers ───────────────────────────────────────────────────
function statusTag(s) {
  return { pending: '<span class="tag tag-pending">⏳ Pending</span>', resolved: '<span class="tag tag-resolved">✅ Resolved</span>', rejected: '<span class="tag tag-rejected">❌ Rejected</span>' }[s] || '';
}
function priorityTag(p) {
  return { High: '<span class="tag tag-high">🔴 High</span>', Medium: '<span class="tag tag-medium">🟡 Medium</span>', Low: '<span class="tag tag-low">🟢 Low</span>' }[p] || '';
}
function buildEmpty(title, desc) {
  return `<div class="empty-state"><div class="es-icon">📭</div><h3>${esc(title)}</h3><p>${esc(desc)}</p></div>`;
}
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function setEl(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

let _toastTimer;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast-${type} show`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.className = '', 4000);
}
