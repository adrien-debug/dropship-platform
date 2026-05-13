'use client';

import { useState } from 'react';

const LINKS = [
  { label: 'Products', href: '#products' },
  { label: 'Partners', href: '#partners' },
  { label: 'Demo', href: '#demo' },
];

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header style={styles.header}>
      <div style={styles.inner}>
        <a href="/" style={styles.logo} aria-label="Hearst">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M14 2L26 8.5V19.5L14 26L2 19.5V8.5L14 2Z" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M14 2L26 8.5L14 15L2 8.5L14 2Z" fill="currentColor" />
          </svg>
          <span>HEARST</span>
        </a>

        <nav style={styles.nav}>
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} style={styles.link}>
              {l.label}
            </a>
          ))}
        </nav>

        <a href="#demo" style={styles.cta}>
          <span style={styles.ctaIcon}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7H11M11 7L7 3M11 7L7 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          REQUEST A DEMO
        </a>

        <button style={styles.burger} onClick={() => setOpen(!open)} aria-label="Menu">
          <span style={{ ...styles.burgerLine, transform: open ? 'translateY(6px) rotate(45deg)' : 'none' }} />
          <span style={{ ...styles.burgerLine, opacity: open ? 0 : 1 }} />
          <span style={{ ...styles.burgerLine, transform: open ? 'translateY(-6px) rotate(-45deg)' : 'none' }} />
        </button>
      </div>

      {open && (
        <div style={styles.mobile}>
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} style={styles.mobileLink} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <a href="#demo" style={{ ...styles.cta, marginTop: '12px' }}>
            REQUEST A DEMO
          </a>
        </div>
      )}
    </header>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(1,1,1,0.06)',
  },
  inner: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '0 32px',
    height: '80px',
    display: 'flex',
    alignItems: 'center',
    gap: '40px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontFamily: 'var(--font-display)',
    fontSize: '15px',
    fontWeight: 800,
    letterSpacing: '0.1em',
    color: '#010101',
    marginRight: 'auto',
  },
  nav: {
    display: 'flex',
    gap: '36px',
  },
  link: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#010101',
    transition: 'opacity 0.15s',
  },
  cta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 22px 14px 14px',
    backgroundColor: '#010101',
    color: '#ffffff',
    borderRadius: '9999px',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    fontFamily: 'var(--font-display)',
  },
  ctaIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    color: '#010101',
  },
  burger: {
    display: 'none',
    flexDirection: 'column',
    gap: '5px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
  },
  burgerLine: {
    display: 'block',
    width: '22px',
    height: '2px',
    backgroundColor: '#010101',
    transition: 'transform 0.2s, opacity 0.2s',
  },
  mobile: {
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 32px 32px',
    gap: '20px',
    borderTop: '1px solid rgba(1,1,1,0.06)',
    backgroundColor: '#ffffff',
  },
  mobileLink: {
    fontSize: '16px',
    fontWeight: 500,
    color: '#010101',
  },
};
