import React, { useState, useEffect } from 'react';
import { Box } from 'lucide-react';
import StepIndicator from './ui/StepIndicator';
import './Navbar.css';

export default function Navbar({ backendOnline, currentStep = 0 }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`simple-navbar ${scrolled ? 'navbar-scrolled' : ''}`}>
      <div className="navbar-container">
        {/* Brand Logo */}
        <a href="#home" className="navbar-brand">
          <div className="brand-icon">
            <Box size={18} />
          </div>
          <span className="brand-name">Geo3D <span className="brand-accent">Vision</span></span>
        </a>

        {/* Workflow Step Indicator */}
        <div className="navbar-center">
          <StepIndicator currentStep={currentStep} />
        </div>

        {/* Right Status & GitHub */}
        <div className="navbar-right">
          <div className={`status-badge ${backendOnline ? 'online' : 'standby'}`}>
            <span className="status-dot"></span>
            <span>{backendOnline ? 'System Ready' : 'Connecting'}</span>
          </div>

          <a 
            href="https://github.com/SatvikPrabhu/SIH-Project" 
            target="_blank" 
            rel="noreferrer" 
            className="github-btn"
            title="View on GitHub"
            aria-label="GitHub Repository"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path>
              <path d="M9 18c-4.51 2-5-2-7-2"></path>
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}
