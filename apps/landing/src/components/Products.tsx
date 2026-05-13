function pointInPolygon(x: number, y: number, poly: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function distanceToEdge(x: number, y: number, poly: Array<[number, number]>): number {
  let min = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[j];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
    const px = x1 + t * dx;
    const py = y1 + t * dy;
    const d = Math.hypot(x - px, y - py);
    if (d < min) min = d;
  }
  return min;
}

const STEP = 11;

function HalftoneShape({ poly, inverted }: { poly: Array<[number, number]>; inverted: boolean }) {
  const fg = inverted ? '#ffffff' : '#010101';
  const dots: Array<[number, number, number]> = [];
  for (let y = 10; y < 290; y += STEP) {
    for (let x = 10; x < 310; x += STEP) {
      if (pointInPolygon(x, y, poly)) {
        const edgeDist = distanceToEdge(x, y, poly);
        const r = Math.min(4.2, Math.max(1.4, edgeDist / 5 + 1.4));
        dots.push([x, y, r]);
      }
    }
  }
  return (
    <svg viewBox="0 0 320 300" style={{ width: '100%', height: '100%' }}>
      {dots.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={fg} />
      ))}
    </svg>
  );
}

const ARROW_POLY: Array<[number, number]> = [
  [70, 150],
  [200, 60],
  [200, 110],
  [260, 110],
  [260, 190],
  [200, 190],
  [200, 240],
];

const BOLT_POLY: Array<[number, number]> = [
  [165, 30],
  [225, 30],
  [195, 130],
  [245, 130],
  [135, 270],
  [165, 175],
  [115, 175],
];

const ORB_POLY: Array<[number, number]> = (() => {
  const pts: Array<[number, number]> = [];
  const cx = 160, cy = 150, r = 110;
  const steps = 48;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
})();

function HalftoneArrow({ inverted = false }: { inverted?: boolean }) {
  return <HalftoneShape poly={ARROW_POLY} inverted={inverted} />;
}

function HalftoneBolt({ inverted = false }: { inverted?: boolean }) {
  return <HalftoneShape poly={BOLT_POLY} inverted={inverted} />;
}

function HalftoneOrb({ inverted = false }: { inverted?: boolean }) {
  return <HalftoneShape poly={ORB_POLY} inverted={inverted} />;
}

const CARDS = [
  {
    label: 'Fast & Agile',
    body: 'A new store goes from keyword to live storefront in under 60 seconds.',
    visual: 'arrow' as const,
    dark: false,
  },
  {
    label: 'Cost-Effective',
    body: 'No theme purchases, no plugin sprawl, no agency retainers. One subscription.',
    visual: 'bolt' as const,
    dark: false,
  },
  {
    label: 'Real-Time Analytics',
    body: 'Live performance, sourcing, and conversion data — surfaced by the copilot.',
    visual: 'orb' as const,
    dark: true,
  },
];

export default function Products() {
  return (
    <section id="products" style={styles.section}>
      <div style={styles.inner}>
        <div style={styles.tag}>Products</div>
        <h2 className="display-section" style={styles.heading}>
          Data you can
          <br />
          trust.
        </h2>

        <div style={styles.grid}>
          {CARDS.map((c) => (
            <article
              key={c.label}
              style={{
                ...styles.card,
                ...(c.dark ? styles.cardDark : {}),
              }}
            >
              <div style={styles.cardLabel}>{c.label.toUpperCase()}</div>
              <div style={styles.cardVisual}>
                {c.visual === 'arrow' && <HalftoneArrow inverted={c.dark} />}
                {c.visual === 'bolt' && <HalftoneBolt inverted={c.dark} />}
                {c.visual === 'orb' && <HalftoneOrb inverted={c.dark} />}
              </div>
              <p style={{ ...styles.cardBody, ...(c.dark ? { color: '#b8bcbe' } : {}) }}>{c.body}</p>
            </article>
          ))}
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
  tag: {
    display: 'inline-block',
    padding: '4px 12px',
    backgroundColor: '#4a6cf7',
    color: '#ffffff',
    borderRadius: '6px',
    fontFamily: 'var(--font-body)',
    fontSize: '12px',
    fontWeight: 500,
    marginBottom: '32px',
  },
  heading: {
    color: '#010101',
    marginBottom: '80px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    aspectRatio: '0.78',
    padding: '32px',
    borderRadius: '32px',
    backgroundColor: '#ffffff',
    border: '1px solid rgba(1,1,1,0.06)',
  },
  cardDark: {
    backgroundColor: '#010101',
    border: 'none',
  },
  cardLabel: {
    fontFamily: 'var(--font-display)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.14em',
    color: 'inherit',
  },
  cardVisual: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '24px 0',
  },
  cardBody: {
    fontSize: '14px',
    lineHeight: 1.5,
    color: '#495c67',
  },
};
