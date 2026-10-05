import { lookup } from 'node:dns/promises'
import net from 'node:net'

/**
 * Validates URLs that come from external data before they are stored or
 * shown. Only https URLs on an allow-listed host are accepted; IP literals,
 * credentials and non-standard ports are rejected.
 */
export function safeExternalUrl(raw: string | null | undefined, allowedHostSuffixes: string[]): string | null {
  if (!raw) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null
  if (url.port && url.port !== '443') return null
  const host = url.hostname.toLowerCase()
  if (net.isIP(host.replace(/^\[|\]$/g, ''))) return null
  if (!allowedHostSuffixes.some((s) => host === s || host.endsWith(`.${s}`))) return null
  return url.toString()
}

const PRIVATE_V4 = [/^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./]

export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return PRIVATE_V4.some((r) => r.test(ip))
  const v6 = ip.toLowerCase()
  return v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80') || v6.startsWith('::ffff:') && isPrivateAddress(v6.slice(7))
}

/**
 * SSRF guard for server-side fetches of operator-configured URLs (product
 * feeds): https only and the host must not resolve to a private address.
 */
export async function assertFetchable(raw: string) {
  const url = new URL(raw)
  if (url.protocol !== 'https:') throw new Error('Feed URLs must use https')
  if (net.isIP(url.hostname)) throw new Error('Feed URLs must use a hostname')
  const addrs = await lookup(url.hostname, { all: true })
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error('Feed host resolves to a private address')
  return url
}
