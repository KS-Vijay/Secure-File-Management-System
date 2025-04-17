import { toast } from "sonner";
import SHA256 from "crypto-js/sha256";
import Base64 from "crypto-js/enc-base64";
import { v4 as uuidv4 } from "uuid";
import { logInfo, logSecurity, LogCategory } from './audit-logger';
import { verifyTOTP } from './mfa';

// User interface
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  mfaSecret?: string;
  mfaEnabled: boolean;
  createdAt: string;
  lastLogin?: string;
}

// In-memory user storage for demo purposes
let users: User[] = [];

// Load users from localStorage
const loadUsers = (): void => {
  try {
    const storedUsers = localStorage.getItem('users');
    if (storedUsers) {
      users = JSON.parse(storedUsers);
    }
  } catch (error) {
    console.error("Failed to load users from localStorage:", error);
  }
};

// Save users to localStorage
const saveUsers = (): void => {
  try {
    localStorage.setItem('users', JSON.stringify(users));
  } catch (storageError) {
    console.error("Failed to save to localStorage:", storageError);
  }
};

// Initialize by loading users
loadUsers();

// Session management
interface Session {
  userId: string;
  email: string;
  expiresAt: number;
  lastActivity: number;
}

let currentSession: Session | null = null;

// Load session from localStorage
const loadSession = (): void => {
  try {
    const storedSession = localStorage.getItem('session');
    if (storedSession) {
      currentSession = JSON.parse(storedSession);
      
      // Check if session has expired
      if (currentSession && currentSession.expiresAt < Date.now()) {
        logout();
        return;
      }
      
      // Update last activity
      if (currentSession) {
        updateLastActivity();
      }
    }
  } catch (error) {
    console.error("Failed to load session:", error);
    currentSession = null;
  }
};

// Save session to localStorage
const saveSession = (): void => {
  try {
    if (currentSession) {
      localStorage.setItem('session', JSON.stringify(currentSession));
    } else {
      localStorage.removeItem('session');
    }
  } catch (error) {
    console.error("Failed to save session:", error);
  }
};

// Initialize by loading session
loadSession();

// Update last activity timestamp
export const updateLastActivity = (): void => {
  if (currentSession) {
    currentSession.lastActivity = Date.now();
    saveSession();
  }
};

// Check for inactivity timeout (10 minutes = 600000 milliseconds)
const INACTIVITY_TIMEOUT = 600000;

export const checkInactivity = (): boolean => {
  if (!currentSession) return false;
  
  const now = Date.now();
  const timeSinceLastActivity = now - currentSession.lastActivity;
  
  if (timeSinceLastActivity > INACTIVITY_TIMEOUT) {
    logout();
    toast.error("Session expired due to inactivity");
    return true;
  }
  
  return false;
};

// Hash a password using SHA-256
export const hashPassword = (password: string): string => {
  return SHA256(password).toString(Base64);
};

// Register a new user
export const register = (email: string, password: string): { success: boolean; message: string; userId?: string } => {
  // Check if user already exists
  if (users.some(user => user.email === email)) {
    return { success: false, message: "User with this email already exists" };
  }
  
  const userId = uuidv4();
  const newUser: User = {
    id: userId,
    email,
    passwordHash: hashPassword(password),
    mfaEnabled: false,
    createdAt: new Date().toISOString()
  };
  
  users.push(newUser);
  saveUsers();
  
  logSecurity(LogCategory.AUTH, "User registered", { email });
  
  return { success: true, message: "Registration successful", userId };
};

// Log in a user
export const login = (email: string, password: string): { 
  success: boolean; 
  message: string; 
  requireMFA?: boolean;
  userId?: string;
} => {
  const user = users.find(u => u.email === email);
  
  if (!user) {
    logSecurity(LogCategory.AUTH, "Failed login attempt - user not found", { email });
    return { success: false, message: "Invalid email or password" };
  }
  
  const passwordHash = hashPassword(password);
  
  if (user.passwordHash !== passwordHash) {
    logSecurity(LogCategory.AUTH, "Failed login attempt - wrong password", { email });
    return { success: false, message: "Invalid email or password" };
  }
  
  // If MFA is enabled, require verification
  if (user.mfaEnabled) {
    logInfo(LogCategory.AUTH, "MFA required for login", { email });
    return { 
      success: true, 
      message: "Please enter your MFA code", 
      requireMFA: true,
      userId: user.id
    };
  }
  
  // Create session
  createSession(user.id, user.email);
  
  // Update last login
  user.lastLogin = new Date().toISOString();
  saveUsers();
  
  logSecurity(LogCategory.AUTH, "User logged in", { email });
  
  return { success: true, message: "Login successful" };
};

// Create a user session
const createSession = (userId: string, email: string): void => {
  // Session expires in 24 hours
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  
  currentSession = {
    userId,
    email,
    expiresAt,
    lastActivity: Date.now()
  };
  
  saveSession();
};

// Log out the current user
export const logout = (): void => {
  if (currentSession) {
    logSecurity(LogCategory.AUTH, "User logged out", { email: currentSession.email });
  }
  
  currentSession = null;
  saveSession();
};

// Get the current authenticated user
export const getCurrentUser = (): User | null => {
  if (!currentSession) return null;
  
  return users.find(u => u.id === currentSession?.userId) || null;
};

// Check if a user is authenticated
export const isAuthenticated = (): boolean => {
  if (checkInactivity()) return false;
  
  if (!currentSession) return false;
  
  // Check if session has expired
  if (currentSession.expiresAt < Date.now()) {
    logout();
    return false;
  }
  
  // Update last activity
  updateLastActivity();
  
  return true;
};

// Get current user email
export const getCurrentUserEmail = (): string | null => {
  return currentSession?.email || null;
};

// Setup MFA for a user
export const setupMFA = (userId: string, secret: string): boolean => {
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex === -1) {
    logError(LogCategory.AUTH, "Failed to set up MFA - user not found", { userId });
    return false;
  }
  
  users[userIndex].mfaSecret = secret;
  users[userIndex].mfaEnabled = true;
  saveUsers();
  
  logSecurity(LogCategory.AUTH, "MFA setup completed", { email: users[userIndex].email });
  return true;
};

// Log an error
function logError(category: LogCategory, message: string, details?: any): void {
  console.error(`[${category}] ${message}`, details);
  // Also log to audit logger
  logInfo(category, message, details);
}

// Verify MFA token using actual TOTP algorithm
export const verifyMFA = (userId: string, token: string): boolean => {
  const user = users.find(u => u.id === userId);
  if (!user || !user.mfaSecret) return false;
  
  // Use the mfa.ts verifyTOTP function for actual TOTP verification
  const isValid = verifyTOTP(token, user.mfaSecret);
  
  if (isValid) {
    logInfo(LogCategory.AUTH, "MFA verification successful", { email: user.email });
  } else {
    logInfo(LogCategory.AUTH, "MFA verification failed", { email: user.email });
  }
  
  return isValid;
};

// Complete MFA authentication and create session
export const completeMFALogin = (userId: string): boolean => {
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    logError(LogCategory.AUTH, "Failed to complete MFA login - user not found", { userId });
    return false;
  }
  
  // Create session
  createSession(user.id, user.email);
  
  // Update last login
  user.lastLogin = new Date().toISOString();
  saveUsers();
  
  logSecurity(LogCategory.AUTH, "User logged in with MFA", { email: user.email });
  
  return true;
};

// Change password for a user
export const changePassword = (userId: string, currentPassword: string, newPassword: string): { success: boolean; message: string } => {
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex === -1) {
    return { success: false, message: "User not found" };
  }
  
  const currentPasswordHash = hashPassword(currentPassword);
  
  if (users[userIndex].passwordHash !== currentPasswordHash) {
    logSecurity(LogCategory.AUTH, "Failed password change - incorrect current password", { email: users[userIndex].email });
    return { success: false, message: "Current password is incorrect" };
  }
  
  users[userIndex].passwordHash = hashPassword(newPassword);
  saveUsers();
  
  logSecurity(LogCategory.AUTH, "Password changed successfully", { email: users[userIndex].email });
  
  return { success: true, message: "Password changed successfully" };
};

// Verify user credentials (for sensitive operations like viewing encryption keys)
export const verifyCredentials = (email: string, password: string): boolean => {
  const user = users.find(u => u.email === email);
  
  if (!user) return false;
  
  const passwordHash = hashPassword(password);
  const isValid = user.passwordHash === passwordHash;
  
  if (isValid) {
    logInfo(LogCategory.AUTH, "Credentials verified", { email });
  } else {
    logSecurity(LogCategory.AUTH, "Failed credential verification", { email });
  }
  
  return isValid;
};

// Initialize with a default admin user if no users exist
export const initializeDefaultUser = (): void => {
  if (users.length === 0) {
    const defaultUserId = register("admin@example.com", "admin123").userId || "";
    
    // Enable MFA for default user
    if (defaultUserId) {
      setupMFA(defaultUserId, "default-mfa-secret");
      logInfo(LogCategory.SYSTEM, "Default admin user created with MFA enabled", {});
    }
    
    console.log("Created default user: admin@example.com / admin123 (MFA enabled)");
  }
};

// Call initializeDefaultUser to ensure at least one user exists
initializeDefaultUser();

// Export types
export type { Session };
