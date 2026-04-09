#!/usr/bin/env tsx

import { getTemplate, generateFromTemplate } from './src/index';
import type { TemplateVars } from './src/index';

interface ConsistencyIssue {
  template: string;
  issue: string;
  severity: 'error' | 'warning' | 'info';
}

const issues: ConsistencyIssue[] = [];

function extractClasses(code: string): Set<string> {
  const classRegex = /className="([^"]+)"/g;
  const classes = new Set<string>();
  let match;
  while ((match = classRegex.exec(code)) !== null) {
    match[1].split(/\s+/).forEach(c => classes.add(c));
  }
  return classes;
}

function extractColors(code: string): Set<string> {
  const colors = new Set<string>();
  const colorRegex = /(bg|text|border|from|to|via)-(\w+-\d+|white|black|gray-\d+|transparent)/g;
  let match;
  while ((match = colorRegex.exec(code)) !== null) {
    colors.add(match[0]);
  }
  return colors;
}

function extractFonts(code: string): Set<string> {
  const fonts = new Set<string>();
  const fontRegex = /font-(sans|serif|mono|black|bold|semibold|medium|normal|light|thin)/g;
  let match;
  while ((match = fontRegex.exec(code)) !== null) {
    fonts.add(match[0]);
  }
  return fonts;
}

function testTemplateConsistency(templateId: string) {
  console.log(`\n🔍 Testing ${templateId} consistency...`);
  
  const template = getTemplate(templateId);
  if (!template) {
    issues.push({ template: templateId, issue: 'Template not found', severity: 'error' });
    return;
  }

  const vars: TemplateVars = {
    brandName: 'TestBrand',
    tagline: 'Test tagline',
    niche: template.niches[0] || 'general',
    products: [
      { name: 'Product 1', price: 29.99, handle: 'product-1' },
    ],
  };

  const files = generateFromTemplate(template, vars);
  const pages = Array.from(files.entries());

  // Extract design tokens from all pages
  const allColors = new Map<string, Set<string>>();
  const allFonts = new Map<string, Set<string>>();
  const allClasses = new Map<string, Set<string>>();

  for (const [path, code] of pages) {
    allColors.set(path, extractColors(code));
    allFonts.set(path, extractFonts(code));
    allClasses.set(path, extractClasses(code));
  }

  // Check background consistency
  const backgrounds = new Set<string>();
  for (const [path, colors] of allColors) {
    for (const color of colors) {
      if (color.startsWith('bg-')) {
        backgrounds.add(color);
      }
    }
  }

  console.log(`  Backgrounds used: ${Array.from(backgrounds).join(', ')}`);

  // Check if all pages use similar backgrounds
  const homeBg = Array.from(allColors.get('src/app/page.tsx') || [])
    .filter(c => c.startsWith('bg-'))
    .find(c => c.includes('950') || c.includes('900') || c.includes('black') || c.includes('white') || c.includes('50'));

  if (homeBg) {
    for (const [path, colors] of allColors) {
      const hasSimilarBg = Array.from(colors).some(c => 
        c.startsWith('bg-') && (
          c === homeBg || 
          c.includes(homeBg.split('-')[1]) // Same color family
        )
      );
      
      if (!hasSimilarBg && path !== 'src/app/page.tsx') {
        issues.push({
          template: templateId,
          issue: `${path} uses different background than home (expected ${homeBg})`,
          severity: 'warning',
        });
      }
    }
  }

  // Check font consistency
  const allFontWeights = new Set<string>();
  for (const fonts of allFonts.values()) {
    for (const font of fonts) {
      allFontWeights.add(font);
    }
  }

  console.log(`  Font weights used: ${Array.from(allFontWeights).join(', ')}`);

  // Check if contact page has 'use client'
  const contactCode = files.get('src/app/contact/page.tsx');
  if (contactCode && !contactCode.includes("'use client'")) {
    issues.push({
      template: templateId,
      issue: 'Contact page missing "use client" directive',
      severity: 'error',
    });
  }

  // Check if home/shop have getProducts
  for (const [path, code] of pages) {
    if ((path.includes('page.tsx') && !path.includes('about') && !path.includes('contact'))) {
      if (!code.includes('getProducts')) {
        issues.push({
          template: templateId,
          issue: `${path} missing getProducts import`,
          severity: 'error',
        });
      }
    }
  }

  // Check brand name usage
  for (const [path, code] of pages) {
    if (!code.includes(vars.brandName)) {
      issues.push({
        template: templateId,
        issue: `${path} doesn't use brand name`,
        severity: 'warning',
      });
    }
  }

  // Check responsive classes
  const responsiveClasses = ['sm:', 'md:', 'lg:', 'xl:'];
  for (const [path, classes] of allClasses) {
    const hasResponsive = Array.from(classes).some(c => 
      responsiveClasses.some(prefix => c.includes(prefix))
    );
    
    if (!hasResponsive) {
      issues.push({
        template: templateId,
        issue: `${path} has no responsive classes`,
        severity: 'warning',
      });
    }
  }

  // Check accessibility
  for (const [path, code] of pages) {
    // Check for images without alt
    const imgRegex = /<img[^>]*>/g;
    const images = code.match(imgRegex) || [];
    for (const img of images) {
      if (!img.includes('alt=')) {
        issues.push({
          template: templateId,
          issue: `${path} has image without alt text`,
          severity: 'error',
        });
      }
    }

    // Check for buttons without text
    const buttonRegex = /<button[^>]*>([^<]*)<\/button>/g;
    const buttons = code.match(buttonRegex) || [];
    for (const button of buttons) {
      if (button.includes('></button>')) {
        issues.push({
          template: templateId,
          issue: `${path} has button without text`,
          severity: 'error',
        });
      }
    }
  }

  console.log(`  ✅ Checked ${pages.length} pages`);
}

function testDesignSystemConsistency() {
  console.log('\n🎨 Testing design system consistency across templates...');
  
  const templates = ['anime', 'luxury', 'streetwear', 'beauty', 'tech', 'general'];
  const designSystems = new Map<string, string>();

  for (const templateId of templates) {
    const template = getTemplate(templateId);
    if (template) {
      designSystems.set(templateId, template.designSystem);
    }
  }

  console.log('\nDesign Systems:');
  for (const [id, ds] of designSystems) {
    console.log(`  ${id.padEnd(12)} → ${ds}`);
  }

  // Check for duplicates
  const dsValues = Array.from(designSystems.values());
  const uniqueDs = new Set(dsValues);
  
  if (dsValues.length !== uniqueDs.size) {
    console.log('\n⚠️  Some templates share the same design system');
  } else {
    console.log('\n✅ All templates have unique design systems');
  }
}

function printReport() {
  console.log('\n📊 Consistency Report');
  console.log('=====================\n');

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const infos = issues.filter(i => i.severity === 'info');

  console.log(`Total issues: ${issues.length}`);
  console.log(`  Errors: ${errors.length}`);
  console.log(`  Warnings: ${warnings.length}`);
  console.log(`  Info: ${infos.length}`);

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    for (const issue of errors) {
      console.log(`  [${issue.template}] ${issue.issue}`);
    }
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    for (const issue of warnings) {
      console.log(`  [${issue.template}] ${issue.issue}`);
    }
  }

  if (infos.length > 0) {
    console.log('\nℹ️  Info:');
    for (const issue of infos) {
      console.log(`  [${issue.template}] ${issue.issue}`);
    }
  }

  if (issues.length === 0) {
    console.log('\n✅ All templates are consistent!');
  }
}

async function main() {
  console.log('🚀 Starting visual consistency tests...');

  const templates = ['anime', 'luxury', 'streetwear', 'beauty', 'tech', 'general'];
  
  for (const templateId of templates) {
    testTemplateConsistency(templateId);
  }

  testDesignSystemConsistency();
  printReport();

  console.log('\n✅ Consistency tests completed!');
  
  if (issues.filter(i => i.severity === 'error').length > 0) {
    process.exit(1);
  }
}

main();
