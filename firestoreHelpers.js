// src/firestoreHelpers.js
// All database read/write functions for the FSL app

import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";

// ─────────────────────────────────────────
// USER — ensure user document always exists
// Document ID: user's email (e.g. "juan@gmail.com")
// ─────────────────────────────────────────

export async function ensureUserDoc(email, uid) {
  const userRef = doc(db, "users", email);
  await setDoc(
    userRef,
    {
      email,
      uid,
      totalSigns: 0,
      totalSessions: 0,
      createdAt: serverTimestamp(),
    },
    { merge: true } // only writes missing fields; won't overwrite existing data
  );
}

// ─────────────────────────────────────────
// HISTORY — save each detected sign
// ─────────────────────────────────────────

export async function saveSignToHistory(email, sign, confidence) {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const docId = `${sign}_${timestamp}`;

  await setDoc(doc(db, "users", email, "history", docId), {
    sign,
    confidence,
    detectedAt: serverTimestamp(),
  });

  await setDoc(
    doc(db, "users", email),
    { totalSigns: increment(1) },
    { merge: true }
  );
}

export async function getSignHistory(email) {
  const q = query(
    collection(db, "users", email, "history"),
    orderBy("detectedAt", "desc"),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─────────────────────────────────────────
// SESSIONS — track each usage session
// ─────────────────────────────────────────

export async function startSession(email) {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const emailPrefix = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "_");
  const docId = `${emailPrefix}_${timestamp}`;

  await setDoc(doc(db, "users", email, "sessions", docId), {
    startedAt: serverTimestamp(),
    endedAt: null,
    signsDetected: 0,
    uniqueSigns: [],
  });

  await setDoc(
    doc(db, "users", email),
    { totalSessions: increment(1) },
    { merge: true }
  );

  return docId;
}

export async function endSession(email, sessionId, signsDetected, uniqueSigns) {
  await updateDoc(doc(db, "users", email, "sessions", sessionId), {
    endedAt: serverTimestamp(),
    signsDetected,
    uniqueSigns,
  });
}

export async function getSessions(email) {
  const q = query(
    collection(db, "users", email, "sessions"),
    orderBy("startedAt", "desc"),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─────────────────────────────────────────
// REPORTS — per-sign accuracy summary
// ─────────────────────────────────────────

export async function updateSignReport(email, sign, confidence) {
  const docId = `report_${sign}`;
  const reportRef = doc(db, "users", email, "reports", docId);
  const existing = await getDoc(reportRef);

  if (!existing.exists()) {
    await setDoc(reportRef, {
      sign,
      count: 1,
      totalConfidence: confidence,
      avgConfidence: confidence,
      firstSeen: serverTimestamp(),
      lastSeen: serverTimestamp(),
    });
  } else {
    const data = existing.data();
    const newCount = data.count + 1;
    const newTotal = data.totalConfidence + confidence;
    await updateDoc(reportRef, {
      count: newCount,
      totalConfidence: newTotal,
      avgConfidence: Math.round(newTotal / newCount),
      lastSeen: serverTimestamp(),
    });
  }
}

export async function getSignReports(email) {
  const q = query(
    collection(db, "users", email, "reports"),
    orderBy("count", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
