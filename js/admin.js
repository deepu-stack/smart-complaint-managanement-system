/* ============================================================
   js/admin.js — Admin Portal Logic
   ============================================================ */

// ── Session Guard ─────────────────────────────────────────────
if (!sessionStorage.getItem('admin_session')) {
  window.location.href = 'index.html';
}

// ── State ─────────────────────────────────────────────────────
let allComplaints    = [];
let activeFilter     = 'all';
let unsubscribeAdmin = null;
let resolveId        = null;
let resolvePhotoFile = null;
let rejectId         = null;

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  startAdminListener();
});

// ── Real-time Listener ────────────────────────────────────────
function startAdminListener() {
  if (unsubscribeAdmin) unsubscribeAdmin();
  unsubscribeAdmin = watchAllComplaints((data, err) => {
    if (err) {
      document.getElementById('admin-complaint-list').innerHTML =
        `<div class="empty-state"><div class="es-icon">⚠️</div><h3>Connection Error</h3><p>${err.message}</p></div>`;
      return;
    }
    allComplaints = data;
    updateStats(data);
    renderAdminList();
  });
}

// ── Stats ─────────────────────────────────────────────────────
function updateStats(data) {
  const p = data.filter(c => c.status === 'pending').length;
  const r = data.filter(c => c.status === 'resolved').length;
  const j = data.filter(c => c.status === 'rejected').length;
  setEl('s-total', data.length); setEl('s-pending', p);
  setEl('s-resolved', r);        setEl('s-rejected', j);
  setEl('nb-all', data.length);  setEl('nb-pending', p);
  setEl('nb-resolved', r);       setEl('nb-rejected', j);
}

// ── Navigation ────────────────────────────────────────────────
function setFilter(filter, el) {
  activeFilter = filter;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  showPanel('complaints-panel');
  renderAdminList();
}

function showPanel(id) {
  ['complaints-panel','student-panel'].forEach(p => {
    document.getElementById(p).style.display = p === id ? '' : 'none';
  });
}

function showStudentPanel() {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  showPanel('student-panel');
  loadStudentList();
}

// ── Render Complaint List ─────────────────────────────────────
function renderAdminList() {
  let data = [...allComplaints];

  // Status / priority filter
  if (activeFilter === 'pending')  data = data.filter(c => c.status === 'pending');
  if (activeFilter === 'resolved') data = data.filter(c => c.status === 'resolved');
  if (activeFilter === 'rejected') data = data.filter(c => c.status === 'rejected');
  if (activeFilter === 'high')     data = data.filter(c => c.priority === 'High');
  if (activeFilter === 'medium')   data = data.filter(c => c.priority === 'Medium');
  if (activeFilter === 'low')      data = data.filter(c => c.priority === 'Low');

  // Search
  const q = (document.getElementById('admin-search')?.value || '').toLowerCase();
  if (q) data = data.filter(c =>
    [c.studentName, c.studentRoom, c.title, c.description, c.location, c.id]
      .some(f => (f || '').toLowerCase().includes(q))
  );

  // Category
  const cat = document.getElementById('admin-cat-filter')?.value || '';
  if (cat) data = data.filter(c => c.category === cat);

  const el = document.getElementById('admin-complaint-list');
  el.innerHTML = data.length
    ? data.map(buildAdminCard).join('')
    : `<div class="empty-state"><div class="es-icon">🗂️</div><h3>No complaints found</h3><p>Adjust filters or search.</p></div>`;
}

// ── Admin Complaint Card ──────────────────────────────────────
function buildAdminCard(c) {
  let photoSec = '';
  if (c.photoBase64) {
    photoSec = `<div class="c-photo"><img src="${c.photoBase64}" loading="lazy" alt="Complaint photo"><div class="c-photo-label blue">📷 Resident's attached photo</div></div>`;
  }

  let resolution = '';
  if (c.status === 'resolved') {
    if (c.resolvedPhotoBase64) {
      resolution = `<div class="c-photo" style="margin-top:10px"><img src="${c.resolvedPhotoBase64}" loading="lazy" alt="Proof"><div class="c-photo-label green">✅ Resolution proof · ${formatDate(c.resolvedAt)}</div></div>`;
    }
    if (c.adminNote) resolution += `<div class="c-admin-note">📝 ${esc(c.adminNote)}</div>`;
  }
  if (c.status === 'rejected' && c.rejectReason) {
    resolution = `<div class="c-reject-note">❌ ${esc(c.rejectReason)}</div>`;
  }

  const actions = c.status === 'pending'
    ? `<div class="c-admin-actions">
         <button class="btn btn-success btn-sm" onclick="openResolveModal('${c.id}')">✅ Mark Resolved</button>
         <button class="btn btn-danger btn-sm"  onclick="openRejectModal('${c.id}')">❌ Reject</button>
       </div>`
    : `<div class="c-admin-actions">
         <button class="btn btn-ghost btn-xs" onclick="confirmDelete('${c.id}')">🗑️ Delete</button>
       </div>`;

  return `
    <div class="c-card status-${c.status}">
      <div class="c-student-row">
        <span class="s-chip">👤 <b>${esc(c.studentName)}</b></span>
        <span class="s-chip">🏠 <b>${esc(c.studentRoom)}</b> · ${esc(c.studentBlock)}</span>
        <span class="s-chip">🆔 ${esc(c.studentId || '—')}</span>
      </div>
      <div class="c-card-title">${esc(c.title)}</div>
      <div class="c-card-tags">
        <span class="tag tag-cat">${esc(c.category)}</span>
        ${priorityTag(c.priority)} ${statusTag(c.status)}
        <span class="c-id">${c.id}</span>
      </div>
      <div class="c-card-body">${esc(c.description)}</div>
      <div class="c-card-footer">
        <span>📍 ${esc(c.location)}</span>
        <span>🕒 ${formatDate(c.createdAt)}</span>
      </div>
      ${photoSec}${resolution}${actions}
    </div>`;
}

// ── Resolve Modal ─────────────────────────────────────────────
function openResolveModal(id) {
  resolveId = id; resolvePhotoFile = null;
  document.getElementById('r-note').value = '';
  document.getElementById('r-photo-preview').style.display = 'none';
  document.getElementById('r-upload-ph').style.display = '';
  document.getElementById('r-photo').value = '';
  document.querySelector('#resolve-modal .upload-zone').classList.remove('has-file');
  openModal('resolve-modal');
}

function handleResolvePhoto(input) {
  const f = input.files[0];
  if (!f) return;
  if (f.size > 5 * 1024 * 1024) { showToast('Max 5 MB', 'error'); return; }
  resolvePhotoFile = f;
  const r = new FileReader();
  r.onload = e => {
    const img = document.getElementById('r-photo-preview');
    img.src = e.target.result; img.style.display = 'block';
    document.getElementById('r-upload-ph').style.display = 'none';
    document.querySelector('#resolve-modal .upload-zone').classList.add('has-file');
  };
  r.readAsDataURL(f);
}

async function confirmResolve() {
  const btn  = document.getElementById('resolve-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Saving...';
  try {
    await resolveComplaint(resolveId, document.getElementById('r-note').value.trim(), resolvePhotoFile);
    closeModal('resolve-modal');
    showToast(`✅ Complaint ${resolveId} resolved!`, 'success');
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = '✅ Confirm Resolved';
  }
}

// ── Reject Modal ──────────────────────────────────────────────
function openRejectModal(id) {
  rejectId = id;
  document.getElementById('rj-reason').value = '';
  openModal('reject-modal');
}

async function confirmReject() {
  const reason = document.getElementById('rj-reason').value.trim();
  if (!reason) { showToast('Enter a rejection reason', 'error'); return; }
  const btn = document.getElementById('reject-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Saving...';
  try {
    await rejectComplaint(rejectId, reason);
    closeModal('reject-modal');
    showToast('Complaint rejected.', 'info');
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = '❌ Confirm Rejection';
  }
}

// ── Delete ────────────────────────────────────────────────────
async function confirmDelete(id) {
  if (!confirm(`Delete ${id}? This cannot be undone.`)) return;
  try { await deleteComplaint(id); showToast('Deleted.', 'info'); }
  catch (e) { showToast('Error: ' + e.message, 'error'); }
}

// ── Student Management ────────────────────────────────────────
async function loadStudentList() {
  const el = document.getElementById('student-list');
  el.innerHTML = `<div class="empty-state"><div class="es-icon">⏳</div><h3>Loading...</h3></div>`;
  try {
    const students = await getAllStudents();
    if (!students.length) {
      el.innerHTML = `<div class="empty-state"><div class="es-icon">👥</div><h3>No students found</h3><p>Click "Seed Students to Database" above.</p></div>`;
      return;
    }
    el.innerHTML = `<div style="display:grid;gap:12px;">${students.map(buildStudentCard).join('')}</div>`;
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><div class="es-icon">⚠️</div><h3>Error</h3><p>${e.message}</p></div>`;
  }
}

function buildStudentCard(s) {
  const pwdStatus = s.mustChangePassword
    ? `<span class="tag tag-pending">⚠️ Must Change Password</span>`
    : `<span class="tag tag-resolved">✅ Password Set</span>`;
  const seedNote = s._fromSeed ? `<span class="tag" style="background:rgba(249,115,22,0.12);color:var(--accent3);border:1px solid rgba(249,115,22,0.3);">⬆️ Not yet synced to DB</span>` : '';

  return `
    <div class="c-card" style="border-left-color:var(--accent2);">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div>
          <div class="c-card-title">🎓 ${esc(s.name)}</div>
          <div class="c-card-tags" style="margin-top:8px;">
            <span class="tag tag-cat">🏠 ${esc(s.room)}</span>
            <span class="tag tag-cat">🏢 ${esc(s.block)}</span>
            <span class="c-id">${esc(s.id)}</span>
            ${pwdStatus} ${seedNote}
          </div>
        </div>
      </div>
      <div class="c-card-footer" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
        <span>📧 ${esc(s.email || '—')}</span>
        <span>📱 ${esc(s.phone || '—')}</span>
        ${s.createdAt ? `<span>📅 ${formatDate(s.createdAt)}</span>` : '<span>📅 Not yet seeded</span>'}
      </div>
    </div>`;
}

async function seedStudentsUI() {
  if (!confirm('Sync students from config.js to Firestore?\nExisting students will NOT be overwritten.')) return;
  try {
    const count = await seedStudents();
    showToast(count > 0 ? `✅ Seeded ${count} new student(s).` : '✅ All students already in DB.', 'success');
    loadStudentList();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

// ── Reset Password ────────────────────────────────────────────
async function resetStudentPassword() {
  const room    = document.getElementById('reset-room').value.trim().toUpperCase();
  const alertEl = document.getElementById('reset-alert');
  const btn     = document.getElementById('reset-btn');
  if (!room) { alertEl.textContent='Enter a room number.'; alertEl.className='alert alert-error show'; return; }

  btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Resetting...';
  alertEl.className = 'alert';

  try {
    const student = await findStudentByRoom(room);
    if (!student) {
      alertEl.textContent = '❌ No student found for room ' + room;
      alertEl.className   = 'alert alert-error show';
      return;
    }
    const seed   = (window.STUDENT_SEED_DATA || []).find(s => s.room === room);
    const newPwd = seed ? seed.password : (student.name.split(' ')[0] + '@' + room.replace('-',''));

    await db.collection('students').doc(student.id).update({
      password: newPwd, mustChangePassword: true
    });
    alertEl.innerHTML = `✅ Password reset for <b>${esc(student.name)}</b>.<br>Temp password: <code style="background:var(--surface2);padding:2px 6px;border-radius:4px;">${esc(newPwd)}</code>`;
    alertEl.className = 'alert alert-success show';
  } catch (e) {
    alertEl.textContent = 'Error: ' + e.message;
    alertEl.className   = 'alert alert-error show';
  } finally {
    btn.disabled = false; btn.innerHTML = '🔑 Reset Password';
  }
}

// ── Logout ────────────────────────────────────────────────────
function logout() {
  if (unsubscribeAdmin) unsubscribeAdmin();
  sessionStorage.removeItem('admin_session');
  window.location.href = 'index.html';
}

// ── Modal Helpers ─────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
  });
});

// ── Generic Helpers ───────────────────────────────────────────
function statusTag(s) {
  return {pending:'<span class="tag tag-pending">⏳ Pending</span>',resolved:'<span class="tag tag-resolved">✅ Resolved</span>',rejected:'<span class="tag tag-rejected">❌ Rejected</span>'}[s]||'';
}
function priorityTag(p) {
  return {High:'<span class="tag tag-high">🔴 High</span>',Medium:'<span class="tag tag-medium">🟡 Medium</span>',Low:'<span class="tag tag-low">🟢 Low</span>'}[p]||'';
}
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function setEl(id,v) { const e=document.getElementById(id); if(e) e.textContent=v; }
let _tt;
function showToast(msg, type='success') {
  const t=document.getElementById('toast'); t.textContent=msg;
  t.className=`toast-${type} show`; clearTimeout(_tt);
  _tt=setTimeout(()=>t.className='',4000);
}
