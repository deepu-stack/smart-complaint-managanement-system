/* ============================================================
   js/db.js — Firestore Database Operations
   ──────────────────────────────────────────────────────────
   IMAGE STRATEGY (no Firebase Storage):
     Photos are compressed client-side using the Canvas API
     (max 900×900 px, JPEG quality 0.72) then stored as a
     base64 string inside the Firestore document itself.
     
     Typical sizes after compression:
       High-res phone photo  →  ~60–120 KB base64
       Already-small photo   →  ~15–40  KB base64
     Firestore document limit: 1 MB — well within range.
   ============================================================ */

// ─────────────────────────────────────────────
//  IMAGE COMPRESSION UTILITY
// ─────────────────────────────────────────────

/**
 * Compress a File/Blob using Canvas and return a base64 JPEG string.
 * Max dimension: 900px (longer side). Quality: 0.72.
 * Returns null if file is null/undefined.
 */
function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(null); return; }

    // Reject if over 5 MB before compression
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('Photo is too large. Please choose an image under 5 MB.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 900;
        let { width, height } = img;

        // Scale down maintaining aspect ratio
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else                { width  = Math.round(width  * MAX / height); height = MAX; }
        }

        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);

        // Export as JPEG base64
        const base64 = canvas.toDataURL('image/jpeg', 0.72);
        resolve(base64);
      };
      img.onerror = () => reject(new Error('Could not read image file.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Could not load image file.'));
    reader.readAsDataURL(file);
  });
}

// ─────────────────────────────────────────────
//  UTILITY
// ─────────────────────────────────────────────

function genId(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = (ts.toDate) ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}
window.formatDate = formatDate;

// ─────────────────────────────────────────────
//  STUDENT OPERATIONS
// ─────────────────────────────────────────────

/**
 * Seed pre-registered students from STUDENT_SEED_DATA into Firestore.
 * Skips students that already exist (idempotent / safe to run multiple times).
 * Called from Admin Panel → Students → "Seed Students".
 * @returns {Promise<number>} Number of new students added.
 */
async function seedStudents() {
  const batch  = db.batch();
  let   seeded = 0;
  for (const s of window.STUDENT_SEED_DATA) {
    const ref  = db.collection('students').doc(s.id);
    const snap = await ref.get();
    if (!snap.exists) {
      batch.set(ref, {
        ...s,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      seeded++;
    }
  }
  await batch.commit();
  return seeded;
}

/**
 * Find a student by room number (case-insensitive).
 * Queries Firestore first; falls back to STUDENT_SEED_DATA in memory.
 * If found in seed data but not in Firestore, auto-writes to Firestore
 * so future logins hit the DB directly.
 *
 * @param {string} room - e.g. "A-101"
 * @returns {Promise<object|null>} Student data or null if not registered.
 */
async function findStudentByRoom(room) {
  const normalised = room.trim().toUpperCase();

  // 1. Try Firestore first
  try {
    const snap = await db.collection('students')
      .where('room', '==', normalised)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0].data();
  } catch (err) {
    console.warn('[findStudentByRoom] Firestore query failed:', err.message);
  }

  // 2. Fallback: check in-memory STUDENT_SEED_DATA
  const seedMatch = (window.STUDENT_SEED_DATA || []).find(
    s => s.room.toUpperCase() === normalised
  );
  if (!seedMatch) return null;

  // 3. Auto-seed this student to Firestore so next login uses DB
  try {
    const ref = db.collection('students').doc(seedMatch.id);
    const existing = await ref.get();
    if (!existing.exists) {
      await ref.set({
        ...seedMatch,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.info('[findStudentByRoom] Auto-seeded student:', seedMatch.id);
    }
  } catch (err) {
    // Non-fatal — login still proceeds using seed data
    console.warn('[findStudentByRoom] Could not auto-seed:', err.message);
  }

  return seedMatch;
}

/**
 * Update a student's password and clear the first-login flag.
 */
async function updateStudentPassword(studentId, newPassword) {
  await db.collection('students').doc(studentId).update({
    password:           newPassword,
    mustChangePassword: false,
    passwordChangedAt:  firebase.firestore.FieldValue.serverTimestamp()
  });
}

/**
 * Get all students ordered by block → room (admin use).
 */
async function getAllStudents() {
  // Try Firestore; if empty, return seed data so admin panel still shows something
  const snap = await db.collection('students')
    .orderBy('block').orderBy('room').get();
  if (!snap.empty) return snap.docs.map(d => d.data());

  // Return seed data as placeholder (not yet synced to DB)
  return (window.STUDENT_SEED_DATA || []).map(s => ({
    ...s,
    _fromSeed: true,
    createdAt: null
  }));
}

// ─────────────────────────────────────────────
//  COMPLAINT OPERATIONS
// ─────────────────────────────────────────────

/**
 * Add a new complaint. Compresses and embeds photo as base64 in the doc.
 * @returns {Promise<string>} New complaint ID.
 */
async function addComplaint(data, photoFile) {
  const id         = genId('CMP');
  const photoBase64 = await compressImage(photoFile);   // null if no file

  const doc = {
    id,
    studentId:    data.studentId,
    studentName:  data.studentName,
    studentRoom:  data.studentRoom,
    studentBlock: data.studentBlock,
    category:     data.category,
    title:        data.title,
    description:  data.description,
    location:     data.location,
    priority:     data.priority,
    photoBase64,                   // base64 JPEG or null
    status:       'pending',
    createdAt:    firebase.firestore.FieldValue.serverTimestamp(),
    resolvedAt:          null,
    resolvedPhotoBase64: null,
    adminNote:           null,
    rejectReason:        null
  };

  await db.collection('complaints').doc(id).set(doc);
  return id;
}

/**
 * Watch a student's own complaints in real-time.
 * Returns an unsubscribe function — call it to stop listening.
 */
function watchStudentComplaints(studentId, callback) {
  return db.collection('complaints')
    .where('studentId', '==', studentId)
    .orderBy('createdAt', 'desc')
    .onSnapshot(
      snap => callback(snap.docs.map(d => d.data()), null),
      err  => callback(null, err)
    );
}

/**
 * Watch ALL complaints in real-time (admin).
 * Returns an unsubscribe function.
 */
function watchAllComplaints(callback) {
  return db.collection('complaints')
    .orderBy('createdAt', 'desc')
    .onSnapshot(
      snap => callback(snap.docs.map(d => d.data()), null),
      err  => callback(null, err)
    );
}

/**
 * Mark complaint as resolved. Uploads proof photo as base64 in Firestore.
 */
async function resolveComplaint(complaintId, adminNote, resolvedPhotoFile) {
  const resolvedPhotoBase64 = await compressImage(resolvedPhotoFile);

  await db.collection('complaints').doc(complaintId).update({
    status:              'resolved',
    resolvedAt:          firebase.firestore.FieldValue.serverTimestamp(),
    adminNote:           adminNote || null,
    resolvedPhotoBase64: resolvedPhotoBase64
  });
}

/**
 * Reject a complaint with a reason string.
 */
async function rejectComplaint(complaintId, reason) {
  await db.collection('complaints').doc(complaintId).update({
    status:       'rejected',
    rejectReason: reason
  });
}

/**
 * Permanently delete a complaint document.
 */
async function deleteComplaint(complaintId) {
  await db.collection('complaints').doc(complaintId).delete();
}
