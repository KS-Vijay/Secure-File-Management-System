
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import * as OTPAuth from 'otpauth';

// Base32 character set (RFC 4648)
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// Generate a new MFA secret in Base32 format for compatibility with Google Authenticator
export const generateMFASecret = (): string => {
  // Generate a random Base32 string of 16 characters (80 bits) which is standard for TOTP
  let secret = '';
  for (let i = 0; i < 16; i++) {
    const randomIndex = Math.floor(Math.random() * BASE32_CHARS.length);
    secret += BASE32_CHARS[randomIndex];
  }
  return secret;
};

// Generate a QR code for the MFA setup
export const generateMFAQRCode = async (
  secret: string, 
  email: string, 
  appName: string = 'SecureVault'
): Promise<string> => {
  try {
    // Format the otpauth URL exactly as expected by authenticator apps
    const otpAuthUrl = `otpauth://totp/${encodeURIComponent(appName)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(appName)}&algorithm=SHA1&digits=6&period=30`;
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);
    return qrCodeDataUrl;
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    throw new Error('Failed to generate QR code');
  }
};

// Verify TOTP code using the otpauth library
export const verifyTOTP = (code: string, secret: string): boolean => {
  try {
    // Create a new TOTP object
    const totp = new OTPAuth.TOTP({
      issuer: 'SecureVault',
      label: 'SecureVault',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret)
    });
    
    // Generate the current token to compare with user input
    const currentToken = totp.generate();
    
    // For a slightly better user experience, also check window of +/- 1 period (30 seconds)
    // This helps if user's device clock is slightly off
    const previousToken = totp.generate({ timestamp: Date.now() - 30000 });
    const nextToken = totp.generate({ timestamp: Date.now() + 30000 });
    
    // Check if the provided code matches any of the valid tokens
    return code === currentToken || code === previousToken || code === nextToken;
  } catch (error) {
    console.error('TOTP verification error:', error);
    return false;
  }
};
