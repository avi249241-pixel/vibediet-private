/**
 * VibeDiet Auto-Syncing Code-to-Obsidian Neural Brain Script
 * Parses real TypeScript/TSX imports across src/ and netlify/functions/,
 * generates brain/Code-Graph.md (Mermaid dependency graph + file-to-note index),
 * and strictly validates 0 broken [[Wikilinks]] and 0 orphan notes in brain/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(APP_ROOT, '..');
const BRAIN_ROOT = fs.existsSync(path.join(REPO_ROOT, 'brain'))
  ? path.join(REPO_ROOT, 'brain')
  : path.join(APP_ROOT, 'brain');
const MIRROR_BRAIN_ROOT: string | null = null;

interface ParsedFile {
  relPath: string; // POSIX relative to APP_ROOT, e.g. src/context/DietContext.tsx
  absPath: string;
  layer: 'ui' | 'context' | 'ai-math' | 'service' | 'api' | 'db' | 'other';
  brainNote: string; // e.g. Today-Dashboard
  imports: string[]; // resolved relPaths within APP_ROOT
}

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

function walkFiles(dir: string, exts: Set<string>, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git', '.obsidian', '.next', 'coverage', 'test-results'].includes(entry.name)) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, exts, out);
    } else if (exts.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

function classifyFile(rel: string): { layer: ParsedFile['layer']; brainNote: string } {
  const lower = rel.toLowerCase();

  // Serverless & Express API
  if (lower.startsWith('netlify/functions/admin') || lower.includes('admindashboardscreen')) {
    return { layer: lower.startsWith('netlify/') ? 'api' : 'ui', brainNote: 'Admin-Console' };
  }
  if (lower.startsWith('netlify/functions/') || lower.startsWith('src/routes/') || lower === 'server.ts') {
    return { layer: 'api', brainNote: 'Serverless-API' };
  }

  // Persistence / Database
  if (
    lower.includes('persistence/') ||
    lower.includes('datastore') ||
    lower.includes('mockfirestore') ||
    lower.includes('supabaseclient')
  ) {
    return { layer: 'db', brainNote: 'PostgreSQL-Schema' };
  }

  // Context / State Hub
  if (lower.startsWith('src/context/') || lower.includes('offlinesyncqueue')) {
    return { layer: 'context', brainNote: 'DietContext' };
  }

  // AI & Math Engine
  if (lower.includes('gemininutritionswarm') || lower.includes('naturallanguagemealparser') || lower.includes('draftprocessor')) {
    return { layer: 'ai-math', brainNote: 'Gemini-Recognition-Swarm' };
  }
  if (lower.includes('keypoolrouter')) {
    return { layer: 'ai-math', brainNote: 'Key-Pool-Router' };
  }
  if (lower.includes('atwater')) {
    return { layer: 'ai-math', brainNote: 'Atwater-Verifier' };
  }
  if (lower.includes('adaptivetdee') || lower.includes('weeklyautopilot')) {
    return { layer: 'ai-math', brainNote: 'Adaptive-TDEE-EWMA' };
  }

  // Feature UI Screens & Services
  if (lower.includes('photolog') || lower.includes('aiscanner') || lower.includes('imagecompressor') || lower.includes('portionmemory') || lower.includes('draftreview')) {
    return { layer: lower.includes('components/') ? 'ui' : 'service', brainNote: 'AI-Meal-Scan' };
  }
  if (lower.includes('manualentry') || lower.includes('barcodescanner') || lower.includes('foodcatalog') || lower.includes('apiconnectors')) {
    return { layer: lower.includes('components/') ? 'ui' : 'service', brainNote: 'Food-Search-Catalog' };
  }
  if (lower.includes('metabolismcoach') || lower.includes('weeklycheckin')) {
    return { layer: 'ui', brainNote: 'Metabolism-Coach' };
  }
  if (lower.includes('profilescreen') || lower.includes('legalmodal') || lower.includes('authmodal') || lower.includes('billingservice')) {
    return { layer: lower.includes('components/') ? 'ui' : 'service', brainNote: 'Profile-and-Support' };
  }
  if (lower.includes('auditlogger') || lower.includes('middleware/')) {
    return { layer: 'api', brainNote: 'Admin-Console' };
  }
  if (
    lower.includes('dailydiary') ||
    lower.includes('vibedietdashboard') ||
    lower.includes('vibedietnavbar') ||
    lower.includes('omnibardock') ||
    lower.includes('commandpalette') ||
    lower.includes('macromealsolver') ||
    lower.includes('navigation.tsx') ||
    lower === 'src/app.tsx'
  ) {
    return { layer: lower.includes('services/') ? 'service' : 'ui', brainNote: 'Today-Dashboard' };
  }

  return { layer: 'other', brainNote: 'Architecture' };
}

function resolveImportPath(fromAbs: string, specifier: string, allKnownFiles: Set<string>): string | null {
  if (!specifier.startsWith('.')) return null;
  const baseDir = path.dirname(fromAbs);
  const rawTarget = path.resolve(baseDir, specifier);
  const stripped = rawTarget.replace(/\.(js|mjs|cjs|jsx|ts|tsx|mts)$/, '');
  const candidates = [
    rawTarget,
    `${stripped}.ts`,
    `${stripped}.tsx`,
    `${stripped}.mts`,
    `${stripped}.js`,
    path.join(stripped, 'index.ts'),
    path.join(stripped, 'index.tsx'),
  ];
  for (const cand of candidates) {
    const rel = toPosix(path.relative(APP_ROOT, cand));
    if (allKnownFiles.has(rel)) {
      return rel;
    }
  }
  return null;
}

function parseSourceImports(): ParsedFile[] {
  const codeExts = new Set(['.ts', '.tsx', '.mts']);
  const sourcePaths = [
    ...walkFiles(path.join(APP_ROOT, 'src'), codeExts),
    ...walkFiles(path.join(APP_ROOT, 'netlify', 'functions'), codeExts),
  ];
  const serverEntry = path.join(APP_ROOT, 'server.ts');
  if (fs.existsSync(serverEntry)) sourcePaths.push(serverEntry);

  const allKnownRel = new Set(sourcePaths.map((abs) => toPosix(path.relative(APP_ROOT, abs))));
  const importRegex = /(?:import\s+(?:[\s\S]*?\s+from\s+)?|export\s+(?:[\s\S]*?\s+from\s+)?|import\s*\(\s*)['"]([^'"]+)['"]/g;

  const parsed: ParsedFile[] = [];
  for (const absPath of sourcePaths) {
    const relPath = toPosix(path.relative(APP_ROOT, absPath));
    const content = fs.readFileSync(absPath, 'utf-8');
    const resolvedSet = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      const target = resolveImportPath(absPath, match[1], allKnownRel);
      if (target && target !== relPath) {
        resolvedSet.add(target);
      }
    }
    const { layer, brainNote } = classifyFile(relPath);
    parsed.push({
      relPath,
      absPath,
      layer,
      brainNote,
      imports: Array.from(resolvedSet).sort(),
    });
  }

  return parsed.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

function buildCodeGraphMarkdown(files: ParsedFile[]): string {
  // Aggregate real brainNote-to-brainNote dependency edges from actual code imports
  const fileByRel = new Map(files.map((f) => [f.relPath, f]));
  const noteEdges = new Map<string, number>();

  for (const file of files) {
    for (const imp of file.imports) {
      const target = fileByRel.get(imp);
      if (!target) continue;
      if (file.brainNote === target.brainNote) continue;
      if (file.brainNote === 'Architecture' || target.brainNote === 'Architecture') continue;
      const key = `${file.brainNote}-->${target.brainNote}`;
      noteEdges.set(key, (noteEdges.get(key) || 0) + 1);
    }
  }

  // Build Mermaid flowchart from real parsed import edges
  const nodeId = (note: string) => note.replace(/[^a-zA-Z0-9]/g, '_');
  const mermaidLines: string[] = [
    'flowchart LR',
    '  subgraph UI["UI Screens & Features"]',
    '    Today_Dashboard["Today-Dashboard"]',
    '    AI_Meal_Scan["AI-Meal-Scan"]',
    '    Food_Search_Catalog["Food-Search-Catalog"]',
    '    Metabolism_Coach["Metabolism-Coach"]',
    '    Profile_and_Support["Profile-and-Support"]',
    '    Admin_Console["Admin-Console"]',
    '  end',
    '  subgraph State["Client State Hub"]',
    '    DietContext["DietContext"]',
    '  end',
    '  subgraph Engine["AI & Physics Engine"]',
    '    Gemini_Recognition_Swarm["Gemini-Recognition-Swarm"]',
    '    Key_Pool_Router["Key-Pool-Router"]',
    '    Atwater_Verifier["Atwater-Verifier"]',
    '    Adaptive_TDEE_EWMA["Adaptive-TDEE-EWMA"]',
    '  end',
    '  subgraph Cloud["Backend & PostgreSQL"]',
    '    Serverless_API["Serverless-API"]',
    '    PostgreSQL_Schema["PostgreSQL-Schema"]',
    '  end',
  ];

  const sortedEdges = Array.from(noteEdges.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [edge, count] of sortedEdges) {
    const [src, dst] = edge.split('-->');
    mermaidLines.push(`  ${nodeId(src)} -->|${count} imports| ${nodeId(dst)}`);
  }

  // Add runtime HTTP/SQL pipeline edges that connect frontend -> serverless -> DB
  mermaidLines.push('  DietContext -.->|"HTTP /v1/*"| Serverless_API');
  mermaidLines.push('  Admin_Console -.->|"HTTP /v1/admin/*"| Serverless_API');
  mermaidLines.push('  Serverless_API -.->|"SQL vibe_*"| PostgreSQL_Schema');

  // Filter key files (exclude tiny re-export shims if any, keep all meaningful modules)
  const indexedFiles = files.filter((f) => f.layer !== 'other');
  const totalImports = files.reduce((s, f) => s + f.imports.length, 0);

  const uniqueNotes = Array.from(new Set(indexedFiles.map((f) => f.brainNote))).sort();
  const hubLinks = [
    '[[00-Home]]',
    '[[Architecture]]',
    '[[Active-Context]]',
    ...uniqueNotes.map((n) => `[[${n}]]`),
  ].join(' | ');

  const tableRows = indexedFiles.map((f) => {
    const importedNotes = Array.from(
      new Set(
        f.imports
          .map((imp) => fileByRel.get(imp)?.brainNote)
          .filter((n): n is string => Boolean(n && n !== f.brainNote))
      )
    )
      .sort()
      .map((n) => `[[${n}]]`)
      .join(', ');
    return `| \`${f.relPath}\` | \`${f.layer}\` | [[${f.brainNote}]] | ${f.imports.length} | ${importedNotes || '—'} |`;
  });

  return `# 🕸️ Live Code Dependency Graph

#hub #backend

Linked: ${hubLinks}

> Auto-generated by \`npm run brain:sync\` (\`scripts/sync-brain-graph.ts\`) from **${files.length} TypeScript/TSX source modules** and **${totalImports} real internal import edges** across \`VibeDiet/src/\` and \`VibeDiet/netlify/functions/\`.

## 1. Live Architectural Dependency Graph

\`\`\`mermaid
${mermaidLines.join('\n')}
\`\`\`

## 2. Verified File-to-Brain Cross-Link Index

| Source File | Layer | Brain Note | Local Imports | Connected Brain Nodes |
| :--- | :--- | :--- | :---: | :--- |
${tableRows.join('\n')}
`;
}

function validateBrainVault(brainDir: string): {
  noteCount: number;
  linkCount: number;
  brokenLinks: Array<{ source: string; target: string }>;
  orphanNotes: Array<{ note: string; incoming: number; outgoing: number }>;
} {
  const mdFiles = walkFiles(brainDir, new Set(['.md']));
  const notesByBasename = new Map<string, string>();
  const notesByRelNoExt = new Map<string, string>();

  for (const abs of mdFiles) {
    const rel = toPosix(path.relative(brainDir, abs));
    const relNoExt = rel.replace(/\.md$/i, '');
    const base = path.basename(rel, '.md');
    notesByBasename.set(base.toLowerCase(), rel);
    notesByRelNoExt.set(relNoExt.toLowerCase(), rel);
  }

  const incomingCount = new Map<string, number>();
  const outgoingCount = new Map<string, number>();
  for (const abs of mdFiles) {
    const rel = toPosix(path.relative(brainDir, abs));
    incomingCount.set(rel, 0);
    outgoingCount.set(rel, 0);
  }

  const brokenLinks: Array<{ source: string; target: string }> = [];
  let totalLinks = 0;
  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;

  for (const abs of mdFiles) {
    const sourceRel = toPosix(path.relative(brainDir, abs));
    const content = fs.readFileSync(abs, 'utf-8');
    // Strip fenced code blocks and inline code spans so sample syntax doesn't create false links
    const withoutCode = content
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`\n]+`/g, '');
    const seenTargets = new Set<string>();

    let match: RegExpExecArray | null;
    while ((match = wikiLinkRegex.exec(withoutCode)) !== null) {
      const rawTarget = match[1].split('|')[0].split('#')[0].trim();
      if (!rawTarget) continue;
      totalLinks++;

      const cleanTarget = rawTarget.replace(/\.md$/i, '').toLowerCase();
      const resolved =
        notesByRelNoExt.get(cleanTarget) ||
        notesByBasename.get(path.basename(cleanTarget));

      if (!resolved) {
        brokenLinks.push({ source: sourceRel, target: rawTarget });
      } else if (resolved !== sourceRel && !seenTargets.has(resolved)) {
        seenTargets.add(resolved);
        outgoingCount.set(sourceRel, (outgoingCount.get(sourceRel) || 0) + 1);
        incomingCount.set(resolved, (incomingCount.get(resolved) || 0) + 1);
      }
    }
  }

  const orphanNotes: Array<{ note: string; incoming: number; outgoing: number }> = [];
  for (const abs of mdFiles) {
    const rel = toPosix(path.relative(brainDir, abs));
    const inc = incomingCount.get(rel) || 0;
    const out = outgoingCount.get(rel) || 0;
    if (inc + out < 2 || inc === 0) {
      orphanNotes.push({ note: rel, incoming: inc, outgoing: out });
    }
  }

  return {
    noteCount: mdFiles.length,
    linkCount: totalLinks,
    brokenLinks,
    orphanNotes,
  };
}

function mirrorBrainNotes(srcDir: string, dstDir: string) {
  const mdFiles = walkFiles(srcDir, new Set(['.md']));
  for (const abs of mdFiles) {
    const rel = path.relative(srcDir, abs);
    const target = path.join(dstDir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(abs, target);
  }
}

function main() {
  console.log('🧠 [Brain Sync] Scanning real imports across src/ and netlify/functions/...');
  const parsedFiles = parseSourceImports();
  const codeGraphMd = buildCodeGraphMarkdown(parsedFiles);

  const codeGraphPath = path.join(BRAIN_ROOT, 'Code-Graph.md');
  fs.writeFileSync(codeGraphPath, codeGraphMd, 'utf-8');
  console.log(`✅ [Brain Sync] Generated ${codeGraphPath} (${parsedFiles.length} modules indexed).`);

  if (MIRROR_BRAIN_ROOT && fs.existsSync(MIRROR_BRAIN_ROOT)) {
    mirrorBrainNotes(BRAIN_ROOT, MIRROR_BRAIN_ROOT);
    console.log(`🔄 [Brain Sync] Mirrored connected brain notes to ${MIRROR_BRAIN_ROOT}.`);
  }

  const report = validateBrainVault(BRAIN_ROOT);
  console.log(
    `📊 [Brain Validation] Notes: ${report.noteCount} | Wikilinks: ${report.linkCount} | Broken: ${report.brokenLinks.length} | Orphans: ${report.orphanNotes.length}`
  );

  if (report.brokenLinks.length > 0) {
    console.error('❌ Broken [[Wikilinks]] detected:');
    for (const b of report.brokenLinks) {
      console.error(`   - ${b.source} -> [[${b.target}]]`);
    }
  }

  if (report.orphanNotes.length > 0) {
    console.error('❌ Orphan notes (< 2 connections or 0 incoming links) detected:');
    for (const o of report.orphanNotes) {
      console.error(`   - ${o.note} (in: ${o.incoming}, out: ${o.outgoing})`);
    }
  }

  if (report.brokenLinks.length > 0 || report.orphanNotes.length > 0) {
    process.exit(1);
  }

  console.log('✨ [Brain Sync] Connected Obsidian Neural Graph verified: 0 broken links, 0 orphan notes!');
}

main();
