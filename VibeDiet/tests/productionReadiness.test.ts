import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { scanDirectoryForSecrets } from '../scripts/scan-bundle.js';

describe('Production Security Rules, Indexes, Legal Shield & Bundle Scan', () => {
  const root = process.cwd();

  it('enforces strict user isolation and server-only day mutations in firestore.rules', () => {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf-8');
    expect(rules).toContain('match /users/{userId}');
    expect(rules).toContain('match /supportTickets/{ticketId}');
    expect(rules).toContain('allow read, update, delete: if false;');
  });

  it('defines composite collection-group indexes in firestore.indexes.json', () => {
    const indexes = JSON.parse(
      fs.readFileSync(path.join(root, 'firestore.indexes.json'), 'utf-8')
    );
    expect(Array.isArray(indexes.indexes)).toBe(true);
    expect(indexes.indexes.length).toBeGreaterThanOrEqual(2);
  });

  it('contains the $0.00 aggregate liability cap and ephemeral photo policy in LEGAL.md', () => {
    const legal = fs.readFileSync(path.join(root, 'LEGAL.md'), 'utf-8');
    expect(legal).toContain('$0.00 USD');
    expect(legal).toContain('Ephemeral Photo Privacy');
  });

  it('verifies zero leaked secrets in dist/ via scanDirectoryForSecrets', () => {
    const scan = scanDirectoryForSecrets(path.join(root, 'dist'));
    expect(scan.leaksFound).toEqual([]);
  });
});
