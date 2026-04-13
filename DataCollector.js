import React, { useRef, useEffect, useState, useCallback } from "react";

const LETTERS = [
  "A","B","C","D","E","F","G","H","I","J","K","L","M",
  "N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
  "HELLO","I LOVE YOU","SORRY","THANK YOU","FUCK YOU"
];
const SAMPLES_NEEDED = 50;

export default function DataCollector() {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const handsRef  = useRef(null);
  const cameraRef = useRef(null);
  const landmarksRef = useRef(null);

  const [currentLetter, setCurrentLetter] = useState("A");
  const [isReady, setIsReady]             = useState(false);
  const [isCollecting, setIsCollecting]   = useState(false);
  const [countdown, setCountdown]         = useState(0);
  const [progress, setProgress]           = useState({});
  const [status, setStatus]               = useState("Initializing...");
  const [handDetected, setHandDetected]   = useState(false);

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });

  useEffect(() => {
    const saved = localStorage.getItem("fsl_progress");
    if (saved) setProgress(JSON.parse(saved));
  }, []);

  useEffect(() => {
    async function init() {
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
            window.drawConnectors(ctx, lm, window.HAND_CONNECTIONS,
              { color: "#00FF88", lineWidth: 2 });
            window.drawLandmarks(ctx, lm,
              { color: "#FF3366", lineWidth: 1, radius: 4 });
            landmarksRef.current = lm;
            setHandDetected(true);
          } else {
            landmarksRef.current = null;
            setHandDetected(false);
          }
        });

        handsRef.current = hands;
        const camera = new window.Camera(videoRef.current, {
          onFrame: async () => {
            await hands.send({ image: videoRef.current });
          },
          width: 640, height: 480,
        });
        camera.start();
        cameraRef.current = camera;
        setIsReady(true);
        setStatus("Ready! Piliin ang letra at mag-collect.");
      } catch (err) {
        setStatus("Error: " + err.message);
      }
    }
    init();
    return () => { cameraRef.current?.stop(); handsRef.current?.close(); };
  }, []);

  const collectSamples = useCallback(() => {
    if (!handDetected) {
      setStatus("❌ Walang nakitang kamay! Ilagay ang kamay sa camera.");
      return;
    }

    setIsCollecting(true);
    setStatus(`Magsisimula sa 3 seconds... Ihanda ang sign para sa "${currentLetter}"`);

    let count = 3;
    setCountdown(count);
    const cdInterval = setInterval(() => {
      count--;
      setCountdown(count);
      if (count === 0) clearInterval(cdInterval);
    }, 1000);

    setTimeout(() => {
      setStatus(`Nag-coCollect para sa "${currentLetter}"...`);
      setCountdown(0);
      const samples = [];
      let collected = 0;
      const needed  = SAMPLES_NEEDED;

      const interval = setInterval(() => {
        if (landmarksRef.current && collected < needed) {
          const flat = landmarksRef.current.flatMap(p => [p.x, p.y, p.z]);
          samples.push(flat);
          collected++;

          setProgress(prev => {
            const updated = { ...prev, [currentLetter]: (prev[currentLetter] || 0) + 1 };
            localStorage.setItem("fsl_progress", JSON.stringify(updated));
            return updated;
          });

          setStatus(`Collecting "${currentLetter}": ${collected}/${needed}`);
        }

        if (collected >= needed) {
          clearInterval(interval);
          setIsCollecting(false);

          const existing = JSON.parse(localStorage.getItem("fsl_dataset") || "{}");
          existing[currentLetter] = [
            ...(existing[currentLetter] || []),
            ...samples,
          ];
          localStorage.setItem("fsl_dataset", JSON.stringify(existing));

          setStatus(`✅ Done! ${needed} samples na-save para sa "${currentLetter}"`);

          const idx = LETTERS.indexOf(currentLetter);
          if (idx < LETTERS.length - 1) {
            setCurrentLetter(LETTERS[idx + 1]);
          }
        }
      }, 100);
    }, 3000);
  }, [currentLetter, handDetected]);

  const exportDataset = () => {
    const data = localStorage.getItem("fsl_dataset");
    if (!data) { alert("Walang data pa!"); return; }
    const blob = new Blob([data], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = "fsl_dataset.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearData = () => {
    if (window.confirm("I-clear ang lahat ng data?")) {
      localStorage.removeItem("fsl_dataset");
      localStorage.removeItem("fsl_progress");
      setProgress({});
      setStatus("Data cleared.");
    }
  };

  const totalSamples = Object.values(progress).reduce((a, b) => a + b, 0);
  const completedLetters = Object.keys(progress).filter(
    k => (progress[k] || 0) >= SAMPLES_NEEDED
  ).length;

  return (
    <div className="collector-wrap">
      <div className="collector-header">
        <h2>📸 FSL Data Collector</h2>
        <div className="collector-stats">
          <span>{completedLetters}/26 letters</span>
          <span>{totalSamples} samples</span>
        </div>
      </div>

      <div className="collector-grid">
        {/* Camera */}
        <div className="col-left">
          <div className="camera-wrap">
            <video ref={videoRef} className="video-hidden" playsInline muted />
            <canvas ref={canvasRef} className="canvas" />
            {countdown > 0 && (
              <div className="countdown">{countdown}</div>
            )}
            <div className={`hand-indicator ${handDetected ? "detected" : ""}`}>
              {handDetected ? "✋ Hand detected" : "🤚 Show your hand"}
            </div>
          </div>

          <div className="status-bar">{status}</div>

          <div className="controls">
            <button
              className="btn-collect"
              onClick={collectSamples}
              disabled={!isReady || isCollecting}
            >
              {isCollecting ? "Collecting..." : `📸 Collect "${currentLetter}"`}
            </button>
            <button className="btn-export" onClick={exportDataset}>
              💾 Export Dataset
            </button>
            <button className="btn-clear" onClick={clearData}>
              🗑️ Clear
            </button>
          </div>
        </div>

        {/* Letter Grid */}
        <div className="col-right">
          <div className="letter-select">
            <div className="ls-label">Piliin ang letra:</div>
            <div className="letter-grid">
              {LETTERS.map(l => {
                const count = progress[l] || 0;
                const done  = count >= SAMPLES_NEEDED;
                const active = l === currentLetter;
                return (
                  <button
                    key={l}
                    className={`letter-btn ${active ? "active" : ""} ${done ? "done" : ""}`}
                    onClick={() => setCurrentLetter(l)}
                    disabled={isCollecting}
                  >
                    <span className="lb-letter">{l}</span>
                    <span className="lb-count">{count}/{SAMPLES_NEEDED}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="progress-section">
            <div className="prog-label">Overall Progress</div>
            <div className="prog-bar">
              <div
                className="prog-fill"
                style={{ width: `${(completedLetters / 26) * 100}%` }}
              />
            </div>
            <div className="prog-text">{completedLetters}/26 letters completed</div>
          </div>
        </div>
      </div>
    </div>
  );
}