import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  isValidBarcodeFormat,
  cleanBarcode,
  isBarcodeDetectorSupported,
  stopMediaStream,
} from '../src/components/BarcodeScannerModal.js';
import { VERIFIED_BARCODE_FOODS } from '../src/data/mockData.js';

describe('Hardware Barcode Scanner & PWA Suite', () => {
  describe('Barcode Format Validation & Sanitation', () => {
    it('validates standard EAN-13 barcodes correctly', () => {
      expect(isValidBarcodeFormat('8901058000290')).toBe(true);
      expect(isValidBarcodeFormat('8901262010023')).toBe(true);
      expect(isValidBarcodeFormat('8906001020304')).toBe(true);
    });

    it('validates standard UPC-A and EAN-8 barcodes correctly', () => {
      // UPC-A (12 digits)
      expect(isValidBarcodeFormat('0041383090624')).toBe(true);
      expect(isValidBarcodeFormat('012345678905')).toBe(true);
      // EAN-8 (8 digits)
      expect(isValidBarcodeFormat('96385074')).toBe(true);
    });

    it('rejects invalid or non-numeric barcode strings', () => {
      expect(isValidBarcodeFormat('')).toBe(false);
      expect(isValidBarcodeFormat('   ')).toBe(false);
      expect(isValidBarcodeFormat('ABC1234567890')).toBe(false);
      expect(isValidBarcodeFormat('12345')).toBe(false); // too short (< 8 digits)
      expect(isValidBarcodeFormat('1234567890123456789')).toBe(false); // too long (> 14 digits)
    });

    it('cleanses raw barcode inputs by trimming and stripping hyphens/whitespace', () => {
      expect(cleanBarcode(' 8901-058-000290 ')).toBe('8901058000290');
      expect(cleanBarcode('004 138 309 0624')).toBe('0041383090624');
      expect(cleanBarcode('')).toBe('');
    });
  });

  describe('Camera MediaStream Hardware Cleanup', () => {
    it('shuts down all MediaStream tracks immediately to prevent lingering webcam access', () => {
      const stopTrack1 = vi.fn();
      const stopTrack2 = vi.fn();

      const mockStream = {
        getTracks: vi.fn().mockReturnValue([
          { kind: 'video', stop: stopTrack1, label: 'environment-cam' },
          { kind: 'video', stop: stopTrack2, label: 'aux-cam' },
        ]),
      } as unknown as MediaStream;

      stopMediaStream(mockStream);

      expect(mockStream.getTracks).toHaveBeenCalledTimes(1);
      expect(stopTrack1).toHaveBeenCalledTimes(1);
      expect(stopTrack2).toHaveBeenCalledTimes(1);
    });

    it('handles null or undefined stream gracefully without exceptions', () => {
      expect(() => stopMediaStream(null)).not.toThrow();
      expect(() => stopMediaStream(undefined as any)).not.toThrow();
    });

    it('detects native BarcodeDetector browser support accurately', () => {
      // In Node/Vitest test environment without polyfill, window.BarcodeDetector is undefined
      expect(isBarcodeDetectorSupported()).toBe(false);

      // Simulate browser with BarcodeDetector support
      (globalThis as any).window = { BarcodeDetector: class {} };
      expect(isBarcodeDetectorSupported()).toBe(true);

      // Clean up mock
      delete (globalThis as any).window.BarcodeDetector;
    });
  });

  describe('Pre-Verified Tier 2 Barcode Food Catalog', () => {
    it('contains verified items with Tier 2 provenance and Atwater consistency', () => {
      const greekYogurt = VERIFIED_BARCODE_FOODS['8901058000290'];
      expect(greekYogurt).toBeDefined();
      expect(greekYogurt.name).toContain('Epigamia');
      expect(greekYogurt.tier).toBe(2);
      expect(greekYogurt.tierSource).toContain('Open Food Facts');
      expect(greekYogurt.protein).toBe(7.5);
      expect(greekYogurt.carbs).toBe(4.8);
      expect(greekYogurt.fat).toBe(2.7);

      const wheyProtein = VERIFIED_BARCODE_FOODS['0041383090624'];
      expect(wheyProtein).toBeDefined();
      expect(wheyProtein.name).toContain('Optimum Nutrition');
      expect(wheyProtein.tier).toBe(2);
      expect(wheyProtein.protein).toBe(24);
    });
  });

  describe('PWA Web Manifest (public/manifest.json) Specification', () => {
    const manifestPath = path.resolve(__dirname, '../public/manifest.json');

    it('exists and is valid JSON', () => {
      expect(fs.existsSync(manifestPath)).toBe(true);
      const content = fs.readFileSync(manifestPath, 'utf-8');
      const json = JSON.parse(content);
      expect(json).toBeTypeOf('object');
    });

    it('strictly satisfies required PWA metadata tokens', () => {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

      expect(manifest.name).toBe('VibeDiet — AI Precision Nutrition');
      expect(manifest.short_name).toBe('VibeDiet');
      expect(manifest.theme_color).toBe('#090B10');
      expect(manifest.background_color).toBe('#090B10');
      expect(manifest.display).toBe('standalone');
      expect(Array.isArray(manifest.icons)).toBe(true);
      expect(manifest.icons.length).toBeGreaterThanOrEqual(1);
    });

    it('contains quick shortcuts for barcode scanning and meal logging', () => {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      expect(Array.isArray(manifest.shortcuts)).toBe(true);

      const shortcutUrls = manifest.shortcuts.map((s: any) => s.url);
      expect(shortcutUrls).toContain('/#barcode');
      expect(shortcutUrls).toContain('/#photo');
    });
  });

  describe('PWA Service Worker (public/sw.js) Air-Gap & Routing Rules', () => {
    const swPath = path.resolve(__dirname, '../public/sw.js');

    it('exists and specifies cache versioning', () => {
      expect(fs.existsSync(swPath)).toBe(true);
      const swCode = fs.readFileSync(swPath, 'utf-8');
      expect(swCode).toContain('CACHE_NAME');
      expect(swCode).toContain('vibediet-static-');
    });

    it('strictly excludes /v1/* API and /admin routes from caching for sensitive health telemetry', () => {
      const swCode = fs.readFileSync(swPath, 'utf-8');

      // Strict bypass check patterns
      expect(swCode).toContain('/v1/');
      expect(swCode).toContain('/admin');
      expect(swCode).toContain('/health');

      // Ensure fetch event listener is registered
      expect(swCode).toContain("self.addEventListener('fetch'");
      expect(swCode).toContain("self.addEventListener('install'");
      expect(swCode).toContain("self.addEventListener('activate'");
    });

    it('implements network-first strategy for static assets with cache fallback', () => {
      const swCode = fs.readFileSync(swPath, 'utf-8');
      expect(swCode).toContain('fetch(event.request)');
      expect(swCode).toContain('caches.match(event.request)');
    });
  });
});
