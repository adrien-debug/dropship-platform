export default function Footer() {
  return (
    <footer style={styles.footer}>
      <div style={styles.inner}>
        <div style={styles.brand}>
          <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
            <path d="M14 2L26 8.5V19.5L14 26L2 19.5V8.5L14 2Z" stroke="#010101" strokeWidth="2" fill="none" />
            <path d="M14 2L26 8.5L14 15L2 8.5L14 2Z" fill="#010101" />
          </svg>
          <span style={styles.wordmark}>HEARST</span>
        </div>
        <div style={styles.bottom}>
          <span style={styles.copy}>© 2025 Hearst Corp. All rights reserved.</span>
          <div style={styles.links}>
            <a href="#" style={styles.link}>Legal</a>
            <a href="#" style={styles.link}>Privacy</a>
            <a href="#" style={styles.link}>Twitter</a>
            <a href="#" style={styles.link}>LinkedIn</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

const styles: Record<string, React.CSSProperties> = {
  footer: {
    backgroundColor: '#ffffff',
    padding: '64px 32px 40px',
    borderTop: '1px solid rgba(1,1,1,0.08)',
  },
  inner: {
    maxWidth: '1280px',
    margin: '0 auto',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '48px',
  },
  wordmark: {
    fontFamily: 'var(--font-display)',
    fontSize: '18px',
    fontWeight: 800,
    letterSpacing: '0.12em',
    color: '#010101',
  },
  bottom: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
    paddingTop: '32px',
    borderTop: '1px solid rgba(1,1,1,0.08)',
  },
  copy: {
    fontSize: '13px',
    color: '#495c67',
  },
  links: {
    display: 'flex',
    gap: '24px',
  },
  link: {
    fontSize: '13px',
    color: '#495c67',
  },
};
