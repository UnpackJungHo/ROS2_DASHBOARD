import { StartSimulationButton } from "@/components/start-simulation-button";

export default function HomePage() {
  return (
    <main className="landing-shell">
      {/* Top-right menu button */}
      <button type="button" className="menu-badge" aria-label="Open menu">
        <span />
        <span />
        <span />
      </button>

      {/* Center content */}
      <div className="landing-content">
        {/* Hero pill */}
        <div className="hero-pill">
          <svg
            className="car-icon"
            viewBox="0 0 32 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 14l3.5-6h13L26 14" />
            <rect x="3" y="14" width="26" height="10" rx="3" />
            <circle cx="9.5" cy="24" r="3" />
            <circle cx="22.5" cy="24" r="3" />
            <path d="M13 8.5h6" />
            <path d="M3 18h2M27 18h2" />
          </svg>
          <h1>
            Autonomous <span className="accent">Driving</span> Trainer
          </h1>
        </div>

        {/* Subtitle */}
        <p className="subtitle">
          Next-generation simulation environment for reinforcing robotic pathfinding algorithms.
        </p>

        {/* CTA */}
        <StartSimulationButton />
      </div>

      {/* Bottom footer bar */}
      <footer className="footer-bar">
        {/* Left: system status */}
        <div className="footer-status">
          <span className="status-dot" />
          <span>System Status: <strong>Online</strong></span>
        </div>

        {/* Center: version / engine / server */}
        <div className="footer-center">
          <div className="footer-stat">
            <strong>v2.4.1</strong>
            <span>Version</span>
          </div>
          <div className="footer-stat">
            <strong>Unity 2023</strong>
            <span>Engine</span>
          </div>
          <div className="footer-stat">
            <strong>Localhost:8080</strong>
            <span>Server</span>
          </div>
        </div>

        {/* Right: latency */}
        <div className="footer-latency">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 4.5V8l2.5 1.5" />
          </svg>
          <span>Latency: <strong>12ms</strong></span>
        </div>
      </footer>
    </main>
  );
}
