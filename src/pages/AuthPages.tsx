import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  register, 
  login, 
  completeMFALogin, 
  isAuthenticated,
  initializeDefaultUser,
  setupMFA,
  verifyMFA
} from "@/utils/auth";
import { generateMFASecret, generateMFAQRCode, verifyTOTP } from "@/utils/mfa";
import { logSecurity, LogCategory } from "@/utils/audit-logger";
import { Key, AlertCircle, CheckCircle2 } from "lucide-react";

const checkPasswordStrength = (password: string): number => {
  let score = 0;
  
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  
  return Math.min(score, 6);
};

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [showMfaForm, setShowMfaForm] = useState(false);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    initializeDefaultUser();
    
    if (isAuthenticated()) {
      navigate("/dashboard");
    }
  }, [navigate]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    if (!validateEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    
    setLoading(true);
    
    try {
      if (showMfaForm) {
        if (!/^\d{6}$/.test(mfaCode)) {
          toast.error("Please enter a valid 6-digit MFA code");
          setLoading(false);
          return;
        }
        
        // Use the proper MFA verification
        const mfaResult = verifyMFA(userId || "", mfaCode);
        
        if (mfaResult) {
          const success = completeMFALogin(userId || "");
          
          if (success) {
            logSecurity(LogCategory.AUTH, "User login successful with MFA", { email });
            toast.success("Login successful!");
            navigate("/dashboard");
          } else {
            toast.error("Failed to complete authentication");
          }
        } else {
          toast.error("Invalid MFA code");
        }
      } else {
        const result = login(email, password);
        
        if (result.success) {
          if (result.requireMFA) {
            setShowMfaForm(true);
            setUserId(result.userId);
            toast.info("Please enter your MFA code from your authenticator app");
          } else {
            logSecurity(LogCategory.AUTH, "User login successful", { email });
            toast.success("Login successful!");
            navigate("/dashboard");
          }
        } else {
          logSecurity(LogCategory.AUTH, "Failed login attempt", { email });
          toast.error(result.message);
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("An error occurred during login");
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>
        
        <div className="bg-card p-8 rounded-lg border border-border/40">
          <h1 className="text-2xl font-bold mb-6 text-center">
            {showMfaForm ? "Two-Factor Authentication" : "Login to SecureVault"}
          </h1>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {!showMfaForm ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="password">Password</Label>
                    <a href="#" className="text-sm text-primary hover:underline">
                      Forgot password?
                    </a>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-4">
                  <Key className="h-5 w-5 text-primary" />
                  <p className="text-sm">
                    Please enter the 6-digit code from your authenticator app
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mfaCode">Authentication Code</Label>
                  <Input
                    id="mfaCode"
                    type="text"
                    placeholder="000000"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    required
                    disabled={loading}
                    className="text-center letter-spacing-3"
                  />
                </div>
              </div>
            )}
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                "Processing..."
              ) : showMfaForm ? (
                "Verify Code"
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
          
          {showMfaForm && (
            <Button 
              variant="link" 
              className="mt-4 text-sm w-full"
              onClick={() => setShowMfaForm(false)}
              disabled={loading}
            >
              Go back to login
            </Button>
          )}
          
          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Don't have an account? </span>
            <a 
              href="/register" 
              className="text-primary hover:underline"
              onClick={(e) => {
                e.preventDefault();
                navigate("/register");
              }}
            >
              Sign up
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaQrCode, setMfaQrCode] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [userId, setUserId] = useState("");
  
  useEffect(() => {
    setPasswordStrength(checkPasswordStrength(password));
  }, [password]);
  
  const getStrengthColor = () => {
    if (passwordStrength <= 2) return "bg-red-500";
    if (passwordStrength <= 4) return "bg-yellow-500";
    return "bg-green-500";
  };
  
  const getStrengthText = () => {
    if (passwordStrength <= 2) return "Weak";
    if (passwordStrength <= 4) return "Moderate";
    return "Strong";
  };
  
  const setupMFAForUser = async () => {
    try {
      const secret = generateMFASecret();
      setMfaSecret(secret);
      
      const qrCode = await generateMFAQRCode(secret, email);
      setMfaQrCode(qrCode);
      
      setShowMfaSetup(true);
    } catch (error) {
      console.error("MFA setup error:", error);
      toast.error("Failed to set up MFA");
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    if (!validateEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }
    
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    
    setLoading(true);
    
    try {
      if (showMfaSetup) {
        if (!/^\d{6}$/.test(mfaCode)) {
          toast.error("Please enter a valid 6-digit MFA code");
          setLoading(false);
          return;
        }
        
        const isValid = verifyTOTP(mfaCode, mfaSecret);
        
        if (isValid) {
          // Fixed the error by calling setupMFA with userId and mfaSecret
          const mfaResult = setupMFA(userId, mfaSecret);
          
          if (mfaResult) {
            logSecurity(LogCategory.AUTH, "User registration successful with MFA", { email });
            toast.success("Registration successful with MFA enabled!");
            navigate("/login");
          } else {
            toast.error("Failed to set up MFA");
          }
        } else {
          toast.error("Invalid MFA code");
        }
      } else {
        const result = register(email, password);
        
        if (result.success) {
          setUserId(result.userId || "");
          
          await setupMFAForUser();
        } else {
          logSecurity(LogCategory.AUTH, "Failed registration attempt", { email });
          toast.error(result.message);
        }
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast.error("An error occurred during registration");
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>
        
        <div className="bg-card p-8 rounded-lg border border-border/40">
          <h1 className="text-2xl font-bold mb-6 text-center">
            {showMfaSetup ? "Set Up Two-Factor Authentication" : "Create Account"}
          </h1>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {!showMfaSetup ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                  <div className="mt-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-muted-foreground">Password strength:</span>
                      <span className="text-xs">{getStrengthText()}</span>
                    </div>
                    <Progress 
                      value={(passwordStrength / 6) * 100} 
                      className={`h-1 ${getStrengthColor()}`} 
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="h-5 w-5 text-primary" />
                  <p className="text-sm font-medium">Set up two-factor authentication</p>
                </div>
                
                <div className="bg-secondary/40 p-4 rounded-lg">
                  <p className="text-sm mb-4">
                    Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                  </p>
                  
                  <div className="flex justify-center mb-4">
                    {mfaQrCode && (
                      <img 
                        src={mfaQrCode} 
                        alt="QR Code" 
                        className="w-48 h-48 border border-border/40 rounded-lg"
                      />
                    )}
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <Label htmlFor="mfaSecret">Or enter this code manually:</Label>
                    <div className="flex">
                      <Input
                        id="mfaSecret"
                        type="text"
                        value={mfaSecret}
                        readOnly
                        className="font-mono text-center"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(mfaSecret);
                          toast.success("Secret copied to clipboard");
                        }}
                        className="ml-2"
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="mfaCode">Verification Code</Label>
                    <Input
                      id="mfaCode"
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                      required
                      disabled={loading}
                      className="text-center letter-spacing-3"
                    />
                  </div>
                </div>
              </div>
            )}
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                "Processing..."
              ) : showMfaSetup ? (
                "Complete Setup"
              ) : (
                "Create Account"
              )}
            </Button>
          </form>
          
          {showMfaSetup && (
            <Button 
              variant="link" 
              className="mt-4 text-sm w-full"
              onClick={() => setShowMfaSetup(false)}
              disabled={loading}
            >
              Go back
            </Button>
          )}
          
          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <a 
              href="/login" 
              className="text-primary hover:underline"
              onClick={(e) => {
                e.preventDefault();
                navigate("/login");
              }}
            >
              Sign in
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
