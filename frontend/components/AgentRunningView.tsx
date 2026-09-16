"use client";

import React, { useEffect, useState } from "react";

interface AgentRunningViewProps {
  type: "domain" | "mcts";
  agentName: string;
  steps: string[];
  durationMs?: number;
  onComplete?: () => void;
}

export function AgentRunningView({
  type,
  agentName,
  steps,
  durationMs = 5200,
  onComplete,
}: AgentRunningViewProps) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [progress, setProgress] = useState(8);
  const [eyeState, setEyeState] = useState<"happy" | "scan" | "blink">("happy");

  // Step progression & eye state alternation
  useEffect(() => {
    const stepDuration = durationMs / steps.length;
    const stepInterval = setInterval(() => {
      setCurrentStepIdx((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, stepDuration);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 98) return prev;
        const remaining = 100 - prev;
        return prev + Math.max(0.8, remaining * 0.04 + (Math.random() * 2));
      });
    }, 100);

    // Eye blinking and scanning jitter cycle
    const eyeInterval = setInterval(() => {
      setEyeState((prev) => {
        if (prev === "happy") return Math.random() > 0.4 ? "scan" : "blink";
        if (prev === "scan") return "happy";
        return "happy";
      });
    }, 1400);

    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, durationMs);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
      clearInterval(eyeInterval);
      clearTimeout(timer);
    };
  }, [durationMs, steps.length, onComplete]);

  const isMcts = type === "mcts";
  const primaryColor = isMcts ? "#818cf8" : "#2dd4bf";
  const glowColor = isMcts ? "rgba(129, 140, 248, 0.45)" : "rgba(45, 212, 191, 0.45)";

  return (
    <div className={`agent-screen-runner ${isMcts ? "agent-screen-runner--mcts" : ""}`}>
      {/* Background cyber grid & scanlines — seamlessly blends with tile */}
      <div className="agent-screen-runner__grid-overlay" />

      {/* Cyber Robot Head Illustration matching the user's reference */}
      <div className="agent-screen-runner__bot-box">
        {/* Antenna signal transmission waves */}
        <div className="agent-screen-runner__ping-ring agent-screen-runner__ping-ring--1" style={{ borderColor: primaryColor }} />
        <div className="agent-screen-runner__ping-ring agent-screen-runner__ping-ring--2" style={{ borderColor: primaryColor }} />

        <svg
          className="agent-screen-runner__svg"
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id={`botGlow-${type}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={glowColor} />
            </filter>
            <linearGradient id={`visorGlow-${type}`} x1="20" y1="50" x2="100" y2="80" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={isMcts ? "#6366f1" : "#0284c7"} />
              <stop offset="100%" stopColor={isMcts ? "#a855f7" : "#14b8a6"} />
            </linearGradient>
          </defs>

          {/* Antenna stem & glowing orb */}
          <line x1="60" y1="28" x2="60" y2="12" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
          <circle
            cx="60"
            cy="11"
            r="5"
            fill={primaryColor}
            className="agent-screen-runner__antenna-orb"
            filter={`url(#botGlow-${type})`}
          />

          {/* Left Ear Lug */}
          <rect
            x="14"
            y="54"
            width="10"
            height="20"
            rx="4"
            fill="#0c1322"
            stroke={primaryColor}
            strokeWidth="2.5"
          />
          {/* Right Ear Lug */}
          <rect
            x="96"
            y="54"
            width="10"
            height="20"
            rx="4"
            fill="#0c1322"
            stroke={primaryColor}
            strokeWidth="2.5"
          />

          {/* Main Head Shell (Dome + Rounded Base) */}
          <path
            d="M 22 66 C 22 36, 38 28, 60 28 C 82 28, 98 36, 98 66 C 98 84, 90 92, 60 92 C 30 92, 22 84, 22 66 Z"
            fill="#0c1322"
            stroke="#e2e8f0"
            strokeWidth="3.2"
            strokeLinejoin="round"
            className="agent-screen-runner__head-stroke"
          />

          {/* Forehead Panel Seam (Cutout curve on forehead) */}
          <path
            d="M 40 33 C 48 46, 72 46, 80 33"
            stroke="#94a3b8"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />

          {/* Digital Screen Visor */}
          <rect
            x="32"
            y="52"
            width="56"
            height="26"
            rx="7"
            fill={`url(#visorGlow-${type})`}
            fillOpacity="0.85"
            stroke={primaryColor}
            strokeWidth="1.8"
            className="agent-screen-runner__visor-screen"
          />

          {/* CRT / Hologram Scanlines inside Visor */}
          <g opacity="0.25" className="agent-screen-runner__scanlines">
            <line x1="34" y1="56" x2="86" y2="56" stroke="#ffffff" strokeWidth="1" />
            <line x1="34" y1="60" x2="86" y2="60" stroke="#ffffff" strokeWidth="1" />
            <line x1="34" y1="64" x2="86" y2="64" stroke="#ffffff" strokeWidth="1" />
            <line x1="34" y1="68" x2="86" y2="68" stroke="#ffffff" strokeWidth="1" />
            <line x1="34" y1="72" x2="86" y2="72" stroke="#ffffff" strokeWidth="1" />
          </g>

          {/* Visor Eyes with Cyber Flicker */}
          <g className="agent-screen-runner__eyes">
            {eyeState === "happy" && (
              <>
                {/* Left Happy Curved Eye (^ shape) */}
                <path
                  d="M 42 67 C 43 59, 49 59, 50 67"
                  stroke="#ffffff"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  fill="none"
                />
                {/* Right Happy Curved Eye (^ shape) */}
                <path
                  d="M 70 67 C 71 59, 77 59, 78 67"
                  stroke="#ffffff"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  fill="none"
                />
              </>
            )}

            {eyeState === "scan" && (
              <>
                {/* Scanning Dash Eyes */}
                <line x1="41" y1="65" x2="51" y2="65" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
                <line x1="69" y1="65" x2="79" y2="65" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
              </>
            )}

            {eyeState === "blink" && (
              <>
                {/* Blink Slit Eyes */}
                <line x1="42" y1="66" x2="50" y2="66" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" opacity="0.6" />
                <line x1="70" y1="66" x2="78" y2="66" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" opacity="0.6" />
              </>
            )}
          </g>
        </svg>
      </div>

      {/* Cybernetic terminal telemetry */}
      <div className="agent-screen-runner__telemetry">
        <div className="agent-screen-runner__header-row">
          <div className="agent-screen-runner__tag">
            <span className="agent-screen-runner__flicker-dot" style={{ background: primaryColor, boxShadow: `0 0 8px ${primaryColor}` }} />
            <span style={{ color: primaryColor }}>{agentName}</span>
          </div>
          <span className="agent-screen-runner__percentage">{Math.min(100, Math.round(progress))}%</span>
        </div>

        {/* Live Step Message with flickering terminal indicator */}
        <div className="agent-screen-runner__console">
          <span className="agent-screen-runner__prompt">&gt;</span>
          <p className="agent-screen-runner__msg">
            {steps[currentStepIdx]}
            <span className="agent-screen-runner__cursor" style={{ background: primaryColor }} />
          </p>
        </div>

        {/* Animated Progress Laser Bar */}
        <div className="agent-screen-runner__track">
          <div
            className="agent-screen-runner__bar"
            style={{
              width: `${Math.min(100, Math.max(6, progress))}%`,
              background: isMcts
                ? "linear-gradient(90deg, #6366f1, #c084fc)"
                : "linear-gradient(90deg, #0d9488, #2dd4bf)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
