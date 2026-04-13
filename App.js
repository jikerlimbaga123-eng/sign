import React, { useRef, useEffect, useState, useCallback } from "react";
import "./App.css";
import DataCollector from "./DataCollector";
import About from "./About";
import fslModel from "./fsl_model.json";
import AuthPage from "./AuthPage";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  ensureUserDoc,
  saveSignToHistory,
  updateSignReport,
  startSession,
  endSession,
} from "./firestoreHelpers";

function normalizeLandmarks(landmarks) {
  const pts = landmarks.map(p => [p.x, p.y, p.z]);
  const wrist = pts[0];
  const translated = pts.map(p => [p[0]-wrist[0], p[1]-wrist[1], p[2]-wrist[2]]);
  const mid = translated[9];
  const scale = Math.sqrt(mid[0]**2 + mid[1]**2 + mid[2]**2);
  const scaled = scale > 0
    ? translated.map(p => [p[0]/scale, p[1]/scale, p[2]/scale])
    : translated;
  return scaled.flat();
}

function predictSign(landmarks) {
  if (!landmarks || landmarks.length === 0) return null;
  const features = normalizeLandmarks(landmarks);
  const votes = {};
  for (const tree of fslModel.trees) {
    let node = 0;
    while (tree.children_left[node] !== -1) {
      if (features[tree.feature[node]] <= tree.threshold[node]) {
        node = tree.children_left[node];
      } else {
        node = tree.children_right[node];
      }
    }
    const classVotes = tree.value[node][0];
    const classIdx   = classVotes.indexOf(Math.max(...classVotes));
    const label      = fslModel.labels[classIdx];
    votes[label]     = (votes[label] || 0) + 1;
  }
  const sorted     = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  const topLabel   = sorted[0][0];
  const confidence = Math.round((sorted[0][1] / fslModel.trees.length) * 100);
  return { sign: topLabel, confidence };
}

export default function App() {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const handsRef  = useRef(null);
  const cameraRef = useRef(null);

  // Auth state
  const [user, setUser]               = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userName, setUserName]       = useState("");

  // Session tracking
  const sessionIdRef     = useRef(null);
  const sessionSignsRef  = useRef(0);
  const sessionUniqueRef = useRef(new Set());

  const [activeTab, setActiveTab]     = useState("detector");
  const [currentSign, setCurrentSign] = useState(null);
  const [confidence, setConfidence]   = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [history, setHistory]         = useState([]);
  const [isRunning, setIsRunning]     = useState(false);
  const [isSpeaking, setIsSpeaking]   = useState(false);
  const [error, setError]             = useState(null);

  const lastSpokenRef = useRef("");
  const lastTimeRef   = useRef(0);

  // ── Listen for auth state changes ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        const email = firebaseUser.email;

        // ✅ Create/merge user doc using EMAIL as the document ID
        await ensureUserDoc(email, firebaseUser.uid);

        // Fetch display name from Firestore doc (keyed by email now)
        try {
          const snap = await getDoc(doc(db, "users", email));
          if (snap.exists()) {
            setUserName(snap.data().name || email || "User");
          } else {
            setUserName(email || "User");
          }
        } catch {
          setUserName(email || "User");
        }

        // Start a new session — doc keyed by email
        const sid = await startSession(email);
        sessionIdRef.current     = sid;
        sessionSignsRef.current  = 0;
        sessionUniqueRef.current = new Set();
      } else {
        setUser(null);
        setUserName("");
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []); // eslint-disable-line

  const handleLogout = async () => {
    if (user && sessionIdRef.current) {
      await endSession(
        user.email,                          // ✅ email instead of uid
        sessionIdRef.current,
        sessionSignsRef.current,
        Array.from(sessionUniqueRef.current)
      );
    }
    await signOut(auth);
  };

  const speak = useCallback((text) => {
    if (!text || text === lastSpokenRef.current) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "fil-PH";
    utt.rate = 0.9;
    utt.onstart = () => setIsSpeaking(true);
    utt.onend   = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utt);
    lastSpokenRef.current = text;
  }, []);

  const addToHistory = useCallback((sign, conf) => {
    const now = Date.now();
    if (now - lastTimeRef.current < 2000) return;
    lastTimeRef.current = now;
    const entry = { sign, time: new Date().toLocaleTimeString(), id: now };
    setHistory(prev => [entry, ...prev].slice(0, 20));
    setDisplayText(prev => (prev + " " + sign).trim());
    speak(sign);

    if (user) {
      saveSignToHistory(user.email, sign, conf).catch(console.error);   // ✅ email
      updateSignReport(user.email, sign, conf).catch(console.error);    // ✅ email
      sessionSignsRef.current += 1;
      sessionUniqueRef.current.add(sign);
    }
  }, [speak, user]);

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });

  // ── Only start camera AFTER user is logged in and on detector tab ──
  useEffect(() => {
    if (!user) return;
    if (activeTab !== "detector") return;

    async function initMediaPipe() {
      try {
        await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.js");
        await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1620248257/drawing_utils.js");
        await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1640029074/camera_utils.js");

        const hands = new window.Hands({
          locateFile: (f) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${f}`,
        });
        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.5,
        });

        hands.onResults((results) => {
          const canvas = canvasRef.current;
          const video  = videoRef.current;
          if (!canvas || !video) return;
          const ctx = canvas.getContext("2d");
          canvas.width  = video.videoWidth  || 640;
          canvas.height = video.videoHeight || 480;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.save();
          ctx.scale(-1, 1);
          ctx.translate(-canvas.width, 0);
          ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
          ctx.restore();
          if (results.multiHandLandmarks?.length > 0) {
            const lm = results.multiHandLandmarks[0];
            const mirroredLm = lm.map(p => ({
              x: 1 - p.x, y: p.y, z: p.z, visibility: p.visibility
            }));
            window.drawConnectors(ctx, mirroredLm, window.HAND_CONNECTIONS,
              { color: "#00f5a0", lineWidth: 2 });
            window.drawLandmarks(ctx, mirroredLm,
              { color: "#ff6b8a", lineWidth: 1, radius: 4 });
            const result = predictSign(lm);
            if (result) {
              setCurrentSign(result.sign);
              setConfidence(result.confidence);
              if (result.confidence >= 70) addToHistory(result.sign, result.confidence);
            }
          } else {
            setCurrentSign(null);
            setConfidence(0);
          }
        });

        handsRef.current = hands;
        let destroyed = false;

        const camera = new window.Camera(videoRef.current, {
          onFrame: async () => {
            if (destroyed || !handsRef.current) return;
            try {
              await handsRef.current.send({ image: videoRef.current });
            } catch (e) {}
          },
          width: 640, height: 480,
        });
        camera.start();
        cameraRef.current = camera;
        setIsRunning(true);
        setError(null);

        return () => {
          destroyed = true;
          try { camera.stop(); } catch(e) {}
          try { hands.close(); } catch(e) {}
          cameraRef.current = null;
          handsRef.current  = null;
          setIsRunning(false);
        };

      } catch (err) {
        setError("Camera/MediaPipe error: " + err.message);
      }
    }

    let cleanup = () => {};
    initMediaPipe().then(fn => { if (fn) cleanup = fn; });
    return () => cleanup();
  }, [user, activeTab, addToHistory]);

  const clearAll = () => {
    setHistory([]);
    setDisplayText("");
    lastSpokenRef.current = "";
  };

  const confidenceColor =
    confidence >= 80 ? "#00f5a0" : confidence >= 60 ? "#f59e0b" : "#ff6b8a";

  // ── Loading screen ──
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f0f1a", display: "flex",
        alignItems: "center", justifyContent: "center", color: "#00f5a0", fontSize: "1.2rem" }}>
        🤟 Loading...
      </div>
    );
  }

  // ── Show login/signup if not authenticated ──
  if (!user) return <AuthPage />;

  return (
    <div className="app">
      <header className="header">
        <h1>Sign <span>Language</span> Detector</h1>
        <div className="tabs">
          <button className={`tab ${activeTab === "detector" ? "active" : ""}`}
            onClick={() => setActiveTab("detector")}>🎯 Detector</button>
          <button className={`tab ${activeTab === "collect" ? "active" : ""}`}
            onClick={() => setActiveTab("collect")}>📸 Collect Data</button>
          <button className={`tab ${activeTab === "about" ? "active" : ""}`}
            onClick={() => setActiveTab("about")}>ℹ️ About</button>
        </div>

        {/* User info + logout */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className={`status ${isRunning ? "on" : "off"}`}>
            {isRunning ? "● Live" : "○ Starting..."}
          </div>
          <div style={styles.userBadge}>
            <span style={styles.userAvatar}>
              {(userName || "U").charAt(0).toUpperCase()}
            </span>
            <span style={styles.userName}>{userName}</span>
          </div>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </header>

      {activeTab === "collect" ? (
        <DataCollector />
      ) : activeTab === "about" ? (
        <About />
      ) : (
        <>
          {error && <div className="error-banner">{error}</div>}
          <div className="main-grid">

            {/* LEFT: Camera */}
            <div className="camera-section">
              <div className="camera-wrap">
                <video ref={videoRef} className="video-hidden" playsInline muted />
                <canvas ref={canvasRef} className="canvas" />
                {!isRunning && !error && (
                  <div className="loading">Initializing camera...</div>
                )}
              </div>
              <div className="sign-panel">
                <div className="sign-display">
                  {currentSign
                    ? <span className="sign-letter">{currentSign}</span>
                    : <span className="sign-placeholder">—</span>}
                </div>
                <div className="confidence-wrap">
                  <div className="confidence-label">Accuracy</div>
                  <div className="confidence-bar">
                    <div className="confidence-fill"
                      style={{ width: `${confidence}%`, background: confidenceColor }} />
                  </div>
                  <div className="confidence-pct" style={{ color: confidenceColor }}>
                    {confidence}%
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: Features */}
            <div className="right-panel">
              <div className="card text-card">
                <div className="card-header">
                  <span>📝 Translation</span>
                  <div className="card-actions">
                    <button onClick={() => speak(displayText || "Walang text")}
                      className="btn-icon">{isSpeaking ? "🔊" : "🔈"}</button>
                    <button onClick={clearAll} className="btn-icon">🗑️</button>
                  </div>
                </div>
                <div className="text-display">
                  {displayText ||
                    <span className="placeholder">Sign to start...</span>}
                </div>
              </div>

              <div className={`card voice-card ${isSpeaking ? "speaking" : ""}`}>
                <div className="voice-icon">{isSpeaking ? "🔊" : "🎙️"}</div>
                <div className="voice-label">
                  {isSpeaking ? "Nagsasalita..." : "Voice Output Ready"}
                </div>
              </div>

              <div className="card history-card">
                <div className="card-header">
                  <span>🕓 History</span>
                  <span className="badge">{history.length}</span>
                </div>
                <div className="history-list">
                  {history.length === 0
                    ? <div className="placeholder">No signs detected yet.</div>
                    : history.map(h => (
                      <div key={h.id} className="history-item">
                        <span className="h-sign">{h.sign}</span>
                        <span className="h-time">{h.time}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>

          {/* FSL Alphabet Guide */}
          <div className="guide-section">
            <div className="guide-header">FSL Alphabet Reference</div>
            <div className="guide-grid">
              {[
                {l:"A", h:"✊"}, {l:"B", h:"🖐️"}, {l:"C", h:"🤙"},
                {l:"D", h:"☝️"}, {l:"E", h:"🤜"}, {l:"F", h:"👌"},
                {l:"G", h:"👉"}, {l:"H", h:"🤞"}, {l:"I", h:"🤟"},
                {l:"J", h:"🤙"}, {l:"K", h:"✌️"}, {l:"L", h:"👆"},
                {l:"M", h:"🤛"}, {l:"N", h:"✊"}, {l:"O", h:"👌"},
                {l:"P", h:"👇"}, {l:"Q", h:"👇"}, {l:"R", h:"🤞"},
                {l:"S", h:"✊"}, {l:"T", h:"👍"}, {l:"U", h:"✌️"},
                {l:"V", h:"✌️"}, {l:"W", h:"🖖"}, {l:"X", h:"☝️"},
                {l:"Y", h:"🤙"}, {l:"Z", h:"☝️"},
              ].map(({l, h}) => (
                <div key={l} className={`guide-card ${currentSign === l ? "active-sign" : ""}`}>
                  <span className="guide-hand">{h}</span>
                  <span className="guide-letter">{l}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  userBadge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "rgba(0,245,160,0.1)",
    border: "1px solid rgba(0,245,160,0.3)",
    borderRadius: "20px",
    padding: "4px 12px 4px 4px",
  },
  userAvatar: {
    width: "26px",
    height: "26px",
    borderRadius: "50%",
    background: "#00f5a0",
    color: "#0f0f1a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: "0.8rem",
  },
  userName: {
    color: "#00f5a0",
    fontSize: "0.85rem",
    fontWeight: 600,
  },
  logoutBtn: {
    background: "transparent",
    border: "1px solid #ff6b8a",
    color: "#ff6b8a",
    borderRadius: "8px",
    padding: "5px 12px",
    cursor: "pointer",
    fontSize: "0.8rem",
    fontWeight: 600,
  },
};
