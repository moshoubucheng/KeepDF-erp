/**
 * PasswordService — PBKDF2-SHA256 password hashing using Web Crypto API
 * Format: "{salt_hex}:{hash_hex}" (16-byte salt, 100k iterations, 32-byte output)
 */
export class PasswordService {
    private static readonly ITERATIONS = 100_000
    private static readonly SALT_BYTES = 16
    private static readonly HASH_BYTES = 32

    static async hash(password: string): Promise<string> {
        const salt = crypto.getRandomValues(new Uint8Array(this.SALT_BYTES))
        const hash = await this.pbkdf2(password, salt)
        return `${this.toHex(salt)}:${this.toHex(new Uint8Array(hash))}`
    }

    static async verify(password: string, stored: string): Promise<boolean> {
        const parts = stored.split(':')
        if (parts.length !== 2) return false
        const salt = this.fromHex(parts[0])
        const expectedHash = parts[1]
        const hash = await this.pbkdf2(password, salt)
        return this.toHex(new Uint8Array(hash)) === expectedHash
    }

    private static async pbkdf2(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
        const key = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(password),
            'PBKDF2',
            false,
            ['deriveBits'],
        )
        return crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: this.ITERATIONS, hash: 'SHA-256' },
            key,
            this.HASH_BYTES * 8,
        )
    }

    private static toHex(bytes: Uint8Array): string {
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    }

    private static fromHex(hex: string): Uint8Array {
        const bytes = new Uint8Array(hex.length / 2)
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
        }
        return bytes
    }
}
