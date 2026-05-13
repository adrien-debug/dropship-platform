function PhoneMockup() {
  return (
    <div style={mock.outer}>
      <div style={mock.phone}>
        <div style={mock.notch} />
        <div style={mock.screen}>
          <div style={mock.statusRow}>
            <span style={mock.time}>9:41</span>
            <div style={mock.indicators}>
              <span style={mock.signal}>•••</span>
              <span style={mock.wifi}>⌃</span>
              <span style={mock.battery} />
            </div>
          </div>
          <div style={mock.header}>
            <span style={mock.title}>Monthly Analytics</span>
            <span style={mock.dateChip}>Date Overview</span>
          </div>

          <div style={mock.card}>
            <span style={mock.cardTitle}>User Growth</span>
            <svg viewBox="0 0 220 70" style={mock.chartSvg}>
              <defs>
                <linearGradient id="grad1" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#1980a2" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#1980a2" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,55 C30,45 50,48 80,30 C110,12 140,20 170,18 C190,17 210,15 220,12 L220,70 L0,70 Z"
                fill="url(#grad1)"
              />
              <path
                d="M0,55 C30,45 50,48 80,30 C110,12 140,20 170,18 C190,17 210,15 220,12"
                fill="none"
                stroke="#1980a2"
                strokeWidth="1.5"
              />
            </svg>
          </div>

          <div style={mock.row2}>
            <div style={mock.cardSmall}>
              <span style={mock.cardTitleSm}>Active Users</span>
              <Donut value={0.72} />
            </div>
            <div style={mock.cardSmall}>
              <span style={mock.cardTitleSm}>Retention Rate</span>
              <Donut value={0.58} />
            </div>
          </div>

          <div style={mock.card}>
            <span style={mock.cardTitle}>Performance</span>
            <svg viewBox="0 0 220 50" style={mock.chartSvg}>
              <path
                d="M0,40 C25,30 45,28 70,22 C95,16 120,28 145,20 C170,12 195,18 220,15"
                fill="none"
                stroke="#1980a2"
                strokeWidth="1.5"
              />
              <path
                d="M0,40 C25,30 45,28 70,22 C95,16 120,28 145,20 C170,12 195,18 220,15 L220,50 L0,50 Z"
                fill="url(#grad1)"
              />
            </svg>
          </div>

          <div style={mock.card}>
            <span style={mock.cardTitle}>Growth Metrics</span>
            <div style={mock.barsRow}>
              {[40, 65, 50, 70, 55, 85, 75].map((h, i) => (
                <span key={i} style={{ ...mock.bar, height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Donut({ value }: { value: number }) {
  const R = 14;
  const C = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 40 40" style={{ width: '46px', height: '46px' }}>
      <circle cx="20" cy="20" r={R} fill="none" stroke="#dde6ec" strokeWidth="4" />
      <circle
        cx="20"
        cy="20"
        r={R}
        fill="none"
        stroke="#1980a2"
        strokeWidth="4"
        strokeDasharray={`${value * C} ${C}`}
        strokeDashoffset={C / 4}
        strokeLinecap="round"
        transform="rotate(-90 20 20)"
      />
    </svg>
  );
}

export default function UnderstandUsers() {
  return (
    <section style={styles.section}>
      <div style={styles.inner}>
        <div style={styles.left}>
          <h2 className="display-section-tc" style={styles.heading}>
            Understand
            <br />
            your store
            <br />
            better.
          </h2>
        </div>
        <div style={styles.center}>
          <PhoneMockup />
        </div>
        <div style={styles.right}>
          <p style={styles.body}>
            Hearst tracks every signal that matters — traffic, sourcing latency, conversion, basket
            value — and surfaces what to scale, what to cut, and what to fix in plain language.
          </p>
          <a href="#demo" style={styles.cta}>
            <span style={styles.ctaIcon}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7H11M11 7L7 3M11 7L7 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            GET A DEMO
          </a>
        </div>
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: {
    padding: '120px 32px',
    backgroundColor: '#c8ced3',
  },
  inner: {
    maxWidth: '1440px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '1fr 1.1fr 1fr',
    alignItems: 'center',
    gap: '32px',
  },
  left: {},
  center: {
    display: 'flex',
    justifyContent: 'center',
  },
  right: {
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
  },
  heading: {
    color: '#010101',
  },
  body: {
    fontSize: '16px',
    lineHeight: 1.6,
    color: '#010101',
    maxWidth: '320px',
  },
  cta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 24px 14px 14px',
    backgroundColor: '#ffffff',
    border: '1.5px solid #010101',
    color: '#010101',
    borderRadius: '9999px',
    fontFamily: 'var(--font-display)',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.14em',
    alignSelf: 'flex-start',
  },
  ctaIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: '#010101',
    color: '#ffffff',
  },
};

const mock: Record<string, React.CSSProperties> = {
  outer: {
    filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.18))',
  },
  phone: {
    position: 'relative',
    width: '300px',
    height: '610px',
    backgroundColor: '#1a1a1a',
    borderRadius: '46px',
    padding: '12px',
    boxShadow: 'inset 0 0 0 2px #2a2a2a',
  },
  notch: {
    position: 'absolute',
    top: '14px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '90px',
    height: '24px',
    backgroundColor: '#000',
    borderRadius: '12px',
    zIndex: 2,
  },
  screen: {
    position: 'relative',
    width: '100%',
    height: '100%',
    backgroundColor: '#e8edf1',
    borderRadius: '36px',
    padding: '38px 14px 14px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 8px 4px',
  },
  time: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#010101',
  },
  indicators: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
  },
  signal: {
    fontSize: '11px',
    color: '#010101',
  },
  barsRow: {
    display: 'flex',
    gap: '4px',
    height: '60px',
    alignItems: 'flex-end',
  },
  wifi: {
    fontSize: '11px',
    color: '#010101',
  },
  battery: {
    width: '18px',
    height: '8px',
    backgroundColor: '#010101',
    borderRadius: '2px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 8px',
  },
  title: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#010101',
  },
  dateChip: {
    fontSize: '9px',
    fontWeight: 500,
    color: '#495c67',
    backgroundColor: '#ffffff',
    padding: '4px 8px',
    borderRadius: '999px',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    backdropFilter: 'blur(6px)',
    border: '1px solid rgba(255,255,255,0.6)',
    borderRadius: '14px',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  cardTitle: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#010101',
  },
  cardSmall: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.55)',
    border: '1px solid rgba(255,255,255,0.6)',
    borderRadius: '14px',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  cardTitleSm: {
    fontSize: '9px',
    fontWeight: 700,
    color: '#010101',
  },
  row2: {
    display: 'flex',
    gap: '8px',
  },
  chartSvg: {
    width: '100%',
    height: '50px',
  },
  bar: {
    flex: 1,
    backgroundColor: '#1980a2',
    borderRadius: '2px',
    alignSelf: 'flex-end',
  },
};
