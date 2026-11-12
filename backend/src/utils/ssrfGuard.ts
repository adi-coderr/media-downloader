import net from 'node:net';
import dns from 'node:dns/promises';
import { AppError } from './AppError';

const DISALLOWED_HOSTNAME_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.lan',
  '.home',
  '.corp',
  '.arpa',
];

const ALLOWED_PORTS = new Set(['', '80', '443', '8080', '8443']);

/**
 * Checks whether an IPv4 or IPv6 address belongs to private, loopback,
 * link-local, multicast, documentation, or cloud metadata ranges.
 */
export function isPrivateOrReservedIP(ip: string): boolean {
  const family = net.isIP(ip);

  if (family === 4) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b, c] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8 (RFC 1918)
    if (a === 127) return true; // 127.0.0.0/8 Loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 Link-Local & Cloud Metadata (169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (RFC 1918)
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 (RFC 1918)
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // 192.0.0.0/24 & 192.0.2.0/24 TEST-NET-1
    if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return true; // Benchmark & TEST-NET-2
    if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24 TEST-NET-3
    if (a >= 224) return true; // 224.0.0.0/4 Multicast & Reserved (includes 255.255.255.255)
    return false;
  }

  if (family === 6) {
    const normalized = ip.toLowerCase().trim();

    // Check for IPv4-mapped addresses (::ffff:x.x.x.x or ::ffff:hex:hex)
    if (normalized.startsWith('::ffff:')) {
      const remainder = normalized.slice(7);
      if (net.isIP(remainder) === 4) {
        return isPrivateOrReservedIP(remainder);
      }
      const hexParts = remainder.split(':');
      if (hexParts.length === 2) {
        const h1 = parseInt(hexParts[0], 16);
        const h2 = parseInt(hexParts[1], 16);
        if (!Number.isNaN(h1) && !Number.isNaN(h2)) {
          const a = (h1 >> 8) & 0xff;
          const b = h1 & 0xff;
          const c = (h2 >> 8) & 0xff;
          const d = h2 & 0xff;
          return isPrivateOrReservedIP(`${a}.${b}.${c}.${d}`);
        }
      }
      return true;
    }

    // Any other address starting with :: is loopback (::1), unspecified (::),
    // or deprecated IPv4-compatible (e.g. ::127.0.0.1 -> ::7f00:1), all reserved/unsafe
    if (normalized.startsWith('::')) {
      return true;
    }

    if (
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    ) {
      return true; // fe80::/10 Link-local
    }
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
      return true; // fc00::/7 Unique Local
    }
    if (normalized.startsWith('ff')) {
      return true; // ff00::/8 Multicast
    }
    if (normalized.startsWith('2001:db8')) {
      return true; // Documentation
    }
    return false;
  }

  // If not a recognizable IP, treat as reserved/unsafe
  return true;
}

/**
 * Validates a user-supplied URL against Server-Side Request Forgery (SSRF).
 * Blocks private IP ranges, loopback, AWS/GCP/Azure metadata services, and local hostnames.
 * Resolves domain names via DNS to prevent DNS rebinding attacks.
 */
export async function assertSafeMediaUrl(urlString: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new AppError('Invalid URL format.', 422);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError('Only http:// and https:// URLs are supported.', 422);
  }

  if (!ALLOWED_PORTS.has(parsed.port)) {
    throw new AppError(`Port ${parsed.port} is not permitted.`, 403);
  }

  const hostname = parsed.hostname.toLowerCase().trim();
  if (!hostname) {
    throw new AppError('URL must contain a valid host.', 422);
  }

  // IPv6 bracket normalization (e.g. [::1] -> ::1)
  const cleanHostname =
    hostname.startsWith('[') && hostname.endsWith(']')
      ? hostname.slice(1, -1).trim()
      : hostname;

  if (
    cleanHostname === 'localhost' ||
    DISALLOWED_HOSTNAME_SUFFIXES.some((suffix) => cleanHostname.endsWith(suffix))
  ) {
    throw new AppError('Access to local network hosts is strictly prohibited.', 403);
  }

  // If hostname is directly an IP literal (e.g. 127.0.0.1 or ::1)
  if (net.isIP(cleanHostname)) {
    if (isPrivateOrReservedIP(cleanHostname)) {
      throw new AppError(
        'Access to private, loopback, or cloud metadata addresses is strictly prohibited.',
        403,
      );
    }
    return parsed.toString();
  }

  // Resolve hostname via DNS to prevent DNS rebinding or private IP pointing
  let resolvedAddresses: { address: string; family: number }[];
  try {
    resolvedAddresses = await dns.lookup(cleanHostname, { all: true });
  } catch (err: any) {
    const code = err?.code;
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
      throw new AppError('The specified host could not be resolved.', 422);
    }
    throw new AppError('Failed to verify host reachability.', 422);
  }

  if (!resolvedAddresses || resolvedAddresses.length === 0) {
    throw new AppError('Host resolution failed.', 422);
  }

  for (const { address } of resolvedAddresses) {
    if (isPrivateOrReservedIP(address)) {
      throw new AppError(
        'Access to private, loopback, or cloud metadata network addresses is strictly prohibited.',
        403,
      );
    }
  }

  return parsed.toString();
}
