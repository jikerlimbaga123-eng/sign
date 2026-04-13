import React from "react";

export default function About() {
  const features = [
    {
      icon: "🎯",
      title: "Real-time Gesture Recognition",
      desc: "Detects Filipino Sign Language hand gestures in real-time using MediaPipe Hands — a machine learning solution that identifies 21 hand landmarks per frame.",
    },
    {
      icon: "📝",
      title: "Text Translation Display",
      desc: "Recognized signs are instantly converted to text and displayed on screen, allowing seamless reading of signed letters and words.",
    },
    {
      icon: "🔊",
      title: "Voice Output Generator",
      desc: "Uses the Web Speech API to convert detected signs into spoken audio, bridging communication between deaf/mute users and hearing individuals.",
    },
    {
      icon: "📊",
      title: "Gesture Accuracy Feedback",
      desc: "Displays a real-time confidence percentage for each detected sign using a trained Random Forest classifier, helping users gauge recognition quality.",
    },
    {
      icon: "🕓",
      title: "Translation History",
      desc: "Logs all detected signs with timestamps in a scrollable session history, allowing users to review their signed letters and words.",
    },
  ];

  const tech = [
    { name: "React.js",        role: "Frontend Framework",       color: "#61dafb" },
    { name: "MediaPipe Hands", role: "Hand Landmark Detection",  color: "#00f5a0" },
    { name: "Random Forest",   role: "FSL Classification Model", color: "#f59e0b" },
    { name: "Web Speech API",  role: "Voice Output",             color: "#a78bfa" },
    { name: "TensorFlow",      role: "Model Training",           color: "#ff6b8a" },
    { name: "scikit-learn",    role: "ML Library",               color: "#00d9f5" },
  ];

  return (
    <div className="about-wrap">

      {/* Hero */}
      <div className="about-hero">
     
        <h2 className="about-title">
          Sign <span>Language</span> Detector
        </h2>
        <p className="about-subtitle">
          A real-time Sign Language recognition system that bridges
          communication between the deaf/mute community and hearing individuals
          using machine learning and computer vision.
        </p>
      </div>

      {/* Stats */}
      <div className="about-stats">
        <div className="stat-card">
          <div className="stat-number">31</div>
          <div className="stat-label">FSL Signs</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">1,550</div>
          <div className="stat-label">Training Samples</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">100%</div>
          <div className="stat-label">Model Accuracy</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">21</div>
          <div className="stat-label">Hand Landmarks</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">5</div>
          <div className="stat-label">Key Features</div>
        </div>
      </div>

      {/* Features */}
      <div className="about-section">
        <div className="about-section-title">System Features</div>
        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-content">
                <div className="feature-title">{f.title}</div>
                <div className="feature-desc">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="about-section">
        <div className="about-section-title">How It Works</div>
        <div className="steps-grid">
          {[
            { n:"01", title:"Camera Input",       desc:"Webcam captures real-time video feed of the user's hand gestures." },
            { n:"02", title:"Hand Detection",     desc:"MediaPipe Hands detects and extracts 21 3D landmarks from the hand." },
            { n:"03", title:"Feature Extraction", desc:"63 features (x, y, z per landmark) are extracted and normalized." },
            { n:"04", title:"Classification",     desc:"Random Forest model classifies the gesture into one of 31 FSL signs." },
            { n:"05", title:"Output",             desc:"Result is displayed as text, spoken aloud, and logged to history." },
          ].map((s, i) => (
            <div key={i} className="step-card">
              <div className="step-number">{s.n}</div>
              <div className="step-title">{s.title}</div>
              <div className="step-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tech Stack */}
      <div className="about-section">
        <div className="about-section-title">Technology Stack</div>
        <div className="tech-grid">
          {tech.map((t, i) => (
            <div key={i} className="tech-card">
              <div className="tech-dot" style={{ background: t.color }} />
              <div>
                <div className="tech-name">{t.name}</div>
                <div className="tech-role">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Developers */}
      <div className="about-section">
        <div className="about-section-title">Developers</div>
        <div className="dev-card">
          <div className="dev-avatar">👨‍💻</div>
          <div>
            <div className="dev-name">Jekier leben Limbaga</div>
            <div className="dev-role">Sign Language Detector Developer</div>
          </div>
        </div>
      </div>

    </div>
  );
}