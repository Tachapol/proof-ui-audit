import { describe, it, expect } from 'vitest';
import { validateAndNormalizeAuditUrl, isPrivateOrReservedIP } from '../url-validator';

describe('Audit URL Validation & Advanced SSRF Rejection (TEST-22)', () => {
  it('identifies private IPv4 and reserved ranges correctly', () => {
    expect(isPrivateOrReservedIP('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIP('10.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIP('192.168.1.1')).toBe(true);
    expect(isPrivateOrReservedIP('172.20.0.1')).toBe(true);
    expect(isPrivateOrReservedIP('169.254.169.254')).toBe(true);
    expect(isPrivateOrReservedIP('8.8.8.8')).toBe(false);
    expect(isPrivateOrReservedIP('93.184.216.34')).toBe(false);
  });

  it('identifies IPv6 loopback, link-local, and IPv4-mapped IPv6 ranges (Item A.3)', () => {
    expect(isPrivateOrReservedIP('::1')).toBe(true);
    expect(isPrivateOrReservedIP('[::1]')).toBe(true);
    expect(isPrivateOrReservedIP('fe80::1')).toBe(true);
    expect(isPrivateOrReservedIP('fc00::1')).toBe(true);
    expect(isPrivateOrReservedIP('fd12:3456:789a::1')).toBe(true);

    // IPv4-mapped IPv6
    expect(isPrivateOrReservedIP('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIP('::ffff:10.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIP('::ffff:169.254.169.254')).toBe(true);
    expect(isPrivateOrReservedIP('::ffff:192.168.0.1')).toBe(true);
    expect(isPrivateOrReservedIP('::ffff:8.8.8.8')).toBe(false);
  });

  it('accepts valid public domain with DNS resolution', async () => {
    const res = await validateAndNormalizeAuditUrl('https://example.com');
    expect(res.valid).toBe(true);
    expect(res.isFixture).toBe(false);
    expect(res.resolvedIP).toBeDefined();
    expect(isPrivateOrReservedIP(res.resolvedIP!)).toBe(false);
  });

  it('accepts fixture identifiers without network lookup', async () => {
    const res1 = await validateAndNormalizeAuditUrl('target-size-demo');
    expect(res1.valid).toBe(true);
    expect(res1.isFixture).toBe(true);
    expect(res1.fixtureId).toBe('target-size-demo');

    const res2 = await validateAndNormalizeAuditUrl('fixture://reflow-demo');
    expect(res2.valid).toBe(true);
    expect(res2.isFixture).toBe(true);
  });

  it('rejects localhost, 127.0.0.1, and cloud metadata targets', async () => {
    const res1 = await validateAndNormalizeAuditUrl('http://localhost:8080');
    expect(res1.valid).toBe(false);
    expect(res1.error).toContain('Security restriction');

    const res2 = await validateAndNormalizeAuditUrl('http://169.254.169.254/latest/meta-data/');
    expect(res2.valid).toBe(false);
    expect(res2.error).toContain('Security restriction');
  });

  it('rejects URLs containing embedded credentials', async () => {
    const res = await validateAndNormalizeAuditUrl('https://user:password@example.com');
    expect(res.valid).toBe(false);
    expect(res.error).toContain('credentials');
  });
});
