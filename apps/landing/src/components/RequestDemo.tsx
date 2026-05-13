'use client';

import { useState } from 'react';

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
};

const FIELDS: Array<{ key: keyof FormState; label: string; required?: boolean; type?: string }> = [
  { key: 'firstName', label: 'First name', required: true },
  { key: 'lastName', label: 'Last name', required: true },
  { key: 'email', label: 'Email', required: true, type: 'email' },
  { key: 'phone', label: 'Phone' },
  { key: 'company', label: 'Company name' },
];

export default function RequestDemo() {
  const [form, setForm] = useState<FormState>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
  });
  const [submitted, setSubmitted] = useState(false);

  return (
    <section id="demo" style={styles.section}>
      <div style={styles.inner}>
        <div style={styles.left}>
          <h2 className="display-section" style={styles.heading}>
            Request
            <br />
            a demo
          </h2>
          <p style={styles.sub}>Schedule a demo with one of our product consultants.</p>
        </div>

        <form
          style={styles.right}
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
        >
          {FIELDS.map((f) => (
            <label key={f.key} style={styles.field}>
              <span style={styles.label}>
                {f.label}
                {f.required && <span style={styles.req}> *</span>}
              </span>
              {f.key === 'phone' ? (
                <div style={styles.phoneRow}>
                  <button type="button" style={styles.flagBtn}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" stroke="#495c67" strokeWidth="1.2" />
                      <path d="M1 8h14M8 1c2 2 3 4 3 7s-1 5-3 7c-2-2-3-4-3-7s1-5 3-7Z" stroke="#495c67" strokeWidth="1.2" fill="none" />
                    </svg>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 4l3 3 3-3" stroke="#495c67" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    style={{ ...styles.input, flex: 1 }}
                  />
                </div>
              ) : (
                <input
                  type={f.type ?? 'text'}
                  required={f.required}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  style={styles.input}
                />
              )}
            </label>
          ))}

          <button type="submit" style={styles.submit}>
            {submitted ? 'THANK YOU' : 'SUBMIT'}
          </button>
        </form>
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: {
    padding: '120px 32px',
    backgroundColor: '#ffffff',
  },
  inner: {
    maxWidth: '1280px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '80px',
    alignItems: 'start',
  },
  left: {
    paddingTop: '8px',
  },
  heading: {
    color: '#010101',
    marginBottom: '24px',
  },
  sub: {
    fontSize: '16px',
    lineHeight: 1.5,
    color: '#010101',
    maxWidth: '320px',
  },
  right: {
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#010101',
  },
  req: {
    color: '#010101',
  },
  input: {
    border: 'none',
    borderBottom: '1px solid #b8bcbe',
    padding: '8px 0',
    fontSize: '16px',
    fontFamily: 'var(--font-body)',
    color: '#010101',
    background: 'transparent',
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  phoneRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    borderBottom: '1px solid #b8bcbe',
    paddingBottom: '8px',
  },
  flagBtn: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 0',
  },
  submit: {
    padding: '22px',
    backgroundColor: '#010101',
    color: '#ffffff',
    border: 'none',
    borderRadius: '9999px',
    fontFamily: 'var(--font-display)',
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '0.16em',
    cursor: 'pointer',
    marginTop: '8px',
  },
};
