/**
 * Platform Detection Utilities
 * Strategic Minimalism: Simple filename-based platform detection
 */

export function detectPlatformFromFilename(filename) {
  const lower = filename.toLowerCase();
  if (lower.includes('ezpay')) return 'ezpay';
  if (lower.includes('ecpay')) return 'ecpay';
  if (lower.includes('opay')) return 'opay';
  if (lower.includes('smilepay')) return 'smilepay';
  if (lower.includes('amego')) return 'amego';
  return 'unknown';
}