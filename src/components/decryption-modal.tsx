
import { useState, useRef } from "react";
import { X, Upload, File, Key, Lock, Unlock, Download } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { decryptFile, downloadFile } from "@/utils/encryption";
import { FilePreview } from "@/components/file-preview";
import { useToast } from "@/hooks/use-toast";

interface DecryptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DecryptionModal({ isOpen, onClose }: DecryptionModalProps) {
  const [encryptedFile, setEncryptedFile] = useState<File | null>(null);
  const [decryptedFile, setDecryptedFile] = useState<File | null>(null);
  const [encryptionKey, setEncryptionKey] = useState("");
  const [fileDetails, setFileDetails] = useState<{
    type: string;
    size: string;
    lastModified: string;
  } | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    else if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    else return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setEncryptedFile(file);
      setDecryptedFile(null);
      
      // Set file details
      setFileDetails({
        type: file.type || 'Unknown',
        size: formatFileSize(file.size),
        lastModified: new Date(file.lastModified).toLocaleString()
      });
    }
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setEncryptedFile(file);
      setDecryptedFile(null);
      
      // Set file details
      setFileDetails({
        type: file.type || 'Unknown',
        size: formatFileSize(file.size),
        lastModified: new Date(file.lastModified).toLocaleString()
      });
    }
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };
  
  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const handleRemoveFile = () => {
    setEncryptedFile(null);
    setDecryptedFile(null);
    setFileDetails(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleDecrypt = async () => {
    if (!encryptedFile || !encryptionKey) {
      toast({
        title: "Missing information",
        description: "Please provide the encrypted file and encryption key",
        variant: "destructive",
      });
      return;
    }
    
    setIsDecrypting(true);
    
    try {
      console.log("Attempting decryption with key:", encryptionKey);
      
      // Parse the encryption key format
      let actualKey, iv;
      
      if (encryptionKey.includes('.')) {
        const parts = encryptionKey.split('.');
        if (parts.length >= 2) {
          iv = parts.pop(); // Get the last part as IV
          actualKey = parts.join('.'); // Join the rest as the key
        } else {
          throw new Error("Invalid key format");
        }
      } else {
        throw new Error("Invalid key format - missing separator");
      }
      
      console.log("Parsed key:", actualKey);
      console.log("Parsed IV:", iv);
      
      const decrypted = await decryptFile(encryptedFile, actualKey, iv);
      setDecryptedFile(decrypted);
      
      toast({
        title: "File decrypted",
        description: `${encryptedFile.name} has been successfully decrypted`,
      });
    } catch (error) {
      console.error("Decryption failed:", error);
      toast({
        title: "Decryption failed",
        description: "Invalid encryption key or the file is not encrypted",
        variant: "destructive",
      });
    } finally {
      setIsDecrypting(false);
    }
  };
  
  const handleDownload = () => {
    if (decryptedFile) {
      downloadFile(decryptedFile);
      toast({
        title: "Download started",
        description: `${decryptedFile.name} is being downloaded`,
      });
    }
  };
  
  const handleClose = () => {
    setEncryptedFile(null);
    setDecryptedFile(null);
    setEncryptionKey("");
    setFileDetails(null);
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md bg-card p-0 border-border/40 max-h-[90vh] overflow-y-auto">
        <div className="flex flex-col p-4">
          <div className="flex justify-between items-center mb-2">
            <DialogTitle className="text-lg font-semibold">Decrypt File</DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-muted-foreground text-sm mb-4">Upload an encrypted file and provide the decryption key</p>
          
          {!encryptedFile ? (
            <div 
              className="border-2 border-dashed border-border/60 rounded-lg p-6 text-center flex flex-col items-center justify-center gap-3"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <div className="bg-secondary rounded-full p-3">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-medium mb-1">Upload Encrypted File</h3>
                <p className="text-muted-foreground text-sm">Drag and drop your encrypted file here</p>
              </div>
              <Button 
                variant="outline" 
                onClick={handleBrowseClick}
                size="sm"
                className="mt-1"
              >
                Browse Files
              </Button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border border-border/60 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-sm">{encryptedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {fileDetails?.size}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleRemoveFile} className="h-7 w-7">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="encryptionKey" className="text-sm">Encryption Key</Label>
                  <Input
                    id="encryptionKey"
                    value={encryptionKey}
                    onChange={(e) => setEncryptionKey(e.target.value)}
                    placeholder="Paste the encryption key here"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Paste the complete encryption key you received when encrypting the file
                  </p>
                </div>
                
                <Button 
                  onClick={handleDecrypt} 
                  disabled={!encryptedFile || !encryptionKey || isDecrypting}
                  className="w-full"
                  size="sm"
                >
                  {isDecrypting ? (
                    <>
                      <Lock className="h-4 w-4 mr-2 animate-spin" />
                      Decrypting...
                    </>
                  ) : (
                    <>
                      <Unlock className="h-4 w-4 mr-2" />
                      Decrypt File
                    </>
                  )}
                </Button>
              </div>
              
              {decryptedFile && (
                <div>
                  <div className="bg-secondary/50 rounded-lg p-3 mb-3 flex items-center">
                    <Unlock className="h-4 w-4 text-primary mr-2" />
                    <div>
                      <p className="font-medium text-sm">File successfully decrypted</p>
                      <p className="text-xs text-muted-foreground">
                        Original file: {decryptedFile.name} ({(decryptedFile.size / 1024).toFixed(2)} KB)
                      </p>
                    </div>
                  </div>
                  
                  <FilePreview 
                    file={decryptedFile} 
                    onDownload={handleDownload} 
                  />
                  
                  <div className="flex justify-center mt-3">
                    <Button onClick={handleDownload} size="sm" className="w-full sm:w-auto">
                      <Download className="h-4 w-4 mr-2" />
                      Download Decrypted File
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
