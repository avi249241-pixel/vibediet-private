import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const desktopDir = 'C:\\Users\\coder\\Desktop';
const netlifyDropDir = path.join(desktopDir, 'VibeDiet-Netlify-Drop');
const netlifyZipPath = path.join(desktopDir, 'VibeDiet-Netlify-Drop.zip');
const netlifyRepoDir = path.join(desktopDir, 'VibeDiet-Netlify');
const dataDir = path.join(projectRoot, '.data');
const stateFilePath = path.join(dataDir, '.netlify-drop-state.json');

const REDIRECTS_CONTENT = `/v1/admin/* /.netlify/functions/admin 200
/v1/*        /.netlify/functions/v1 200
/today       /index.html 200
/scan        /index.html 200
/search      /index.html 200
/metabolism  /index.html 200
/profile     /index.html 200
/onboarding  /index.html 200
/admin       /index.html 200
/admin/*     /index.html 200
/offline     /VibeDiet-App.html 200
/standalone  /VibeDiet-App.html 200
/*           /index.html 200
`;

const HEADERS_CONTENT = `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/*.html
  Cache-Control: public, max-age=0, must-revalidate

/sw.js
  Cache-Control: public, max-age=0, must-revalidate

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;

interface SyncOptions {
  force?: boolean;
  quiet?: boolean;
  watch?: boolean;
  deploy?: boolean;
}

function getArgs(): SyncOptions {
  const args = process.argv.slice(2);
  return {
    force: args.includes('--force') || args.includes('-f'),
    quiet: args.includes('--quiet') || args.includes('-q'),
    watch: args.includes('--watch') || args.includes('-w'),
    deploy: args.includes('--deploy') || args.includes('-d'),
  };
}

function hashFile(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch {
    return '';
  }
}

function computeProjectSourceHash(): { hash: string; fileCount: number } {
  const hasher = crypto.createHash('sha256');
  let fileCount = 0;

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name === 'dist' || entry.name === 'test-results') {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (/\.(tsx?|jsx?|html|css|json|sql|mts)$/i.test(entry.name)) {
        fileCount++;
        hasher.update(fullPath);
        hasher.update(fs.readFileSync(fullPath));
      }
    }
  }

  walk(path.join(projectRoot, 'src'));
  walk(path.join(projectRoot, 'public'));
  walk(path.join(projectRoot, 'netlify'));
  
  const rootFiles = ['index.html', 'vite.config.ts', 'package.json', 'netlify.toml'];
  for (const rf of rootFiles) {
    const full = path.join(projectRoot, rf);
    if (fs.existsSync(full)) {
      fileCount++;
      hasher.update(full);
      hasher.update(fs.readFileSync(full));
    }
  }

  return { hash: hasher.digest('hex'), fileCount };
}

function copyRecursive(src: string, dest: string, ignorePatterns: RegExp[] = []): void {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      if (ignorePatterns.some((pattern) => pattern.test(entry))) continue;
      copyRecursive(path.join(src, entry), path.join(dest, entry), ignorePatterns);
    }
  } else {
    const parentDir = path.dirname(dest);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

export function syncNetlifyDrop(options: SyncOptions = {}): {
  success: boolean;
  action: 'synced' | 'up-to-date' | 'error';
  hash: string;
  timestamp: string;
  details?: string;
} {
  const log = (msg: string) => {
    if (!options.quiet) console.log(msg);
  };

  try {
    const t0 = Date.now();
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const { hash: currentHash, fileCount } = computeProjectSourceHash();

    // Check last state
    let lastState: { hash?: string; lastSync?: string } = {};
    if (fs.existsSync(stateFilePath)) {
      try {
        lastState = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
      } catch {
        lastState = {};
      }
    }

    const distExists = fs.existsSync(path.join(projectRoot, 'dist', 'index.html'));
    const dropExists = fs.existsSync(netlifyDropDir);
    const zipExists = fs.existsSync(netlifyZipPath);

    const isUnchanged =
      !options.force &&
      lastState.hash === currentHash &&
      distExists &&
      dropExists &&
      zipExists;

    if (isUnchanged) {
      log(`⚡ [Netlify Drop Auto-Sync] Everything up to date (${fileCount} source files verified in ${Date.now() - t0}ms)`);
      return {
        success: true,
        action: 'up-to-date',
        hash: currentHash,
        timestamp: new Date().toISOString(),
      };
    }

    log(`🚀 [Netlify Drop Auto-Sync] Detected changes or initial sync. Updating Netlify drop artifacts...`);

    // 1. Build if dist is missing or sources changed
    log(`  📦 Step 1/5: Building production bundle (vite + singlefile + secret scan)...`);
    execSync('npm run build', { cwd: projectRoot, stdio: options.quiet ? 'ignore' : 'inherit' });

    // 2. Prepare VibeDiet-Netlify-Drop
    log(`  📁 Step 2/5: Synchronizing ${netlifyDropDir}...`);
    if (fs.existsSync(netlifyDropDir)) {
      fs.rmSync(netlifyDropDir, { recursive: true, force: true });
    }
    fs.mkdirSync(netlifyDropDir, { recursive: true });

    // Copy dist into Netlify Drop
    copyRecursive(path.join(projectRoot, 'dist'), netlifyDropDir);

    // Write _redirects & _headers (UTF-8 without BOM)
    fs.writeFileSync(path.join(netlifyDropDir, '_redirects'), REDIRECTS_CONTENT, 'utf8');
    fs.writeFileSync(path.join(netlifyDropDir, '_headers'), HEADERS_CONTENT, 'utf8');

    // Ensure <base href="/" /> is present in index.html
    const dropIndexPath = path.join(netlifyDropDir, 'index.html');
    if (fs.existsSync(dropIndexPath)) {
      let indexHtml = fs.readFileSync(dropIndexPath, 'utf8');
      if (!indexHtml.includes('<base href="/" />')) {
        indexHtml = indexHtml.replace(
          '<meta charset="UTF-8" />',
          '<meta charset="UTF-8" />\n    <base href="/" />'
        );
        fs.writeFileSync(dropIndexPath, indexHtml, 'utf8');
      }
    }

    // Copy README if exists
    const srcReadme = path.join(netlifyRepoDir, 'README.md');
    if (fs.existsSync(srcReadme)) {
      fs.copyFileSync(srcReadme, path.join(netlifyDropDir, 'README.md'));
    }

    // 3. Compress to VibeDiet-Netlify-Drop.zip
    log(`  🗜️  Step 3/5: Compressing archive ${netlifyZipPath}...`);
    if (fs.existsSync(netlifyZipPath)) {
      try {
        fs.rmSync(netlifyZipPath, { force: true });
      } catch {
        // Handled by Compress-Archive -Force
      }
    }
    const psCompressCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path '${netlifyDropDir}\\*' -DestinationPath '${netlifyZipPath}' -CompressionLevel Fastest -Force"`;
    execSync(psCompressCmd, { stdio: options.quiet ? 'ignore' : 'inherit' });

    // 4. Synchronize VibeDiet-Netlify repo
    log(`  🔄 Step 4/5: Syncing repo folder ${netlifyRepoDir}...`);
    if (!fs.existsSync(netlifyRepoDir)) {
      fs.mkdirSync(netlifyRepoDir, { recursive: true });
    }
    const ignoreList = [/node_modules/, /^\.git$/, /^\.tmp/, /test-results/, /\.log$/];
    copyRecursive(path.join(projectRoot, 'src'), path.join(netlifyRepoDir, 'src'), ignoreList);
    copyRecursive(path.join(projectRoot, 'public'), path.join(netlifyRepoDir, 'public'), ignoreList);
    copyRecursive(path.join(projectRoot, 'scripts'), path.join(netlifyRepoDir, 'scripts'), ignoreList);
    copyRecursive(path.join(projectRoot, 'netlify'), path.join(netlifyRepoDir, 'netlify'), ignoreList);
    copyRecursive(path.join(projectRoot, 'dist'), path.join(netlifyRepoDir, 'dist'), ignoreList);
    
    // Copy root configs
    const configsToCopy = ['index.html', 'vite.config.ts', 'tsconfig.json'];
    for (const cfg of configsToCopy) {
      const srcCfg = path.join(projectRoot, cfg);
      if (fs.existsSync(srcCfg)) {
        fs.copyFileSync(srcCfg, path.join(netlifyRepoDir, cfg));
      }
    }

    // 5. Update state file
    const newState = {
      hash: currentHash,
      lastSync: new Date().toISOString(),
      fileCount,
      durationMs: Date.now() - t0,
    };
    fs.writeFileSync(stateFilePath, JSON.stringify(newState, null, 2), 'utf8');

    log(`✅ [Netlify Drop Auto-Sync] Done in ${((Date.now() - t0) / 1000).toFixed(2)}s!`);
    log(`   • Drop Folder: ${netlifyDropDir}`);
    log(`   • Drop Zip:    ${netlifyZipPath} (${(fs.statSync(netlifyZipPath).size / 1024 / 1024).toFixed(2)} MB)`);
    log(`   • Repo Folder: ${netlifyRepoDir}`);

    return {
      success: true,
      action: 'synced',
      hash: currentHash,
      timestamp: newState.lastSync,
      details: `Updated in ${(newState.durationMs / 1000).toFixed(2)}s`,
    };
  } catch (err: any) {
    console.error('❌ [Netlify Drop Auto-Sync] Error:', err.message || err);
    return {
      success: false,
      action: 'error',
      hash: '',
      timestamp: new Date().toISOString(),
      details: err.message,
    };
  }
}

// Watcher implementation
function startWatcher(): void {
  console.log(`👀 Watching VibeDiet for changes (auto-syncing Netlify Drop on save)...`);
  syncNetlifyDrop();

  let debounceTimer: NodeJS.Timeout | null = null;
  const triggerDebouncedSync = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log(`\n🔔 Change detected, running Netlify Drop sync...`);
      syncNetlifyDrop();
    }, 1200);
  };

  const watchDirs = [
    path.join(projectRoot, 'src'),
    path.join(projectRoot, 'public'),
    path.join(projectRoot, 'netlify'),
  ];

  for (const dir of watchDirs) {
    if (fs.existsSync(dir)) {
      fs.watch(dir, { recursive: true }, (_eventType, filename) => {
        if (!filename) return;
        if (/\.(tsx?|jsx?|html|css|json|sql|mts)$/i.test(filename)) {
          triggerDebouncedSync();
        }
      });
    }
  }

  // Keep process alive
  process.stdin.resume();
}

// Direct CLI entry point
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirectRun) {
  const options = getArgs();
  if (options.watch) {
    startWatcher();
  } else {
    const result = syncNetlifyDrop(options);
    if (!result.success) {
      process.exit(1);
    }
  }
}
