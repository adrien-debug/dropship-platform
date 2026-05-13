function HeroVisual() {
  return (
    <div style={visual.frame}>
      <svg viewBox="0 0 520 600" style={visual.svg}>
        <defs>
          <radialGradient id="heroGlow" cx="55%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#a8c3d7" stopOpacity="0.7" />
            <stop offset="55%" stopColor="#3a5468" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0d1820" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="heroBase" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#1a2a36" />
            <stop offset="100%" stopColor="#0a1118" />
          </linearGradient>
          <filter id="heroWarp">
            <feTurbulence type="fractalNoise" baseFrequency="0.015 0.022" numOctaves="3" seed="3" />
            <feDisplacementMap in="SourceGraphic" scale="120" />
          </filter>
          <filter id="heroBlur">
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </defs>
        <rect width="520" height="600" fill="url(#heroBase)" />
        <g filter="url(#heroWarp)" opacity="0.6">
          {Array.from({ length: 10 }).map((_, i) => (
            <ellipse
              key={i}
              cx={260 + Math.cos(i * 0.8) * 140}
              cy={300 + Math.sin(i * 1.2) * 160}
              rx={140 + i * 10}
              ry={90}
              fill={i % 2 === 0 ? '#6a8aa8' : '#2a4356'}
              opacity="0.55"
            />
          ))}
        </g>
        <g filter="url(#heroBlur)" opacity="0.9">
          <ellipse cx="320" cy="240" rx="180" ry="110" fill="#9ab8cc" opacity="0.3" />
          <ellipse cx="280" cy="380" rx="150" ry="160" fill="#3a5468" opacity="0.45" />
        </g>
        <rect width="520" height="600" fill="url(#heroGlow)" />
      </svg>

      <div style={visual.chipTop}>
        <span style={visual.chipDot} />
        <span>STORE LIVE</span>
      </div>

      <div style={visual.statCard}>
        <span style={visual.statLabel}>Generated in</span>
        <span style={visual.statValue}>54s</span>
      </div>

      <div style={visual.miniChart}>
        <div style={visual.miniHeader}>
          <span style={visual.miniTitle}>Revenue</span>
          <span style={visual.miniBadge}>+38%</span>
        </div>
        <svg viewBox="0 0 200 50" style={{ width: '100%', height: '50px' }}>
          <defs>
            <linearGradient id="miniGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,42 C25,38 45,40 70,28 C95,16 120,22 145,14 C170,8 190,12 200,8 L200,50 L0,50 Z"
            fill="url(#miniGrad)"
          />
          <path
            d="M0,42 C25,38 45,40 70,28 C95,16 120,22 145,14 C170,8 190,12 200,8"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        </svg>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section style={styles.section}>
      <div style={styles.inner}>
        <div style={styles.left}>
          <div style={styles.tag}>
            <span style={styles.tagDot} />
            <span>AI DROPSHIPPING AGENT</span>
          </div>
          <h1 className="display-hero" style={styles.headline}>
            Launch a store.
            <br />
            <span style={styles.muted}>Skip the build.</span>
          </h1>
          <p style={styles.lede}>
            Hearst is the autonomous agent that creates and operates dropshipping stores from a single
            niche keyword. Products, copy, domain, fulfillment — all handled.
          </p>
          <div style={styles.ctaRow}>
            <a href="#demo" style={styles.ctaPrimary}>
              <span style={styles.ctaIcon}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M3 7H11M11 7L7 3M11 7L7 11"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              REQUEST A DEMO
            </a>
            <a href="#products" style={styles.ctaSecondary}>How it works</a>
          </div>
          <div style={styles.proof}>
            <span style={styles.proofText}>Trusted by</span>
            <div style={styles.proofRow}>
              <span style={styles.proofItem}>POMEGRANATE</span>
              <span style={styles.proofItem}>VELO.CITY</span>
              <span style={styles.proofItem}>MIKRON</span>
            </div>
          </div>
        </div>

        <div style={styles.right}>
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: {
    paddingTop: '140px',
    paddingBottom: '120px',
    backgroundColor: '#ffffff',
  },
  inner: {
    maxWidth: '1440px',
    margin: '0 auto',
    padding: '0 32px',
    display: 'grid',
    gridTemplateColumns: '1.1fr 1fr',
    gap: '64px',
    alignItems: 'center',
  },
  left: {
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    alignSelf: 'flex-start',
    padding: '6px 14px',
    backgroundColor: '#010101',
    color: '#ffffff',
    borderRadius: '9999px',
    fontFamily: 'var(--font-display)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.14em',
  },
  tagDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#7adf94',
  },
  headline: {
    color: '#010101',
    margin: 0,
  },
  muted: {
    color: '#9aa3a8',
  },
  lede: {
    fontSize: '18px',
    lineHeight: 1.55,
    color: '#495c67',
    maxWidth: '540px',
    margin: 0,
  },
  ctaRow: {
    display: 'flex',
    gap: '24px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  ctaPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 26px 16px 16px',
    backgroundColor: '#010101',
    color: '#ffffff',
    borderRadius: '9999px',
    fontFamily: 'var(--font-display)',
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '0.14em',
  },
  ctaIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    color: '#010101',
  },
  ctaSecondary: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#010101',
    textDecoration: 'underline',
    textUnderlineOffset: '4px',
  },
  proof: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '16px',
  },
  proofText: {
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#9aa3a8',
  },
  proofRow: {
    display: 'flex',
    gap: '32px',
    flexWrap: 'wrap',
  },
  proofItem: {
    fontFamily: 'var(--font-display)',
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: '#495c67',
  },
  right: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
};

const visual: Record<string, React.CSSProperties> = {
  frame: {
    position: 'relative',
    width: '100%',
    maxWidth: '520px',
    aspectRatio: '0.87',
    borderRadius: '32px',
    overflow: 'hidden',
    backgroundColor: '#0d1820',
  },
  svg: {
    width: '100%',
    height: '100%',
    display: 'block',
  },
  chipTop: {
    position: 'absolute',
    top: '24px',
    left: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    backgroundColor: 'rgba(255,255,255,0.12)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '9999px',
    color: '#ffffff',
    fontFamily: 'var(--font-display)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.14em',
  },
  chipDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#7adf94',
    boxShadow: '0 0 8px #7adf94',
  },
  statCard: {
    position: 'absolute',
    top: '24px',
    right: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '14px 18px',
    backgroundColor: 'rgba(255,255,255,0.1)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: '16px',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.7)',
  },
  statValue: {
    fontFamily: 'var(--font-display)',
    fontSize: '28px',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  miniChart: {
    position: 'absolute',
    bottom: '24px',
    left: '24px',
    right: '24px',
    padding: '16px 18px',
    backgroundColor: 'rgba(255,255,255,0.1)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  miniHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#ffffff',
  },
  miniBadge: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#7adf94',
    backgroundColor: 'rgba(122, 223, 148, 0.15)',
    padding: '3px 8px',
    borderRadius: '999px',
  },
};
