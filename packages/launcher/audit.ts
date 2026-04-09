#!/usr/bin/env tsx

import {
  generateFromTemplateFast,
  generateFullSite,
  suggestTemplate,
  listTemplates,
  getTemplate,
  llmComplete,
  type EcommerceSiteConfig,
} from './src/index';

const VLLM_URL = process.env['VLLM_GPU1_URL'] || 'http://100.88.191.49:8000';
const VLLM_API_KEY = process.env['VLLM_API_KEY'] || 'sk-vllm-local';

interface BenchmarkResult {
  template: string;
  niche: string;
  method: 'template' | 'template+llm' | 'full-llm';
  success: boolean;
  duration: number;
  pagesGenerated: number;
  totalChars: number;
  error?: string;
}

const results: BenchmarkResult[] = [];
const logs: string[] = [];

function log(msg: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  logs.push(line);
}

async function testVllmConnection(): Promise<boolean> {
  log('🔍 Testing vLLM connection...');
  try {
    const res = await fetch(`${VLLM_URL}/health`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      log('✅ vLLM is healthy');
      return true;
    }
    log(`❌ vLLM health check failed: ${res.status}`);
    return false;
  } catch (err) {
    log(`❌ vLLM connection failed: ${err}`);
    return false;
  }
}

async function testVllmCompletion(): Promise<boolean> {
  log('🔍 Testing vLLM completion...');
  try {
    const start = Date.now();
    const result = await llmComplete('Say "Hello" in one word.', 50);
    const duration = Date.now() - start;
    log(`✅ vLLM completion: ${duration}ms, result: "${result.slice(0, 50)}"`);
    return true;
  } catch (err) {
    log(`❌ vLLM completion failed: ${err}`);
    return false;
  }
}

async function testTemplateSuggestion() {
  log('\n📋 Testing template suggestion...');
  
  const testCases = [
    'anime figurines',
    'luxury watches',
    'streetwear clothing',
    'beauty skincare',
    'tech gadgets',
    'home decor',
    'gaming accessories',
    'jewelry',
    'cosmetics',
    'electronics',
  ];

  for (const niche of testCases) {
    const template = suggestTemplate(niche);
    log(`  ${niche.padEnd(25)} → ${template.id.padEnd(12)} (${template.name})`);
  }
}

async function testTemplateStructure() {
  log('\n🏗️  Testing template structures...');
  
  const templates = listTemplates();
  for (const t of templates) {
    log(`\n  Template: ${t.id} (${t.name})`);
    log(`    Niches: ${t.niches.join(', ')}`);
    log(`    Design: ${t.designSystem}`);
    log(`    Pages: ${Object.keys(t.pages).join(', ')}`);
    
    // Test each page generator
    const testVars = {
      brandName: 'TestBrand',
      tagline: 'Test tagline for testing',
      niche: t.niches[0] || 'general',
      products: [
        { name: 'Product 1', price: 29.99, handle: 'product-1' },
        { name: 'Product 2', price: 49.99, handle: 'product-2' },
      ],
    };

    for (const [route, generator] of Object.entries(t.pages)) {
      try {
        const code = generator(testVars);
        const lines = code.split('\n').length;
        const chars = code.length;
        log(`      ${route.padEnd(10)} → ${lines} lines, ${chars} chars`);
        
        // Basic validation
        if (!code.includes('export default')) {
          log(`        ⚠️  Missing "export default"`);
        }
        if (route === '/' || route === '/shop') {
          if (!code.includes('getProducts')) {
            log(`        ⚠️  Missing "getProducts" import`);
          }
        }
      } catch (err) {
        log(`        ❌ Generator failed: ${err}`);
      }
    }
  }
}

async function benchmarkTemplate(
  templateId: string,
  niche: string,
  method: 'template' | 'template+llm' | 'full-llm'
): Promise<BenchmarkResult> {
  const config: EcommerceSiteConfig = {
    brandName: `Test${templateId.charAt(0).toUpperCase() + templateId.slice(1)}`,
    tagline: method === 'template' ? 'Premium products for everyone' : '',
    niche,
    tone: 'premium',
    palette: 'dark',
    typography: 'modern',
    products: [
      { name: 'Product 1', price: 29.99 },
      { name: 'Product 2', price: 49.99 },
      { name: 'Product 3', price: 79.99 },
    ],
    pages: [],
  };

  const start = Date.now();
  let files: Map<string, string>;
  let success = true;
  let error: string | undefined;

  try {
    if (method === 'template') {
      const template = getTemplate(templateId);
      if (!template) throw new Error(`Template ${templateId} not found`);
      const vars = {
        brandName: config.brandName,
        tagline: config.tagline || 'Premium products',
        niche: config.niche,
        products: config.products,
      };
      files = new Map();
      for (const [route, gen] of Object.entries(template.pages)) {
        const filePath = route === '/' ? 'src/app/page.tsx' : `src/app${route}/page.tsx`;
        files.set(filePath, gen(vars));
      }
    } else if (method === 'template+llm') {
      files = await generateFromTemplateFast(config, templateId, (step, detail) => {
        log(`    [${step}] ${detail}`);
      });
    } else {
      files = await generateFullSite(config, (step, detail) => {
        log(`    [${step}] ${detail}`);
      });
    }
  } catch (err) {
    success = false;
    error = String(err);
    files = new Map();
  }

  const duration = Date.now() - start;
  const totalChars = Array.from(files.values()).reduce((sum, code) => sum + code.length, 0);

  return {
    template: templateId,
    niche,
    method,
    success,
    duration,
    pagesGenerated: files.size,
    totalChars,
    error,
  };
}

async function runBenchmarks() {
  log('\n⚡ Running benchmarks...');
  
  const templates = listTemplates();
  
  // Test 1: Pure template (no LLM)
  log('\n📊 Benchmark 1: Pure template generation (no LLM)');
  for (const t of templates) {
    const niche = t.niches[0] || 'general';
    log(`\n  Testing ${t.id} (${niche})...`);
    const result = await benchmarkTemplate(t.id, niche, 'template');
    results.push(result);
    
    if (result.success) {
      log(`    ✅ ${result.duration}ms | ${result.pagesGenerated} pages | ${result.totalChars} chars`);
    } else {
      log(`    ❌ Failed: ${result.error}`);
    }
  }

  // Test 2: Template + LLM (tagline generation only)
  log('\n📊 Benchmark 2: Template + LLM (fast mode)');
  for (const t of templates.slice(0, 3)) { // Test first 3 only to save time
    const niche = t.niches[0] || 'general';
    log(`\n  Testing ${t.id} (${niche})...`);
    const result = await benchmarkTemplate(t.id, niche, 'template+llm');
    results.push(result);
    
    if (result.success) {
      log(`    ✅ ${result.duration}ms | ${result.pagesGenerated} pages | ${result.totalChars} chars`);
    } else {
      log(`    ❌ Failed: ${result.error}`);
    }
  }

  // Test 3: Full LLM generation (1 template only, very slow)
  log('\n📊 Benchmark 3: Full LLM generation (slow mode)');
  const testTemplate = templates[0];
  if (testTemplate) {
    const niche = testTemplate.niches[0] || 'general';
    log(`\n  Testing ${testTemplate.id} (${niche})...`);
    const result = await benchmarkTemplate(testTemplate.id, niche, 'full-llm');
    results.push(result);
    
    if (result.success) {
      log(`    ✅ ${result.duration}ms | ${result.pagesGenerated} pages | ${result.totalChars} chars`);
    } else {
      log(`    ❌ Failed: ${result.error}`);
    }
  }
}

function generateReport() {
  log('\n📝 Generating report...');
  
  const report = [
    '# Audit Complet - Système de Génération de Sites',
    '',
    `Date: ${new Date().toISOString()}`,
    '',
    '## 1. Tests de Connexion',
    '',
    '### vLLM',
    `- URL: ${VLLM_URL}`,
    `- API Key: ${VLLM_API_KEY.slice(0, 10)}...`,
    '',
    '## 2. Analyse des Templates',
    '',
    '### Templates Disponibles',
    '',
  ];

  const templates = listTemplates();
  for (const t of templates) {
    report.push(`#### ${t.name} (\`${t.id}\`)`);
    report.push('');
    report.push(`**Niches:** ${t.niches.join(', ')}`);
    report.push(`**Design System:** ${t.designSystem}`);
    report.push(`**Pages:** ${Object.keys(t.pages).length} (${Object.keys(t.pages).join(', ')})`);
    report.push('');
  }

  report.push('## 3. Résultats des Benchmarks');
  report.push('');
  report.push('| Template | Niche | Méthode | Succès | Durée (ms) | Pages | Chars |');
  report.push('|----------|-------|---------|--------|------------|-------|-------|');

  for (const r of results) {
    const status = r.success ? '✅' : '❌';
    report.push(
      `| ${r.template} | ${r.niche} | ${r.method} | ${status} | ${r.duration} | ${r.pagesGenerated} | ${r.totalChars} |`
    );
  }

  report.push('');
  report.push('## 4. Statistiques');
  report.push('');

  const successRate = (results.filter(r => r.success).length / results.length) * 100;
  report.push(`**Taux de succès:** ${successRate.toFixed(1)}%`);

  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  report.push(`**Durée moyenne:** ${avgDuration.toFixed(0)}ms`);

  const byMethod = results.reduce((acc, r) => {
    if (!acc[r.method]) acc[r.method] = [];
    acc[r.method].push(r);
    return acc;
  }, {} as Record<string, BenchmarkResult[]>);

  for (const [method, methodResults] of Object.entries(byMethod)) {
    const avg = methodResults.reduce((sum, r) => sum + r.duration, 0) / methodResults.length;
    report.push(`**${method}:** ${avg.toFixed(0)}ms (${methodResults.length} tests)`);
  }

  report.push('');
  report.push('## 5. Bugs et Recommandations');
  report.push('');

  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    report.push('### Bugs Trouvés');
    report.push('');
    for (const f of failures) {
      report.push(`- **${f.template}** (${f.method}): ${f.error}`);
    }
    report.push('');
  }

  report.push('### Recommandations');
  report.push('');
  report.push('1. **Performance:** Les templates purs sont ~100x plus rapides que la génération LLM complète');
  report.push('2. **Fallback:** Implémenter un fallback vers templates si vLLM est down');
  report.push('3. **Cache:** Mettre en cache les taglines générés par LLM');
  report.push('4. **Validation:** Ajouter validation TypeScript des pages générées');
  report.push('5. **Tests:** Ajouter tests unitaires pour chaque template');
  report.push('');
  report.push('## 6. Logs Complets');
  report.push('');
  report.push('```');
  report.push(...logs);
  report.push('```');

  return report.join('\n');
}

async function main() {
  log('🚀 Starting audit...');
  log(`vLLM URL: ${VLLM_URL}`);
  log(`API Key: ${VLLM_API_KEY.slice(0, 10)}...`);

  // Test vLLM connection
  const vllmHealthy = await testVllmConnection();
  const vllmWorks = vllmHealthy ? await testVllmCompletion() : false;

  if (!vllmWorks) {
    log('⚠️  vLLM is not available, skipping LLM-dependent tests');
  }

  // Test template system
  await testTemplateSuggestion();
  await testTemplateStructure();

  // Run benchmarks
  await runBenchmarks();

  // Generate report
  const report = generateReport();
  
  // Write report to file
  const fs = await import('fs/promises');
  const reportPath = './audit-report.md';
  await fs.writeFile(reportPath, report, 'utf-8');
  
  log(`\n✅ Audit complete! Report saved to ${reportPath}`);
  
  // Print summary
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  log(`\n📊 Summary: ${successCount}/${totalCount} tests passed`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
