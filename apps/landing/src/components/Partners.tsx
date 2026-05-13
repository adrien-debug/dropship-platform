const PARTNERS = [
  {
    name: 'Pomegranate',
    logo: (
      <svg viewBox="0 0 200 90" style={{ width: '100%', height: '100%' }}>
        <g transform="translate(100, 20)">
          <path d="M-2 -2 Q-2 -6 0 -10 Q2 -6 2 -2 Z" fill="#fff" />
          <path d="M-10 4 Q-12 14 -6 22 Q0 18 0 8 Q0 18 6 22 Q12 14 10 4 Q5 8 0 6 Q-5 8 -10 4 Z" fill="#fff" />
        </g>
        <text
          x="100"
          y="62"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontStyle="italic"
          fontSize="20"
          fontWeight="400"
          fill="#fff"
          textAnchor="middle"
        >
          Pome
        </text>
        <text
          x="100"
          y="82"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontStyle="italic"
          fontSize="20"
          fontWeight="400"
          fill="#fff"
          textAnchor="middle"
        >
          granate
        </text>
      </svg>
    ),
  },
  {
    name: 'Velo.City',
    logo: (
      <svg viewBox="0 0 220 80" style={{ width: '100%', height: '100%' }}>
        <g transform="translate(50, 40)">
          <rect x="-18" y="-18" width="36" height="36" rx="6" fill="none" stroke="#fff" strokeWidth="2.5" />
          <circle cx="0" cy="0" r="6" fill="#fff" />
          <circle cx="14" cy="-14" r="2" fill="#fff" />
        </g>
        <text
          x="135"
          y="38"
          fontFamily="Manrope, sans-serif"
          fontSize="24"
          fontWeight="800"
          fill="#fff"
          letterSpacing="-0.02em"
        >
          VELO.
        </text>
        <text
          x="135"
          y="66"
          fontFamily="Manrope, sans-serif"
          fontSize="24"
          fontWeight="800"
          fill="#fff"
          letterSpacing="-0.02em"
        >
          CITY
        </text>
      </svg>
    ),
  },
  {
    name: 'Mikron',
    logo: (
      <svg viewBox="0 0 220 80" style={{ width: '100%', height: '100%' }}>
        <text
          x="20"
          y="52"
          fontFamily="Manrope, sans-serif"
          fontSize="32"
          fontWeight="800"
          fill="#fff"
          letterSpacing="0.02em"
        >
          MIKR
        </text>
        <g transform="translate(123, 38)">
          <circle cx="0" cy="0" r="8" fill="#fff" />
          <circle cx="0" cy="14" r="2" fill="#fff" />
        </g>
        <text
          x="142"
          y="52"
          fontFamily="Manrope, sans-serif"
          fontSize="32"
          fontWeight="800"
          fill="#fff"
          letterSpacing="0.02em"
        >
          N
        </text>
      </svg>
    ),
  },
];

export default function Partners() {
  return (
    <section id="partners" style={styles.section}>
      <div style={styles.inner}>
        <h2 className="display-section" style={styles.heading}>
          Partners
        </h2>

        <div style={styles.logos}>
          {PARTNERS.map((p) => (
            <div key={p.name} style={styles.logoCard}>
              <div style={styles.logoInner}>{p.logo}</div>
            </div>
          ))}
        </div>

        <div style={styles.quoteCard}>
          <svg
            style={styles.quoteSvg}
            viewBox="0 0 1200 600"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <defs>
              <radialGradient id="bgGlow" cx="68%" cy="42%" r="55%">
                <stop offset="0%" stopColor="#a8c3d7" stopOpacity="0.55" />
                <stop offset="35%" stopColor="#456578" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#0d1820" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="bgBase" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#1a2a36" />
                <stop offset="100%" stopColor="#0f1c26" />
              </linearGradient>
              <filter id="warp">
                <feTurbulence type="fractalNoise" baseFrequency="0.012 0.025" numOctaves="3" seed="7" />
                <feDisplacementMap in="SourceGraphic" scale="140" />
              </filter>
              <filter id="glassBlur">
                <feGaussianBlur stdDeviation="14" />
              </filter>
            </defs>
            <rect width="1200" height="600" fill="url(#bgBase)" />
            <g filter="url(#warp)" opacity="0.55">
              {Array.from({ length: 12 }).map((_, i) => (
                <ellipse
                  key={i}
                  cx={600 + Math.cos(i * 0.7) * 250}
                  cy={300 + Math.sin(i * 1.1) * 180}
                  rx={250 + i * 12}
                  ry={120}
                  fill={i % 2 === 0 ? '#5a8aa8' : '#2a4356'}
                  opacity="0.5"
                />
              ))}
            </g>
            <g filter="url(#glassBlur)" opacity="0.9">
              <ellipse cx="800" cy="280" rx="380" ry="180" fill="#86a6bc" opacity="0.25" />
              <ellipse cx="900" cy="380" rx="300" ry="220" fill="#3a5468" opacity="0.4" />
            </g>
            <rect width="1200" height="600" fill="url(#bgGlow)" />
          </svg>
          <div style={styles.quoteContent}>
            <p style={styles.quote}>
              Hearst replaced our entire Shopify stack. We went from three storefronts in nine months
              to thirty-two in twelve weeks — same headcount, smaller cloud bill, better margins.
            </p>
            <div style={styles.quoteFooter}>
              <span style={styles.author}>RICHARD HEIMAN</span>
              <span style={styles.role}>CEO AT MIKRON</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: {
    padding: '120px 32px',
    backgroundColor: '#d8dde1',
  },
  inner: {
    maxWidth: '1280px',
    margin: '0 auto',
  },
  heading: {
    color: '#010101',
    marginBottom: '80px',
  },
  logos: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    marginBottom: '16px',
  },
  logoCard: {
    aspectRatio: '2.4',
    backgroundColor: '#5a6b75',
    borderRadius: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
  },
  logoInner: {
    width: '70%',
    maxWidth: '260px',
    height: '70%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteCard: {
    position: 'relative',
    borderRadius: '32px',
    overflow: 'hidden',
    minHeight: '520px',
    backgroundColor: '#2a3d4a',
  },
  quoteSvg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
  },
  quoteContent: {
    position: 'relative',
    padding: '64px',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: '520px',
    justifyContent: 'space-between',
  },
  quote: {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(28px, 3.5vw, 48px)',
    fontWeight: 600,
    lineHeight: 1.15,
    letterSpacing: '-0.02em',
    color: '#ffffff',
    maxWidth: '820px',
  },
  quoteFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: '48px',
  },
  author: {
    fontFamily: 'var(--font-display)',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.14em',
    color: '#ffffff',
  },
  role: {
    fontFamily: 'var(--font-display)',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.14em',
    color: '#ffffff',
  },
};
