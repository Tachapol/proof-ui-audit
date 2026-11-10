import { describe, it, expect } from 'vitest';
import {
  validateAndNormalizeAuditUrl,
  isPrivateOrReservedIP,
  DnsLookupFn,
} from '../url-validator';

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

  describe('Hermetic DNS Resolution & SSRF Protection', () => {
    it('accepts public hostname resolving to a mocked public IP', async () => {
      const mockDns: DnsLookupFn = async () => [
        { address: '93.184.216.34', family: 4 },
      ];
      const res = await validateAndNormalizeAuditUrl(
        'https://example.com',
        'http://localhost:3123',
        mockDns
      );
      expect(res.valid).toBe(true);
      expect(res.isFixture).toBe(false);
      expect(res.resolvedIP).toBe('93.184.216.34');
      expect(isPrivateOrReservedIP(res.resolvedIP!)).toBe(false);
    });

    it('rejects hostname resolving to a mocked private IP', async () => {
      const mockDns: DnsLookupFn = async () => [
        { address: '10.0.0.1', family: 4 },
      ];
      const res = await validateAndNormalizeAuditUrl(
        'https://internal.corp',
        'http://localhost:3123',
        mockDns
      );
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Security restriction');
      expect(res.error).toContain('resolves to blocked IP 10.0.0.1');
    });

    it('rejects multiple resolved IPs including one blocked address (DNS rebinding)', async () => {
      const mockDns: DnsLookupFn = async () => [
        { address: '93.184.216.34', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ];
      const res = await validateAndNormalizeAuditUrl(
        'https://dual-homed.example.com',
        'http://localhost:3123',
        mockDns
      );
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Security restriction');
      expect(res.error).toContain('resolves to blocked IP 127.0.0.1');
    });

    it('handles DNS lookup failure gracefully without unhandled exception', async () => {
      const mockDns: DnsLookupFn = async () => {
        const err = new Error('getaddrinfo ENOTFOUND non-existent-domain.xyz');
        throw err;
      };
      const res = await validateAndNormalizeAuditUrl(
        'https://non-existent-domain.xyz',
        'http://localhost:3123',
        mockDns
      );
      expect(res.valid).toBe(false);
      expect(res.error).toContain('DNS resolution failed');
      expect(res.error).toContain('ENOTFOUND');
    });

    it('rejects ambiguous resolution with empty or invalid lookup results', async () => {
      const mockDns: DnsLookupFn = async () => [];
      const res = await validateAndNormalizeAuditUrl(
        'https://ambiguous.example.com',
        'http://localhost:3123',
        mockDns
      );
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Ambiguous or empty resolution');
    });
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


describe('Explicit localhost audit opt-in', () => {
 it('allows only exact loopback hosts when opted in',async()=>{
  const dnsLookup:DnsLookupFn=async()=>[{address:'192.168.1.2',family:4}];
  for(const host of ['localhost:3210','127.0.0.1:3210','[::1]:3210']) {
   const result=await validateAndNormalizeAuditUrl('http://'+host+'/design','http://localhost:3123',dnsLookup,{allowLocalhost:true});
   expect(result.valid).toBe(true);expect(result.localOrigin).toBe('http://'+host);
  }
  for(const host of ['192.168.1.2','169.254.169.254','internal.example','app.localhost']) {
   const result=await validateAndNormalizeAuditUrl('http://'+host,'http://localhost:3123',dnsLookup,{allowLocalhost:true});
   expect(result.valid).toBe(false);
  }
 });
 it('still blocks loopback by default and URLs with credentials',async()=>{
  expect((await validateAndNormalizeAuditUrl('http://localhost:3210')).valid).toBe(false);
  expect((await validateAndNormalizeAuditUrl('http://user:password@localhost:3210','http://localhost:3123',undefined,{allowLocalhost:true})).valid).toBe(false);
 });
});
