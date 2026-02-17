/**
 * PushService — Web Push Notifications (RFC 8030 + RFC 8291 + VAPID)
 *
 * Uses Web Crypto API (available in Cloudflare Workers) for:
 * - VAPID JWT signing (ES256 / P-256)
 * - Payload encryption (ECDH + HKDF + AES-128-GCM per RFC 8291)
 */

interface PushSubscription {
  id: number
  distributor_id: number
  endpoint: string
  p256dh: string
  auth: string
  user_agent: string | null
  created_at: string
}

interface PushPayload {
  title: string
  body: string
  icon?: string
  url?: string
  tag?: string
}

export class PushService {
  constructor(
    private db: D1Database,
    private vapidPublicKey: string,
    private vapidPrivateKey: string,
  ) {}

  // ── Subscription CRUD ──

  async subscribe(params: {
    distributorId: number
    endpoint: string
    p256dh: string
    auth: string
    userAgent?: string
  }): Promise<void> {
    await this.db.prepare(
      `INSERT INTO push_subscriptions (distributor_id, endpoint, p256dh, auth, user_agent)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(distributor_id, endpoint) DO UPDATE SET p256dh = ?, auth = ?, user_agent = ?`
    ).bind(
      params.distributorId,
      params.endpoint,
      params.p256dh,
      params.auth,
      params.userAgent ?? null,
      params.p256dh,
      params.auth,
      params.userAgent ?? null,
    ).run()
  }

  async unsubscribe(distributorId: number, endpoint: string): Promise<boolean> {
    const { meta } = await this.db.prepare(
      'DELETE FROM push_subscriptions WHERE distributor_id = ? AND endpoint = ?'
    ).bind(distributorId, endpoint).run()
    return (meta.changes ?? 0) > 0
  }

  async getSubscriptions(distributorId: number): Promise<PushSubscription[]> {
    const { results } = await this.db.prepare(
      'SELECT * FROM push_subscriptions WHERE distributor_id = ?'
    ).bind(distributorId).all<PushSubscription>()
    return results
  }

  // ── Send push notification to a distributor ──

  async sendToDistributor(distributorId: number, payload: PushPayload): Promise<{ sent: number; failed: number }> {
    const subs = await this.getSubscriptions(distributorId)
    let sent = 0
    let failed = 0

    for (const sub of subs) {
      try {
        const success = await this.sendPush(sub, payload)
        if (success) {
          sent++
        } else {
          // Subscription expired — clean up
          await this.unsubscribe(distributorId, sub.endpoint)
          failed++
        }
      } catch (e) {
        console.error(`[PUSH] Failed to send to ${sub.endpoint}:`, e)
        failed++
      }
    }

    return { sent, failed }
  }

  // ── Core push sending ──

  private async sendPush(sub: PushSubscription, payload: PushPayload): Promise<boolean> {
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload))

    // Encrypt payload per RFC 8291
    const encrypted = await this.encryptPayload(payloadBytes, sub.p256dh, sub.auth)

    // Create VAPID headers
    const vapidHeaders = await this.createVapidHeaders(sub.endpoint)

    const response = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Content-Length': String(encrypted.byteLength),
        TTL: '86400',
        ...vapidHeaders,
      },
      body: encrypted,
    })

    if (response.status === 201) return true
    if (response.status === 410 || response.status === 404) return false // Gone — subscription expired
    if (response.status >= 400) {
      const text = await response.text().catch(() => '')
      console.error(`[PUSH] HTTP ${response.status}: ${text}`)
      return false
    }
    return true
  }

  // ── VAPID JWT (ES256) ──

  private async createVapidHeaders(endpoint: string): Promise<{ Authorization: string; 'Crypto-Key': string }> {
    const audience = new URL(endpoint).origin

    // JWT header + payload
    const header = { typ: 'JWT', alg: 'ES256' }
    const now = Math.floor(Date.now() / 1000)
    const jwtPayload = {
      aud: audience,
      exp: now + 86400,
      sub: 'mailto:admin@keepdf.com',
    }

    const headerB64 = base64urlEncode(JSON.stringify(header))
    const payloadB64 = base64urlEncode(JSON.stringify(jwtPayload))
    const unsignedToken = `${headerB64}.${payloadB64}`

    // Import VAPID private key (supports both PKCS8 and raw 32-byte formats)
    const privateKeyBytes = base64urlDecode(this.vapidPrivateKey)
    let key: CryptoKey
    if (privateKeyBytes.length === 32) {
      // Raw 32-byte private key — wrap into PKCS8 for import
      key = await crypto.subtle.importKey(
        'pkcs8',
        toAB(rawToPkcs8(privateKeyBytes)),
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign'],
      )
    } else {
      key = await crypto.subtle.importKey(
        'pkcs8',
        toAB(privateKeyBytes),
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign'],
      )
    }

    // Sign
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      new TextEncoder().encode(unsignedToken),
    )

    // Convert DER signature to raw (r || s)
    const rawSig = derToRaw(new Uint8Array(signature))
    const jwt = `${unsignedToken}.${arrayToBase64url(rawSig)}`

    return {
      Authorization: `vapid t=${jwt}, k=${this.vapidPublicKey}`,
      'Crypto-Key': `p256ecdsa=${this.vapidPublicKey}`,
    }
  }

  // ── RFC 8291 Payload Encryption (ECDH + HKDF + AES-128-GCM) ──

  private async encryptPayload(
    plaintext: Uint8Array,
    p256dhB64: string,
    authB64: string,
  ): Promise<ArrayBuffer> {
    // Decode subscriber's public key and auth secret
    const subscriberPubKeyBytes = base64urlDecode(p256dhB64)
    const authSecret = base64urlDecode(authB64)

    // Import subscriber's public key
    const subscriberPubKey = await crypto.subtle.importKey(
      'raw',
      toAB(subscriberPubKeyBytes),
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    )

    // Generate ephemeral ECDH key pair
    const ephemeralKey = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    )

    // Export ephemeral public key
    const ephemeralPubKeyRaw = new Uint8Array(
      await crypto.subtle.exportKey('raw', ephemeralKey.publicKey),
    )

    // ECDH shared secret
    const sharedSecret = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: 'ECDH', public: subscriberPubKey },
        ephemeralKey.privateKey,
        256,
      ),
    )

    // HKDF: auth_secret + shared_secret → PRK
    const prkKey = await crypto.subtle.importKey('raw', toAB(authSecret), { name: 'HKDF' }, false, ['deriveBits'])
    const ikm = concat(
      new TextEncoder().encode('WebPush: info\x00'),
      subscriberPubKeyBytes,
      ephemeralPubKeyRaw,
    )
    // Derive IKM via HKDF with auth as salt, info = "Content-Encoding: auth\0"
    const authInfo = new TextEncoder().encode('Content-Encoding: auth\x00')
    const ikmBits = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt: toAB(sharedSecret), info: toAB(authInfo) },
        prkKey,
        256,
      ),
    )

    // Import IKM for final HKDF
    const ikmKey = await crypto.subtle.importKey('raw', toAB(ikmBits), { name: 'HKDF' }, false, ['deriveBits'])

    // Derive CEK (Content Encryption Key) — 16 bytes
    const cekInfo = concat(
      new TextEncoder().encode('Content-Encoding: aes128gcm\x00'),
    )
    const cek = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt: toAB(authSecret), info: toAB(cekInfo) },
        ikmKey,
        128,
      ),
    )

    // Derive nonce — 12 bytes
    const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\x00')
    const nonce = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt: toAB(authSecret), info: toAB(nonceInfo) },
        ikmKey,
        96,
      ),
    )

    // Import CEK as AES-GCM key
    const aesKey = await crypto.subtle.importKey('raw', toAB(cek), { name: 'AES-GCM' }, false, ['encrypt'])

    // Add padding delimiter (0x02) as per RFC 8291
    const padded = concat(plaintext, new Uint8Array([2]))

    // Encrypt
    const encrypted = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toAB(nonce) }, aesKey, toAB(padded)),
    )

    // Build aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65) + encrypted
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const rsBuf = new ArrayBuffer(4)
    new DataView(rsBuf).setUint32(0, 4096)
    const rs = new Uint8Array(rsBuf)

    const header = concat(
      salt,
      rs,
      new Uint8Array([ephemeralPubKeyRaw.length]),
      ephemeralPubKeyRaw,
    )

    return toAB(concat(header, encrypted))
  }
}

// ── Utility functions ──

/** Convert Uint8Array to ArrayBuffer (fixes TS 5.7+ Uint8Array<ArrayBufferLike> incompatibility with Web Crypto API) */
function toAB(data: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(data.byteLength)
  new Uint8Array(buf).set(data)
  return buf
}

function base64urlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4)
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function arrayToBase64url(arr: Uint8Array): string {
  let binary = ''
  for (const byte of arr) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

/** Wrap a raw 32-byte EC private key into PKCS8 DER format for P-256 */
function rawToPkcs8(raw: Uint8Array): Uint8Array {
  // PKCS8 prefix for EC P-256 private key (RFC 5958 / 5915)
  const prefix = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06,
    0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01,
    0x01, 0x04, 0x20,
  ])
  return concat(prefix, raw)
}

/** Convert DER-encoded ECDSA signature to raw (r || s) format */
function derToRaw(der: Uint8Array): Uint8Array {
  // Simple DER parser for SEQUENCE { INTEGER r, INTEGER s }
  if (der[0] !== 0x30) return der // Not DER, return as-is

  let offset = 2
  if (der[1] & 0x80) offset++ // Long form length

  // Parse r
  if (der[offset] !== 0x02) return der
  offset++
  const rLen = der[offset++]
  let rStart = offset
  let rActualLen = rLen
  // Skip leading zero
  if (der[rStart] === 0x00 && rLen > 32) {
    rStart++
    rActualLen--
  }
  offset += rLen

  // Parse s
  if (der[offset] !== 0x02) return der
  offset++
  const sLen = der[offset++]
  let sStart = offset
  let sActualLen = sLen
  if (der[sStart] === 0x00 && sLen > 32) {
    sStart++
    sActualLen--
  }

  // Build raw: pad to 32 bytes each
  const raw = new Uint8Array(64)
  raw.set(der.slice(rStart, rStart + Math.min(rActualLen, 32)), 32 - Math.min(rActualLen, 32))
  raw.set(der.slice(sStart, sStart + Math.min(sActualLen, 32)), 64 - Math.min(sActualLen, 32))

  return raw
}
