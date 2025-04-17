
import { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { UploadModal, UploadFileData } from "@/components/upload-modal";
import { DecryptionModal } from "@/components/decryption-modal";
import { ThemeProvider } from "@/components/theme-provider";
import { MobileProvider, useMobileContext } from "@/hooks/use-mobile";
import { 
  isAuthenticated, 
  updateLastActivity, 
  getCurrentUser,
  logout
} from "@/utils/auth";
import { logInfo, LogCategory } from "@/utils/audit-logger";
import { toast } from "sonner";
import { calculateChecksum } from "@/utils/encryption";
import { addFile, generateFileId, formatTimestamp, formatFileSize } from "@/utils/file-storage";

export default function AppLayout() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDecryptModalOpen, setIsDecryptModalOpen] = useState(false);
  const navigate = useNavigate();
  const { isSidebarOpen } = useMobileContext();
  
  // Check authentication status periodically
  useEffect(() => {
    // Redirect to login if not authenticated
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }
    
    // Update last activity when there is user interaction
    const handleInteraction = () => {
      updateLastActivity();
    };
    
    // Add event listeners for user interaction
    window.addEventListener("click", handleInteraction);
    window.addEventListener("keydown", handleInteraction);
    window.addEventListener("mousemove", handleInteraction);
    
    // Check session status every 30 seconds
    const interval = setInterval(() => {
      if (!isAuthenticated()) {
        toast.error("Your session has expired. Please log in again.");
        navigate("/login");
      }
    }, 30000); // 30 seconds
    
    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
      window.removeEventListener("mousemove", handleInteraction);
      clearInterval(interval);
    };
  }, [navigate]);
  
  const handleUpload = async (fileData?: UploadFileData) => {
    if (!fileData) return;
    
    const { file, encrypt, encryptionData } = fileData;
    
    try {
      // Create file tags based on type and encryption status
      const fileType = file.type.split('/')[0] || 'document';
      const tags = [fileType];
      if (encrypt) tags.push('encrypted');
      
      // Generate file ID
      const fileId = generateFileId();
      
      // Generate additional file metadata
      const now = new Date();
      const checksum = encryptionData?.checksum || await calculateChecksum(file);
      const currentUser = getCurrentUser();
      
      // Create file record
      const newFile = {
        id: fileId,
        name: file.name,
        extension: file.name.split('.').pop() || '',
        size: formatFileSize(file.size),
        tags: tags,
        timestamp: formatTimestamp(now),
        isFavorite: false,
        isShared: false,
        type: file.type || 'application/octet-stream',
        created: now.toLocaleString(),
        modified: now.toLocaleString(),
        createdBy: currentUser?.email || "Unknown User",
        modifiedBy: currentUser?.email || "Unknown User",
        isEncrypted: encrypt,
        checksum: checksum,
        // Store encryption data in file object for later decryption
        encryptionData: encrypt && encryptionData ? {
          algorithm: encryptionData.algorithm,
          encryptionKey: encryptionData.encryptionKey,
          iv: encryptionData.iv
        } : undefined
      };
      
      // Save the file record
      addFile(newFile);
      
      // Save actual file in localStorage for demo purposes
      try {
        const fileReader = new FileReader();
        fileReader.onload = function(e) {
          const base64Content = e.target?.result;
          localStorage.setItem(`file_${fileId}`, base64Content as string);
        };
        fileReader.readAsDataURL(file);
      } catch (err) {
        console.error("Failed to store file:", err);
        toast.error("Failed to store file content");
      }
      
      // Log file upload
      logInfo(LogCategory.FILE, `File uploaded: ${file.name}`, {
        fileId,
        fileName: file.name,
        encrypted: encrypt
      });
      
      toast.success(`${file.name} has been uploaded ${encrypt ? 'with encryption' : ''}`);
      
      // Navigate to dashboard to show the newly uploaded file
      navigate("/dashboard");
      
      // Close modal when done
      setIsUploadModalOpen(false);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload file");
    }
  };
  
  const handleLogout = () => {
    logout();
    toast.success("You have been logged out");
    navigate("/login");
  };
  
  const currentUser = getCurrentUser();
  const userDisplayName = currentUser?.email?.split('@')[0] || "User";
  
  // Calculate user initials from email
  const userInitials = currentUser?.email
    ? currentUser.email.split('@')[0].slice(0, 2).toUpperCase()
    : "U";
  
  return (
    <ThemeProvider defaultTheme="dark">
      <MobileProvider>
        <div className="min-h-screen flex flex-col">
          <Header 
            user={{ 
              name: userDisplayName,
              email: currentUser?.email,
              initials: userInitials
            }}
            onLogout={handleLogout}
          />
          
          <div className="flex flex-1">
            {isSidebarOpen && (
              <Sidebar 
                storageUsed={3.8} 
                storageTotal={10} 
                onUploadClick={() => setIsUploadModalOpen(true)}
                onDecryptClick={() => setIsDecryptModalOpen(true)}
              />
            )}
            
            <main className="flex-1 overflow-auto">
              <Outlet />
            </main>
          </div>
          
          <UploadModal 
            isOpen={isUploadModalOpen} 
            onClose={() => setIsUploadModalOpen(false)}
            onUpload={handleUpload}
          />
          
          <DecryptionModal
            isOpen={isDecryptModalOpen}
            onClose={() => setIsDecryptModalOpen(false)}
          />
        </div>
      </MobileProvider>
    </ThemeProvider>
  );
}
