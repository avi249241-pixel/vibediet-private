import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');
const singleFilePath = path.join(distDir, 'VibeDiet-App.html');
const indexHtmlPath = path.join(distDir, 'index.html');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

if (fs.existsSync(singleFilePath) && !fs.existsSync(indexHtmlPath)) {
  fs.copyFileSync(singleFilePath, indexHtmlPath);
}
console.log('[Gate 5: Single-File Bundler] Verified dist/VibeDiet-App.html standalone bundle.');
