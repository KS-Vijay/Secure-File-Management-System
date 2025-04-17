import CryptoJS from 'crypto-js';

/**
 * Enhanced encryption and decryption utilities
 */

interface EncryptionResult {
  encryptedFile: File;
  algorithm: string;
  encryptionKey: string;
  iv: string;
  checksum: string;
}

interface DecryptionResult {
  success: boolean;
  file?: File;
  error?: string;
}

/**
 * Encrypts a file using AES-256 algorithm
 * @param file File to encrypt
 * @returns Promise with encrypted file and metadata
 */
export const encryptFile = async (file: File): Promise<EncryptionResult> => {
  try {
    // Convert file to array buffer
    const fileBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(fileBuffer);
    
    // Generate random encryption key and IV
    const keyBytes = CryptoJS.lib.WordArray.random(32); // 256 bits for AES-256
    const ivBytes = CryptoJS.lib.WordArray.random(16); // 128 bits for IV
    
    // Convert to string for storage
    const key = CryptoJS.enc.Base64.stringify(keyBytes);
    const iv = CryptoJS.enc.Base64.stringify(ivBytes);
    
    // Combine key and IV into a single string with a separator
    const combinedKey = `${key}.${iv}`;
    
    // Convert the file data to a WordArray that CryptoJS can use
    const wordArray = arrayBufferToWordArray(fileBuffer);
    
    // Encrypt the file
    const encrypted = CryptoJS.AES.encrypt(wordArray, keyBytes, { 
      iv: ivBytes, 
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    // Convert the encrypted data to bytes
    const encryptedBytes = base64ToArrayBuffer(encrypted.toString());
    
    // Create a new file with encrypted data
    const encryptedFile = new File([encryptedBytes], `${file.name}.enc`, {
      type: 'application/octet-stream'
    });
    
    // Calculate checksum of original file
    const checksum = await calculateChecksum(file);
    
    console.log("Encryption successful, combined key generated:", combinedKey);
    
    return {
      encryptedFile,
      algorithm: 'AES-256-CBC',
      encryptionKey: combinedKey,
      iv: iv,
      checksum
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt file');
  }
};

/**
 * Decrypts an encrypted file
 * @param encryptedFile Encrypted file
 * @param keyString Combined Base64 encryption key with IV (format: "key.iv")
 * @param ivString Optional Base64 IV if not included in keyString
 * @returns Promise with decrypted file
 */
export const decryptFile = async (
  encryptedFile: File, 
  keyString: string, 
  ivString?: string
): Promise<File> => {
  try {
    console.log("Starting decryption with combined key:", keyString);
    
    // Convert file to array buffer
    const fileBuffer = await encryptedFile.arrayBuffer();
    
    // Parse key and IV from the combined string
    let actualKey = keyString;
    let actualIv = ivString || '';
    
    // If the key contains a dot, it's a combined key+IV
    if (keyString.includes('.') && !ivString) {
      const parts = keyString.split('.');
      if (parts.length >= 2) {
        actualKey = parts[0];
        // Last part is the IV
        actualIv = parts[parts.length - 1];
      }
    }
    
    console.log("Parsed key:", actualKey, "IV:", actualIv);
    
    // Parse key and IV
    const keyBytes = CryptoJS.enc.Base64.parse(actualKey);
    const ivBytes = CryptoJS.enc.Base64.parse(actualIv);
    
    // Convert encrypted data to base64 string for CryptoJS
    const encryptedBase64 = arrayBufferToBase64(fileBuffer);
    
    // Decrypt the data
    const decrypted = CryptoJS.AES.decrypt(encryptedBase64, keyBytes, {
      iv: ivBytes,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    // Convert the decrypted data to bytes
    const decryptedArrayBuffer = wordArrayToArrayBuffer(decrypted);
    
    // Create original filename (remove .enc extension if present)
    const originalName = encryptedFile.name.endsWith('.enc') 
      ? encryptedFile.name.slice(0, -4) 
      : encryptedFile.name;
    
    // Attempt to determine the original file type
    let fileType = 'application/octet-stream';
    
    // A simple check for common file extensions
    if (originalName.endsWith('.jpg') || originalName.endsWith('.jpeg')) {
      fileType = 'image/jpeg';
    } else if (originalName.endsWith('.png')) {
      fileType = 'image/png';
    } else if (originalName.endsWith('.pdf')) {
      fileType = 'application/pdf';
    } else if (originalName.endsWith('.txt')) {
      fileType = 'text/plain';
    } else if (originalName.endsWith('.docx')) {
      fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    
    // Create a new file with decrypted data
    return new File([decryptedArrayBuffer], originalName, {
      type: fileType
    });
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt file. Invalid key or corrupted file.');
  }
};

/**
 * Calculate SHA-256 checksum of a file
 * @param file File to calculate checksum for
 * @returns Promise with checksum string
 */
export const calculateChecksum = async (file: File): Promise<string> => {
  try {
    const buffer = await file.arrayBuffer();
    const wordArray = arrayBufferToWordArray(buffer);
    const hash = CryptoJS.SHA256(wordArray);
    return hash.toString(CryptoJS.enc.Hex);
  } catch (error) {
    console.error('Checksum calculation failed:', error);
    throw new Error('Failed to calculate file checksum');
  }
};

/**
 * Generate a file preview
 * @param file File to preview
 * @returns Promise with preview URL or content
 */
export const generateFilePreview = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    // For images, create an object URL
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      resolve(url);
      return;
    }
    
    // For PDFs, also create an object URL
    if (file.type === 'application/pdf') {
      const url = URL.createObjectURL(file);
      resolve(url);
      return;
    }
    
    // For text files, read the content
    if (file.type === 'text/plain' || 
        file.type === 'text/html' || 
        file.type === 'application/json' ||
        file.type === 'text/css' || 
        file.type === 'text/javascript') {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = (e) => {
        reject(new Error('Failed to read file'));
      };
      reader.readAsText(file);
      return;
    }
    
    // For other file types, just return the file name and type
    resolve(`No preview available for ${file.name} (${file.type})`);
  });
};

/**
 * Download a file
 * @param file File to download
 */
export const downloadFile = (file: File): void => {
  try {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Download failed:", error);
    throw new Error("Failed to download file");
  }
};

// Convert ArrayBuffer to WordArray (for CryptoJS)
export function arrayBufferToWordArray(ab: ArrayBuffer | Uint8Array): CryptoJS.lib.WordArray {
  const i8a = ab instanceof Uint8Array ? ab : new Uint8Array(ab);
  const a = [];
  for (let i = 0; i < i8a.length; i += 4) {
    a.push(
      ((i8a[i] & 0xff) << 24) | 
      ((i8a[i + 1] & 0xff) << 16) | 
      ((i8a[i + 2] & 0xff) << 8) | 
      (i8a[i + 3] & 0xff)
    );
  }
  return CryptoJS.lib.WordArray.create(a, i8a.length);
}

// Convert WordArray to ArrayBuffer
export function wordArrayToArrayBuffer(wordArray: CryptoJS.lib.WordArray): ArrayBuffer {
  const words = wordArray.words;
  const sigBytes = wordArray.sigBytes;
  const buff = new ArrayBuffer(sigBytes);
  const view = new DataView(buff);
  
  for (let i = 0; i < sigBytes; i += 1) {
    const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    view.setUint8(i, byte);
  }
  
  return buff;
}

// Convert ArrayBuffer to string
export function arrayBufferToString(buffer: ArrayBuffer | Uint8Array): string {
  const uint8Array = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(uint8Array)
    .map(b => String.fromCharCode(b))
    .join('');
}

// Convert string to Uint8Array
export function stringToUint8Array(str: string): Uint8Array {
  const arr = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    arr[i] = str.charCodeAt(i);
  }
  return arr;
}

// Convert base64 to ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Convert ArrayBuffer to base64
export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const uint8Array = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < uint8Array.byteLength; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

// Export types only, removing duplicate exports
export type { EncryptionResult, DecryptionResult };
