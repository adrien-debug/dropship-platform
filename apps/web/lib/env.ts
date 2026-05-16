/**
 * Fail-fast validation of required environment variables.
 * Called once per server worker via instrumentation.ts.
 */

interface EnvRule {
  name: string;
  required: boolean;
  test?: (value: string) => boolean;
  hint?: string;
}

const RULES: EnvRule[] = [
  { name: 'DATABASE_URL', required: true },
  { name: 'ADMIN_USERNAME', required: true },
  { name: 'ADMIN_PASSWORD', required: true, test: (v) => v.length >= 8, hint: 'must be >= 8 chars' },
  { name: 'ANTHROPIC_API_KEY', required: true, test: (v) => v.startsWith('sk-ant-'), hint: 'should start with sk-ant-' },
  { name: 'HYPER_API_KEY', required: true, test: (v) => v.startsWith('hyper_api_'), hint: 'should start with hyper_api_' },
  { name: 'MEDUSA_URL', required: true },
  { name: 'STORE_SECRETS_KEY', required: true, test: (v) => Buffer.from(v, 'base64').length === 32, hint: 'must be base64(32 bytes)' },
  { name: 'STRIPE_SECRET_KEY', required: true, test: (v) => v.startsWith('sk_'), hint: 'should start with sk_' },
];

export function validateEnv(): void {
  const errors: string[] = [];
  for (const rule of RULES) {
    const raw = process.env[rule.name];
    const value = raw?.trim() ?? '';
    if (rule.required && !value) {
      errors.push(`Missing required env var: ${rule.name}`);
      continue;
    }
    if (value && rule.test && !rule.test(value)) {
      errors.push(`Invalid env var ${rule.name}: ${rule.hint}`);
    }
  }
  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }
}
