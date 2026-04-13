// src/AuthPage.jsx
import React, { useState } from "react";
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function AuthPage() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        // Create auth account
        const cred = await createUserWithEmailAndPassword(auth, email, password);

        // Set display name
        await updateProfile(cred.user, { displayName: name });

        // Save user profile to Firestore — EMAIL as doc ID, uid stored as a field
        await setDoc(doc(db, "users", email), {
          name,
          email,
          uid: cred.user.uid,       // ← uid stored as a field, not the doc ID
          createdAt: serverTimestamp(),
          totalSigns: 0,
          totalSessions: 0,
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      const messages = {
        "auth/email-already-in-use": "Email is already registered.",
        "auth/invalid-email": "Invalid email address.",
        "auth/weak-password": "Password must be at least 6 characters.",
        "auth/user-not-found": "No account found with this email.",
        "auth/wrong-password": "Incorrect password.",
        "auth/invalid-credential": "Incorrect email or password.",
      };
      setError(messages[err.code] || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo / Title */}
        <div style={styles.logoWrap}>
          <span style={styles.logoIcon}>🤟</span>
          <h1 style={styles.logoTitle}>
            Sign <span style={{ color: "#00f5a0" }}>Language</span> Detector
          </h1>
          <p style={styles.logoSub}>Filipino Sign Language Recognition System</p>
        </div>

        {/* Tab switcher */}
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(mode === "login" ? styles.tabActive : {}) }}
            onClick={() => { setMode("login"); setError(""); }}
          >
            Login
          </button>
          <button
            style={{ ...styles.tab, ...(mode === "signup" ? styles.tabActive : {}) }}
            onClick={() => { setMode("signup"); setError(""); }}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === "signup" && (
            <div style={styles.field}>
              <label style={styles.label}>Full Name</label>
              <input
                style={styles.input}
                type="text"
                placeholder="Juan dela Cruz"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder={mode === "signup" ? "Min. 6 characters" : "Your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading
              ? "Please wait..."
              : mode === "signup"
              ? "Create Account"
              : "Login"}
          </button>
        </form>

        <p style={styles.switchText}>
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <span
            style={styles.switchLink}
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
          >
            {mode === "login" ? "Sign up" : "Login"}
          </span>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#0f0f1a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1rem",
  },
  card: {
    background: "#1a1a2e",
    border: "1px solid #2a2a4a",
    borderRadius: "16px",
    padding: "2rem",
    width: "100%",
    maxWidth: "420px",
  },
  logoWrap: {
    textAlign: "center",
    marginBottom: "1.5rem",
  },
  logoIcon: {
    fontSize: "2.5rem",
  },
  logoTitle: {
    color: "#fff",
    fontSize: "1.4rem",
    fontWeight: 700,
    margin: "0.25rem 0 0",
  },
  logoSub: {
    color: "#888",
    fontSize: "0.8rem",
    margin: "0.25rem 0 0",
  },
  tabs: {
    display: "flex",
    background: "#0f0f1a",
    borderRadius: "10px",
    padding: "4px",
    marginBottom: "1.5rem",
  },
  tab: {
    flex: 1,
    padding: "0.5rem",
    border: "none",
    borderRadius: "8px",
    background: "transparent",
    color: "#888",
    cursor: "pointer",
    fontWeight: 500,
    fontSize: "0.9rem",
    transition: "all 0.2s",
  },
  tabActive: {
    background: "#00f5a0",
    color: "#0f0f1a",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
  },
  label: {
    color: "#aaa",
    fontSize: "0.85rem",
    fontWeight: 500,
  },
  input: {
    background: "#0f0f1a",
    border: "1px solid #2a2a4a",
    borderRadius: "8px",
    padding: "0.65rem 0.9rem",
    color: "#fff",
    fontSize: "0.95rem",
    outline: "none",
    transition: "border-color 0.2s",
  },
  error: {
    background: "#2a0f0f",
    border: "1px solid #ff6b8a",
    color: "#ff6b8a",
    borderRadius: "8px",
    padding: "0.6rem 0.9rem",
    fontSize: "0.85rem",
  },
  btn: {
    background: "#00f5a0",
    color: "#0f0f1a",
    border: "none",
    borderRadius: "8px",
    padding: "0.75rem",
    fontWeight: 700,
    fontSize: "1rem",
    cursor: "pointer",
    marginTop: "0.5rem",
    transition: "opacity 0.2s",
  },
  switchText: {
    textAlign: "center",
    color: "#888",
    fontSize: "0.85rem",
    marginTop: "1.2rem",
  },
  switchLink: {
    color: "#00f5a0",
    cursor: "pointer",
    fontWeight: 600,
  },
};
