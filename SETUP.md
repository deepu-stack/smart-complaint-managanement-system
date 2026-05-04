# Smart Complaint System — Setup Guide

## Files in this project
```
index.html            ← Landing page (login)
student.html          ← Student portal
admin.html            ← Warden dashboard
change-password.html  ← First-login password change
css/global.css        ← Shared styles
css/landing.css       ← Landing page styles
css/student.css       ← Student portal styles
css/admin.css         ← Admin panel styles
css/auth.css          ← Auth page styles
js/config.js          ← Firebase config + student data ← EDIT THIS
js/db.js              ← Database operations (no Storage used)
js/auth.js            ← Login + session logic
js/student.js         ← Student portal logic
js/admin.js           ← Admin panel logic
js/change-password.js ← Password change logic
```

---

## Step 1 — Firebase Setup (5 minutes, free)

1. Go to https://console.firebase.google.com
2. Create a project → name it "hostel-complaints" → Disable Analytics → Create
3. **Build → Firestore Database → Create database → Test mode → Choose nearest region → Done**
4. ⚠️ DO NOT set up Storage — it is NOT needed in this version
5. Project Settings (⚙️) → General → Your apps → Web icon (</>)
6. Register app → copy the config values

---

## Step 2 — Edit js/config.js

Replace placeholder values:

```javascript
const firebaseConfig = {
  apiKey:            "AIzaSy...",
  authDomain:        "hostel-complaints.firebaseapp.com",
  projectId:         "hostel-complaints",
  messagingSenderId: "1234567890",
  appId:             "1:1234:web:abcdef"
  // storageBucket NOT needed
};
```

Also change the admin password:
```javascript
const ADMIN_CONFIG = {
  username: "warden",
  password: "YourStrongPassword"
};
```

---

## Step 3 — Deploy (free)

**Option A: Netlify (easiest)**
1. netlify.com → Sign up
2. Drag the entire folder onto the dashboard
3. Get URL → share with all hostel residents

**Option B: GitHub Pages**
1. New GitHub repo → upload all files
2. Settings → Pages → Deploy from main branch

---

## Step 4 — First Use

1. Open the site → Login as Admin (warden / hostel@123)
2. Sidenav → Students → "Seed Students to Database"
3. ✅ 5 students are now in Firestore

OR — students can just log in directly. The system auto-seeds them on first login.

---

## Student Default Credentials

| Name | Room | Default Password |
|---|---|---|
| Rahul Sharma | A-101 | Rahul@A101 |
| Priya Singh  | B-205 | Priya@B205 |
| Amit Kumar   | A-203 | Amit@A203  |
| Neha Gupta   | C-108 | Neha@C108  |
| Ravi Patel   | D-302 | Ravi@D302  |

Students MUST change password on first login.

---

## Adding New Students

Edit `js/config.js` → `STUDENT_SEED_DATA` array → Add entry:
```javascript
{
  id: "STU-006", name: "New Student",
  room: "E-101", block: "Block E",
  email: "new@hostel.in", phone: "9800000006",
  password: "New@E101", mustChangePassword: true
}
```
Then Admin Panel → Students → "Seed Students to Database".

---

## Why No Firebase Storage?

Firebase Storage requires a billing account for users outside the US.
Photos are instead compressed using the browser's Canvas API (max 900×900 px, JPEG 72%)
and stored as base64 inside Firestore documents. This is completely free worldwide.

Typical compressed photo size: 60–120 KB. Firestore document limit: 1 MB. ✅
