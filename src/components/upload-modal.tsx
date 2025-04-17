
import { useState, useRef, ChangeEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { encryptFile, downloadFile } from "@/utils/encryption";
import { Card, CardContent } from "@/components/ui/card";
import { FileUp, Key, Copy, Download, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export interface UploadFileData {
  file: File;
  encrypt: boolean;
  encryptionData?: {
    algorithm: string;
    encryptionKey: string;
    iv: string;
    checksum: string;
  };
}

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (fileData?: UploadFileData) => void;
}

export function UploadModal({ isOpen, onClose, onUpload }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [encrypt, setEncrypt] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [encryptedFile, setEncryptedFile] = useState<File | null>(null);
  const [showEncryptionSuccess, setShowEncryptionSuccess] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      // Reset encryption-related states when a new file is selected
      setEncryptionKey(null);
      setEncryptedFile(null);
      setShowEncryptionSuccess(false);
    }
  };
  
  const handleClose = () => {
    // Reset all states when closing the modal
    setFile(null);
    setEncrypt(false);
    setUploading(false);
    setUploadProgress(0);
    setEncryptionKey(null);
    setEncryptedFile(null);
    setShowEncryptionSuccess(false);
    onClose();
  };
  
  const processFile = async () => {
    if (!file) return;
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const next = prev + 10;
          return next > 90 ? 90 : next;
        });
      }, 200);
      
      let fileData: UploadFileData = {
        file,
        encrypt: false
      };
      
      // If encryption is enabled, encrypt the file
      if (encrypt) {
        const encryptionResult = await encryptFile(file);
        
        // Store the encrypted file and its encryption key
        setEncryptedFile(encryptionResult.encryptedFile);
        
        // Format the encryption key for display
        setEncryptionKey(encryptionResult.encryptionKey);
        
        fileData = {
          file: encryptionResult.encryptedFile,
          encrypt: true,
          encryptionData: {
            algorithm: encryptionResult.algorithm,
            encryptionKey: encryptionResult.encryptionKey,
            iv: encryptionResult.iv,
            checksum: encryptionResult.checksum
          }
        };
        
        setShowEncryptionSuccess(true);
      }
      
      // Complete the progress bar
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // If we're not showing encryption success screen, upload immediately
      if (!encrypt) {
        setTimeout(() => {
          onUpload(fileData);
        }, 500);
      } else {
        // For encrypted files, we wait for the user to acknowledge the key
        // The actual upload happens when they click "Continue"
        console.log("Encryption completed, waiting for user to continue...");
      }
    } catch (error) {
      console.error("Error during file processing:", error);
      toast.error("Failed to process file");
    } finally {
      if (!encrypt) {
        setUploading(false);
      }
    }
  };
  
  const handleCopyKey = () => {
    if (encryptionKey) {
      navigator.clipboard.writeText(encryptionKey);
      toast.success("Encryption key copied to clipboard");
    }
  };
  
  const handleDownloadEncrypted = () => {
    if (encryptedFile) {
      downloadFile(encryptedFile);
      toast.success(`${encryptedFile.name} is being downloaded`);
    }
  };
  
  const handleContinue = () => {
    if (encryptedFile && encryptionKey) {
      const fileData: UploadFileData = {
        file: encryptedFile,
        encrypt: true,
        encryptionData: {
          algorithm: 'AES-256-CBC',
          encryptionKey: encryptionKey,
          iv: encryptionKey.split('.')[1] || '',
          checksum: ''
        }
      };
      
      onUpload(fileData);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload File</DialogTitle>
        </DialogHeader>
        
        {!showEncryptionSuccess ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="file" className="text-sm font-medium">
                Select a file to upload
              </Label>
              
              <div className="mt-2">
                <Input
                  id="file"
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="cursor-pointer"
                  disabled={uploading}
                />
              </div>
            </div>
            
            {file && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="encrypt" 
                    checked={encrypt} 
                    onCheckedChange={setEncrypt} 
                    disabled={uploading}
                  />
                  <Label htmlFor="encrypt" className="cursor-pointer">
                    Encrypt this file
                  </Label>
                </div>
                
                {encrypt && (
                  <Alert>
                    <Key className="h-4 w-4" />
                    <AlertDescription>
                      You will receive an encryption key after uploading.
                      Keep it safe as it's required to decrypt the file.
                    </AlertDescription>
                  </Alert>
                )}
                
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{encrypt ? "Encrypting..." : "Uploading..."}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                  </div>
                )}
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleClose} disabled={uploading}>
                    Cancel
                  </Button>
                  <Button onClick={processFile} disabled={!file || uploading}>
                    <FileUp className="h-4 w-4 mr-2" />
                    {encrypt ? "Encrypt & Upload" : "Upload"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-500">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">File Encrypted Successfully</span>
            </div>
            
            <Card>
              <CardContent className="p-4 space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Encryption Key</Label>
                  <div className="flex mt-1">
                    <Input 
                      value={encryptionKey || ""} 
                      readOnly 
                      className="font-mono text-sm pr-14"
                    />
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="ml-[-40px]"
                      onClick={handleCopyKey}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This key will only be shown once. Make sure to save it in a secure location.
                Without this key, you won't be able to decrypt the file.
              </AlertDescription>
            </Alert>
            
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={handleDownloadEncrypted}>
                <Download className="h-4 w-4 mr-2" />
                Download Encrypted File
              </Button>
              <Button onClick={handleContinue}>
                Continue
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
