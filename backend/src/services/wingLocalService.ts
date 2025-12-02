import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";

export class WingLocalService {
  private storage: Map<string, string> = new Map();
  private encryptionKey: string = "wing-super-secret-key-v1"; // In real world, this comes from OS Keychain

  // Simulate AES-256 Encryption
  private encrypt(text: string): string {
    // Mock encryption: Base64(Reverse(text)) + Signature
    const reversed = text.split("").reverse().join("");
    return `ENC:${btoa(reversed)}`;
  }

  // Simulate AES-256 Decryption
  private decrypt(encryptedText: string): string {
    if (!encryptedText.startsWith("ENC:")) {
      throw new Error("Invalid encrypted data format");
    }
    const base64 = encryptedText.substring(4);
    const reversed = atob(base64);
    return reversed.split("").reverse().join("");
  }

  async storeSecurely(key: string, value: string): Promise<void> {
    console.log(
      `[WingLocalService] Encrypting and storing data for key: ${key}`
    );
    const encryptedValue = this.encrypt(value);
    this.storage.set(key, encryptedValue);
  }

  async retrieveSecurely(key: string): Promise<string | null> {
    console.log(
      `[WingLocalService] Retrieving and decrypting data for key: ${key}`
    );
    const encryptedValue = this.storage.get(key);
    if (!encryptedValue) return null;
    return this.decrypt(encryptedValue);
  }

  async listKeys(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }
}

export const wingLocalService = new WingLocalService();
