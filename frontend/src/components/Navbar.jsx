import React, { useState, useEffect } from 'react';
import { Box, Layers, Activity, Cpu, ExternalLink, Sparkles, Terminal } from 'lucide-react';
import './Navbar.css';


export default function Navbar({ backendOnline }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`navbar-header ${scrolled ? 'navbar-scrolled' : ''}`}>
      <div className="navbar-container">
        {/* Brand / Logo */}
        <a href="#home" className="navbar-brand">
          <div className="brand-icon-wrapper">
            <Box className="brand-icon" size={22} />
            <span className="brand-icon-glow"></span>
          </div>
          <div className="brand-text">
            <span className="brand-title">Geo3D<span className="brand-accent">Vision</span></span>
            <span className="brand-tag">AI 3D TWIN</span>
          </div>
        </a>

        {/* Navigation Links */}
        <nav className="navbar-nav">
          <a href="#home" className="nav-link active">Home</a>
          <a href="#pipeline" className="nav-link">Pipeline</a>
          <a href="#features" className="nav-link">Features</a>
          <a href="#tech" className="nav-link">Tech Stack</a>
          <a href="#docs" className="nav-link">Docs</a>
        </nav>

        {/* Right Actions & Status */}
        <div className="navbar-actions">
          {/* Live Backend Connection Indicator */}
          <div className={`status-pill ${backendOnline ? 'online' : 'standby'}`} title={backendOnline ? "FastAPI Backend is Online (Port 8000)" : "Backend in Standby / Offline"}>
            <span className="status-dot"></span>
            <span className="status-text">{backendOnline ? 'Backend Online' : 'FastAPI :8000'}</span>
          </div>

          <a 
            href="https://github.com/SatvikPrabhu/SIH-Project" 
            target="_blank" 
            rel="noreferrer" 
            className="navbar-icon-btn"
            title="View Source on GitHub (SatvikPrabhu/SIH-Project)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path>
              <path d="M9 18c-4.51 2-5-2-7-2"></path>
            </svg>
          </a>

          <a href="#upload-section" className="navbar-cta-btn">
            <Sparkles size={15} />
            <span>Launch Pipeline</span>
          </a>
        </div>
      </div>
    </header>
  );
}
