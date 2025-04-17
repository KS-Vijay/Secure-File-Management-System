import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { NavIcons } from "@/components/ui/icons";
import { FileDetail } from "@/components/file-detail";
import { getFileById, deleteFile } from "@/utils/file-storage";
import { toast } from "sonner";
import { FilePreview } from "@/components/file-preview";
import { decryptFile } from "@/utils/encryption";
import { isAuthenticated } from "@/utils/auth";
import { logInfo, LogCategory } from "@/utils/audit-logger";

export default function FileDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileObject, setFileObject] = useState<File | null>(null);
  const [encryptedFileObject, setEncryptedFileObject] = useState<File | null>(null);
  const [decryptedFile, setDecryptedFile] = useState<File | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  
  const file = id ? getFileById(id) : null;
  
  useEffect(() => {
    // Check if user is authenticated
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }
    
    // Try to load file content from localStorage
    if (file && id) {
      const storedFile = localStorage.getItem(`file_${id}`);
      if (storedFile) {
        setFileContent(storedFile);
        
        try {
          // Convert data URL to file object
          const contentType = file.type || 'application/octet-stream';
          const byteString = atob(storedFile.split(',')[1]);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          
          const blob = new Blob([ab], { type: contentType });
          const fileObj = new File([blob], file.name, { type: contentType });
          
          // Save encrypted file object
          if (file.isEncrypted) {
            setEncryptedFileObject(fileObj);
            
            // Check if we have encryption data
            if (file.encryptionData) {
              // Show toast notifying that the file is encrypted
              toast.info("This file is encrypted. You need the decryption key to view it.");
            }
          } else {
            // For non-encrypted files, just set the file object
            setFileObject(fileObj);
          }
        } catch (error) {
          console.error("Failed to process file:", error);
          toast.error("Failed to load file");
        }
      } else {
        toast.error("File content not found");
      }
      
      // Log file access
      logInfo(LogCategory.FILE, `Accessed file: ${file.name}`, {
        fileId: id,
        fileName: file.name
      });
    }
  }, [file, id, navigate]);
  
  const handleDecrypt = async (fileToDecrypt: File, key: string) => {
    if (!fileToDecrypt) return;
    
    setDecrypting(true);
    
    try {
      // Now we use just the key directly without trying to extract IV separately
      const decrypted = await decryptFile(fileToDecrypt, key);
      setDecryptedFile(decrypted);
      setFileObject(decrypted); // Set decrypted file as the main file object for preview
      
      toast.success("File decrypted successfully");
      
      // Log file decryption
      logInfo(LogCategory.SECURITY, `Decrypted file: ${file?.name}`, {
        fileId: id
      });
    } catch (error) {
      console.error("Failed to decrypt file:", error);
      toast.error("Failed to decrypt file. Invalid key or corrupted file.");
      
      // Log failed decryption attempt
      logInfo(LogCategory.SECURITY, `Failed to decrypt file: ${file?.name}`, {
        fileId: id,
        error: String(error)
      });
    } finally {
      setDecrypting(false);
    }
  };
  
  if (!file) {
    return (
      <div className="flex-1 p-6">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            className="mr-4 flex items-center" 
            onClick={() => navigate("/dashboard")}
          >
            <NavIcons.Back className="h-4 w-4 mr-2" />
            Back to Files
          </Button>
        </div>
        
        <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
          <h2 className="text-xl font-semibold mb-2">File Not Found</h2>
          <p className="text-muted-foreground">The file you're looking for doesn't exist or has been moved.</p>
          <Button 
            className="mt-4" 
            onClick={() => navigate("/dashboard")}
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }
  
  const handleDownload = () => {
    // If we have a decrypted version for encrypted files, download that
    const fileToDownload = decryptedFile || fileObject;
    
    if (fileToDownload) {
      const url = URL.createObjectURL(fileToDownload);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileToDownload.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(`${fileToDownload.name} is being downloaded`);
      
      // Log file download
      logInfo(LogCategory.FILE, `Downloaded file: ${file.name}`, {
        fileId: id
      });
    } else {
      toast.error("Could not download the file");
    }
  };
  
  const handleShare = () => {
    toast.info(`Share options for ${file.name} opened`);
    
    // Log share attempt
    logInfo(LogCategory.FILE, `Attempted to share file: ${file.name}`, {
      fileId: id
    });
  };
  
  const handleDelete = () => {
    // Delete file from storage
    if (id && deleteFile(id)) {
      toast.success(`${file.name} has been deleted`);
      
      // Log file deletion
      logInfo(LogCategory.FILE, `Deleted file: ${file.name}`, {
        fileId: id
      });
      
      navigate("/dashboard");
    } else {
      toast.error("Failed to delete file");
    }
  };
  
  // Handle decryption key submission - simplified to use the single key
  const handleDecryptionKeySubmit = (key: string) => {
    if (!encryptedFileObject) {
      toast.error("Missing file to decrypt");
      return;
    }
    
    handleDecrypt(encryptedFileObject, key);
  };
  
  // For the component, we need to ensure we're passing a properly typed file object
  const fileDetailProps = file ? {
    id: file.id,
    name: file.name,
    extension: file.extension,
    size: file.size,
    type: file.type || 'application/octet-stream', // Provide default value for type
    created: file.created,
    modified: file.modified,
    createdBy: file.createdBy,
    modifiedBy: file.modifiedBy,
    isEncrypted: !!file.isEncrypted,
    checksum: file.checksum,
    encryptionData: file.encryptionData
  } : null;
  
  return (
    <div className="flex-1 p-6">
      <div className="flex items-center mb-6">
        <Button 
          variant="ghost" 
          className="mr-4 flex items-center" 
          onClick={() => navigate("/dashboard")}
        >
          <NavIcons.Back className="h-4 w-4 mr-2" />
          Back to Files
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {fileDetailProps && (
          <FileDetail 
            file={fileDetailProps}
            onDownload={handleDownload}
            onShare={handleShare}
            onDelete={handleDelete}
            onDecrypt={file.isEncrypted && !decryptedFile ? handleDecryptionKeySubmit : undefined}
            decrypting={decrypting}
          />
        )}
        
        {/* Show file preview with both decrypted and encrypted options */}
        {(fileObject || encryptedFileObject) ? (
          <div>
            <FilePreview 
              file={fileObject || encryptedFileObject}
              encryptedFile={file.isEncrypted ? encryptedFileObject : undefined}
              onDownload={handleDownload}
              requiresDecryption={file.isEncrypted && !decryptedFile}
              onDecrypt={handleDecryptionKeySubmit}
            />
            
            {file.isEncrypted && file.encryptionData && !decrypting && (
              <div className="mt-6 bg-card border border-border/40 rounded-lg p-4 md:p-6">
                <h3 className="text-lg font-medium mb-3">Encryption Information</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Encryption Algorithm:</p>
                    <p className="font-mono text-sm bg-secondary/40 p-2 rounded">
                      {file.encryptionData.algorithm}
                    </p>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    This file is encrypted and can only be viewed with the decryption key.
                    If you don't have the key, contact the file owner.
                  </div>
                  
                  {file.checksum && (
                    <div className="mt-4">
                      <p className="text-sm text-muted-foreground mb-1">File Checksum (SHA-256):</p>
                      <p className="font-mono text-xs bg-secondary/40 p-2 rounded overflow-auto max-h-20">
                        {file.checksum}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 bg-card border border-border/40 rounded-lg">
            <p className="text-muted-foreground">Loading file preview...</p>
          </div>
        )}
      </div>
    </div>
  );
}
