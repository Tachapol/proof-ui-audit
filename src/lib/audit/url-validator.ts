import dns from 'dns/promises';
import { FIXTURES } from '@/fixtures/fixture-registry';

export interface URLValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  error?: string;
  isFixture?: boolean;
  fixtureId?: string;
  resolvedIP?: string;
  localOrigin?: string;
}

export function isPrivateOrReservedIP(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return true;
  const cleanIp = ip.trim().toLowerCase();

  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (cleanIp.startsWith('::ffff:')) {
    const mappedPart = cleanIp.slice(7);
    if (mappedPart.includes('.')) {
      return isPrivateOrReservedIP(mappedPart);
    }
    // Hex representation e.g. ::ffff:7f00:1
    const hexParts = mappedPart.split(':');
    if (hexParts.length === 2) {
      const p1 = parseInt(hexParts[0], 16);
      const p2 = parseInt(hexParts[1], 16);
      const a = (p1 >> 8) & 0xff;
      const b = p1 & 0xff;
      const c = (p2 >> 8) & 0xff;
      const d = p2 & 0xff;
      return isPrivateOrReservedIP(`${a}.${b}.${c}.${d}`);
    }
  }

  // IPv4 check
  const ipv4Match = cleanIp.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [a, b, c, d] = ipv4Match.slice(1, 5).map(Number);
    if ([a, b, c, d].some((octet) => octet < 0 || octet > 255)) return true;

    // 0.0.0.0/8 (Current network)
    if (a === 0) return true;
    // 10.0.0.0/8 (Private)
    if (a === 10) return true;
    // 100.64.0.0/10 (Shared Address / CGNAT)
    if (a === 100 && b >= 64 && b <= 127) return true;
    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;
    // 169.254.0.0/16 (Link-local & Cloud Metadata 169.254.169.254)
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12 (Private 172.16.0.0 - 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.0.0.0/24 (IETF Protocol Assignments)
    if (a === 192 && b === 0 && c === 0) return true;
    // 192.168.0.0/16 (Private)
    if (a === 192 && b === 168) return true;
    // 198.18.0.0/15 (Benchmarking)
    if (a === 198 && (b === 18 || b === 19)) return true;
    // 224.0.0.0/4 (Multicast)
    if (a >= 224 && a <= 239) return true;
    // 240.0.0.0/4 (Reserved / Future Use)
    if (a >= 240) return true;

    return false;
  }

  // IPv6 check
  const cleanV6 = cleanIp.replace(/^\[|\]$/g, '');
  if (cleanV6 === '::' || cleanV6 === '::1') return true;
  if (cleanV6.startsWith('fe8') || cleanV6.startsWith('fe9') || cleanV6.startsWith('fea') || cleanV6.startsWith('feb')) return true; // fe80::/10 link-local
  if (cleanV6.startsWith('fc') || cleanV6.startsWith('fd')) return true; // fc00::/7 unique local
  if (cleanV6.startsWith('2001:db8:')) return true; // Documentation
  if (cleanV6.startsWith('64:ff9b:')) return true; // NAT64

  return false;
}

export type DnsLookupResult = Array<{ address: string; family: number }>;
export type DnsLookupFn = (hostname: string, options: { all: true }) => Promise<DnsLookupResult>;

export async function validateAndNormalizeAuditUrl(
  input: string,
  devServerBaseUrl = 'http://localhost:3123',
  dnsLookup: DnsLookupFn = (h, opts) => dns.lookup(h, opts),
  options: { allowLocalhost?: boolean } = {}
): Promise<URLValidationResult> {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: 'Target URL or fixture identifier is required.' };
  }

  const trimmed = input.trim();

  // 1. Local fixture identifier resolution
  const matchingFixture = FIXTURES.find(
    (f) => f.id === trimmed || f.path === trimmed || trimmed === `fixture://${f.id}`
  );

  if (matchingFixture) {
    return {
      valid: true,
      normalizedUrl: `${devServerBaseUrl}${matchingFixture.path}`,
      isFixture: true,
      fixtureId: matchingFixture.id,
    };
  }

  // Handle local fixture URL path
  if (trimmed.startsWith('/fixtures/')) {
    const fixtureId = trimmed.replace('/fixtures/', '').split('/')[0].split('?')[0];
    const exists = FIXTURES.some((f) => f.id === fixtureId);
    if (exists) {
      return {
        valid: true,
        normalizedUrl: `${devServerBaseUrl}${trimmed}`,
        isFixture: true,
        fixtureId,
      };
    }
  }

  // 2. Syntax & protocol normalization
  let parsed: URL;
  try {
    const urlWithProtocol = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
    parsed = new URL(urlWithProtocol);
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: `Protocol "${parsed.protocol}" is not supported. Use http or https.` };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: 'Authenticated URLs containing user credentials are not permitted.' };
  }

  // Internal fixture check
  const isInternalFixture =
    parsed.origin === devServerBaseUrl && parsed.pathname.startsWith('/fixtures/');

  if (isInternalFixture) {
    const fixtureId = parsed.pathname.replace('/fixtures/', '').split('/')[0];
    const exists = FIXTURES.some((f) => f.id === fixtureId);
    if (exists) {
      return {
        valid: true,
        normalizedUrl: parsed.toString(),
        isFixture: true,
        fixtureId,
      };
    }
  }

  const hostname = parsed.hostname.toLowerCase();

  // Explicit loopback development target only; never allow LAN or metadata addresses.
  if (options.allowLocalhost && ['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
    return { valid:true, normalizedUrl:parsed.toString(), isFixture:false, localOrigin:parsed.origin };
  }

  // Block localhost names
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return {
      valid: false,
      error: 'Security restriction: Access to localhost is blocked.',
    };
  }

  // Direct IP literal check
  if (isPrivateOrReservedIP(hostname)) {
    return {
      valid: false,
      error: 'Security restriction: Access to private networks, metadata endpoints, or loopback is blocked.',
    };
  }

  // 3. DNS resolution validation (SSRF DNS-rebinding protection)
  try {
    const lookupResult = await dnsLookup(hostname, { all: true });
    if (!Array.isArray(lookupResult) || lookupResult.length === 0) {
      return {
        valid: false,
        error: `DNS resolution failed for host ${hostname}: Ambiguous or empty resolution`,
      };
    }
    for (const address of lookupResult) {
      if (!address.address || isPrivateOrReservedIP(address.address)) {
        return {
          valid: false,
          error: `Security restriction: Domain ${hostname} resolves to blocked IP ${address?.address || 'unknown'}.`,
        };
      }
    }

    return {
      valid: true,
      normalizedUrl: parsed.toString(),
      isFixture: false,
      resolvedIP: lookupResult[0]?.address,
    };
  } catch (err: any) {
    return {
      valid: false,
      error: `DNS resolution failed for host ${hostname}: ${err.message || 'Host unreachable'}`,
    };
  }
}
