import nacl from 'tweetnacl';

export class VeritasCrypto {
  /**
   * Generates a SHA-256 hash for the provided buffer.
   */
  static async hashSHA256(buffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generates a new Ed25519 keypair.
   */
  static generateKeypair() {
    return nacl.sign.keyPair();
  }

  /**
   * Converts a Uint8Array to a hex string.
   */
  static toHex(buffer: Uint8Array): string {
    return Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Converts a hex string back to a Uint8Array.
   */
  static fromHex(hex: string): Uint8Array {
    const match = hex.match(/.{1,2}/g);
    if (!match) return new Uint8Array();
    return new Uint8Array(match.map(byte => parseInt(byte, 16)));
  }

  /**
   * Signs a string payload using an Ed25519 secret key.
   * Returns the signature as a hex string.
   */
  static sign(payload: string, secretKey: Uint8Array): string {
    const encoder = new TextEncoder();
    const messageUint8 = encoder.encode(payload);
    const signature = nacl.sign.detached(messageUint8, secretKey);
    return this.toHex(signature);
  }
}
