/**
 * TOTPService — RFC 6238 TOTP using Web Crypto API
 * HMAC-SHA1, 6 digits, 30s step, window ±1
 */
export class TOTPService {
    private static readonly STEP = 30
    private static readonly DIGITS = 6

    /** Generate a random 20-byte secret, returned as Base32 */
    static generateSecret(): string {
        const bytes = crypto.getRandomValues(new Uint8Array(20))
        return this.base32Encode(bytes)
    }

    /** Generate a TOTP code for the given secret and time */
    static async generateCode(secret: string, time?: number): Promise<string> {
        const t = time ?? Math.floor(Date.now() / 1000)
        const timeStep = Math.floor(t / this.STEP)
        return this.computeCode(secret, timeStep)
    }

    /** Verify a TOTP code within ±window time steps */
    static async verify(secret: string, code: string, window: number = 1): Promise<boolean> {
        const t = Math.floor(Date.now() / 1000)
        const timeStep = Math.floor(t / this.STEP)

        for (let i = -window; i <= window; i++) {
            const expected = await this.computeCode(secret, timeStep + i)
            if (expected === code) return true
        }
        return false
    }

    /** Generate otpauth:// URI for QR code display */
    static generateOtpAuthUri(secret: string, username: string): string {
        const issuer = 'KeepDF'
        const label = encodeURIComponent(`${issuer}:${username}`)
        return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${this.DIGITS}&period=${this.STEP}`
    }

    private static async computeCode(secret: string, timeStep: number): Promise<string> {
        const secretBytes = this.base32Decode(secret)
        const timeBytes = new Uint8Array(8)
        let ts = timeStep
        for (let i = 7; i >= 0; i--) {
            timeBytes[i] = ts & 0xff
            ts = Math.floor(ts / 256)
        }

        const key = await crypto.subtle.importKey(
            'raw',
            secretBytes.buffer as ArrayBuffer,
            { name: 'HMAC', hash: 'SHA-1' },
            false,
            ['sign'],
        )
        const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, timeBytes.buffer as ArrayBuffer))

        // Dynamic truncation
        const offset = sig[sig.length - 1] & 0x0f
        const code =
            ((sig[offset] & 0x7f) << 24) |
            ((sig[offset + 1] & 0xff) << 16) |
            ((sig[offset + 2] & 0xff) << 8) |
            (sig[offset + 3] & 0xff)

        const otp = code % Math.pow(10, this.DIGITS)
        return otp.toString().padStart(this.DIGITS, '0')
    }

    private static base32Encode(bytes: Uint8Array): string {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
        let bits = ''
        for (const b of bytes) bits += b.toString(2).padStart(8, '0')
        let result = ''
        for (let i = 0; i < bits.length; i += 5) {
            const chunk = bits.substring(i, i + 5).padEnd(5, '0')
            result += alphabet[parseInt(chunk, 2)]
        }
        return result
    }

    private static base32Decode(encoded: string): Uint8Array {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
        let bits = ''
        for (const c of encoded.toUpperCase()) {
            const idx = alphabet.indexOf(c)
            if (idx === -1) continue
            bits += idx.toString(2).padStart(5, '0')
        }
        const bytes = new Uint8Array(Math.floor(bits.length / 8))
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(bits.substring(i * 8, i * 8 + 8), 2)
        }
        return bytes
    }
}
