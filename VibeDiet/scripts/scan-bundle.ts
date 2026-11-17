import fs from 'node:fs';
import path from 'node:path';

const DIST_DIR = path.resolve(process.cwd(), 'dist');

const FORBIDDEN_PATTERNS = [
  /AIzaSy[A-Za-z0-9_-]{33}/g, // Live Google API key pattern
  /-----BEGIN PRIVATE KEY-----/g,
  /firebase-adminsdk-[a-z0-9]+@/g,
];

export function scanDirectoryForSecrets(dirPath: string): {
  filesScanned: number;
  leaksFound: string[];
} {
  if (!fs.existsSync(dirPath)) {
    return { filesScanned: 0, leaksFound: [] };
  }

  let filesScanned = 0;
  const leaksFound: string[] = [];

  function walk(current: string) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (/\.(html|js|css|json|map)$/i.test(entry.name)) {
        filesScanned++;
        const content = fs.readFileSync(fullPath, 'utf-8');
        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.test(content)) {
            leaksFound.push(`${path.relative(dirPath, fullPath)} matched ${pattern.source}`);
          }
        }
      }
    }
  }

  walk(dirPath);
  return { filesScanned, leaksFound };
}

const isMain = process.argv[1] && process.argv[1].endsWith('scan-bundle.ts');
if (isMain) {
  const result = scanDirectoryForSecrets(DIST_DIR);
  console.log(`[Gate 3: Bundle Secret Scanner] Scanned ${result.filesScanned} file(s) in dist/.`);
  if (result.leaksFound.length > 0) {
    console.error('❌ Secrets detected in bundle:', result.leaksFound);
    process.exit(1);
  }
  console.log('✅ 0 leaked API keys or private credentials detected.');
}
