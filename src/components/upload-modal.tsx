
import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Upload, File, X, Copy, Shield, Lock, Unlock, Download, Check, AlertTriangle, Eye, Image as ImageIcon, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { encryptFile, EncryptionResult, generateFilePreview, downloadFile } from "@/utils/encryption";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload?: (fileData: UploadFileData) => void;
}

export interface UploadFileData {
  file: File;
  encrypt: boolean;
  encryptionData?: {
    algorithm: string;
    encryptionKey: string;
    iv: string;
    checksum: string;
    originalFile: File;
  };
}

export function UploadModal({ isOpen, onClose, onUpload }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [encrypt, setEncrypt] = useState(false);
  const [encryptionResult, setEncryptionResult] = useState<EncryptionResult | null>(null);
  const [encrypted, setEncrypted] = useState(false);
  const [fileDetails, setFileDetails] = useState<{
    type: string,
    size: string,
    lastModified: string
  } | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [showEncryptionConfirmation, setShowEncryptionConfirmation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleClose = () => {
    setFile(null);
    setPreview(null);
    setIsEncrypting(false);
    setIsUploading(false);
    setEncrypted(false);
    setEncryptionResult(null);
    setFileDetails(null);
    setTags([]);
    setIsPreviewModalOpen(false);
    setShowEncryptionConfirmation(false);
    onClose();
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setEncrypted(false);
      setEncryptionResult(null);
      setShowEncryptionConfirmation(false);
      
      setFileDetails({
        type: selectedFile.type || 'Unknown',
        size: (selectedFile.size / 1024).toFixed(2) + ' KB',
        lastModified: new Date(selectedFile.lastModified).toLocaleString()
      });
      
      generatePreview(selectedFile);
    }
  };
  
  const generatePreview = async (file: File) => {
    try {
      const previewUrl = await generateFilePreview(file);
      setPreview(previewUrl);
    } catch (error) {
      console.error("Failed to generate preview:", error);
      setPreview(null);
    }
  };
  
  const handlePreviewClick = async () => {
    if (!file) return;
    
    try {
      const content = await generateFilePreview(file);
      setPreviewContent(content);
      setIsPreviewModalOpen(true);
    } catch (error) {
      console.error("Failed to generate preview:", error);
      toast({
        title: "Preview failed",
        description: "Failed to generate file preview",
        variant: "destructive",
      });
    }
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      setEncrypted(false);
      setEncryptionResult(null);
      setShowEncryptionConfirmation(false);
      
      setFileDetails({
        type: droppedFile.type || 'Unknown',
        size: (droppedFile.size / 1024).toFixed(2) + ' KB',
        lastModified: new Date(droppedFile.lastModified).toLocaleString()
      });
      
      generatePreview(droppedFile);
    }
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };
  
  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleRemoveFile = () => {
    setFile(null);
    setPreview(null);
    setFileDetails(null);
    setShowEncryptionConfirmation(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tagValue = tagInputRef.current?.value?.trim();
      if (tagValue && !tags.includes(tagValue)) {
        setTags([...tags, tagValue]);
      }
      if (tagInputRef.current) {
        tagInputRef.current.value = '';
      }
    }
  };
  
  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleEncrypt = async () => {
    if (!file) return;
    
    try {
      setIsEncrypting(true);
      
      try {
        const encryptionResult = await encryptFile(file);
        setEncryptionResult(encryptionResult);
        setEncrypted(true);
        setShowEncryptionConfirmation(true); // Show confirmation screen with key
      } catch (encErr) {
        console.error("Encryption failed:", encErr);
        toast({
          title: "Encryption failed",
          description: "Failed to encrypt file",
          variant: "destructive",
        });
        setIsEncrypting(false);
        return;
      }
    } catch (error) {
      console.error("Encryption process failed:", error);
      toast({
        title: "Process failed",
        description: "An error occurred during encryption",
        variant: "destructive",
      });
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    try {
      setIsUploading(true);
      
      let uploadData: UploadFileData = {
        file,
        encrypt: encrypt
      };
      
      if (encrypt) {
        if (!showEncryptionConfirmation) {
          // If we haven't encrypted yet, do it and show confirmation
          await handleEncrypt();
          return;
        }
        
        if (!encryptionResult) {
          toast({
            title: "Encryption required",
            description: "Please encrypt the file before uploading",
            variant: "destructive",
          });
          setIsUploading(false);
          return;
        }
        
        uploadData = {
          file: encryptionResult.encryptedFile,
          encrypt: true,
          encryptionData: {
            algorithm: encryptionResult.algorithm,
            encryptionKey: encryptionResult.encryptionKey,
            iv: encryptionResult.iv,
            checksum: encryptionResult.checksum,
            originalFile: file
          }
        };
      }
      
      if (onUpload) {
        await onUpload(uploadData);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      toast({
        title: "Upload failed",
        description: "An error occurred during upload",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleDownloadEncrypted = () => {
    if (encryptionResult?.encryptedFile) {
      downloadFile(encryptionResult.encryptedFile);
      
      toast({
        title: "Download started",
        description: `${encryptionResult.encryptedFile.name} is being downloaded`,
      });
    }
  };
  
  const handleCopyToClipboard = () => {
    if (encryptionResult?.encryptionKey) {
      navigator.clipboard.writeText(encryptionResult.encryptionKey);
      toast({
        title: "Copied to clipboard",
        description: "Decryption key copied to clipboard",
      });
    }
  };
  
  const renderPreviewIcon = () => {
    if (!file) return null;
    
    if (file.type.startsWith('image/')) {
      return preview ? (
        <img 
          src={preview} 
          alt="File preview" 
          className="mt-3 rounded-md max-h-32 object-contain" 
        />
      ) : (
        <ImageIcon className="h-10 w-10 text-muted-foreground" />
      );
    } else if (file.type === 'application/pdf') {
      return <FileText className="h-10 w-10 text-muted-foreground" />;
    } else {
      return <File className="h-10 w-10 text-muted-foreground" />;
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload File</DialogTitle>
          <DialogDescription>
            Upload a file to your secure vault
          </DialogDescription>
        </DialogHeader>
        
        {showEncryptionConfirmation ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <Shield className="h-4 w-4 mr-2 text-green-500" />
                  File Encrypted Successfully
                </CardTitle>
                <CardDescription>
                  Your file has been encrypted. Save your decryption key before continuing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="key" className="text-sm">Decryption Key</Label>
                  <div className="flex">
                    <Input
                      id="key"
                      value={encryptionResult?.encryptionKey || ''}
                      readOnly
                      className="flex-1 font-mono text-sm"
                    />
                    <Button 
                      variant="outline" 
                      className="ml-2"
                      onClick={handleCopyToClipboard}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You will need this key to decrypt your file later.
                  </p>
                </div>
                
                {encryptionResult?.iv && (
                  <div className="space-y-2">
                    <Label htmlFor="iv" className="text-sm">IV (Initialization Vector)</Label>
                    <div className="flex">
                      <Input
                        id="iv"
                        value={encryptionResult.iv}
                        readOnly
                        className="flex-1 font-mono text-sm"
                      />
                      <Button 
                        variant="outline" 
                        className="ml-2"
                        onClick={() => {
                          if (encryptionResult?.iv) {
                            navigator.clipboard.writeText(encryptionResult.iv);
                            toast({
                              title: "Copied to clipboard",
                              description: "IV copied to clipboard",
                            });
                          }
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      You may need both the key and IV to decrypt your file.
                    </p>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <Button variant="outline" size="sm" onClick={handleDownloadEncrypted}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Encrypted File
                  </Button>
                  
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={handleUpload}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Upload className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Continue & Upload
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This key will only be shown once. Make sure to save it in a secure location.
              </AlertDescription>
            </Alert>
          </div>
        ) : !encrypted ? (
          <div className="space-y-4 py-2">
            {!file ? (
              <div 
                className="border-2 border-dashed border-border/60 rounded-lg p-6 text-center flex flex-col items-center justify-center gap-3"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <div className="bg-secondary rounded-full p-3">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-medium mb-1">Upload File</h3>
                  <p className="text-muted-foreground text-sm">Drag and drop your file here</p>
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
                      <File className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-sm">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {fileDetails?.size} • {fileDetails?.type}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleRemoveFile} className="h-7 w-7">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="mt-3 flex items-center justify-center">
                    {renderPreviewIcon()}
                  </div>
                  
                  <div className="mt-3 flex justify-center">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handlePreviewClick}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Preview File
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="encrypt"
                      checked={encrypt}
                      onCheckedChange={setEncrypt} 
                    />
                    <Label
                      htmlFor="encrypt"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {encrypt ? (
                        <span className="flex items-center">
                          <Lock className="h-4 w-4 mr-2" />
                          Encrypt file
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <Unlock className="h-4 w-4 mr-2" />
                          Encrypt file
                        </span>
                      )}
                    </Label>
                  </div>
                  
                  {encrypt && (
                    <p className="text-sm text-muted-foreground">
                      Your file will be encrypted before uploading.
                      You'll need a decryption key to access it later.
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="tags" className="text-sm">Tags</Label>
                  <div className="flex items-center">
                    <Input
                      id="tags"
                      type="text"
                      placeholder="Add tags"
                      className="mr-2"
                      onKeyDown={handleTagKeyDown}
                      ref={tagInputRef}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="capitalize">
                        {tag}
                        <button
                          className="ml-1 inline-flex items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary"
                          onClick={() => removeTag(tag)}
                        >
                          <X className="h-3 w-3 stroke-width-2" aria-hidden="true" />
                          <span className="sr-only">Remove</span>
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <Button
                  onClick={encrypt ? handleEncrypt : handleUpload}
                  className="w-full"
                  disabled={isUploading || isEncrypting}
                >
                  {isUploading || isEncrypting ? (
                    <>
                      {isEncrypting ? (
                        <>
                          <Lock className="h-4 w-4 mr-2 animate-spin" />
                          Encrypting...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      {encrypt ? (
                        <>
                          <Lock className="h-4 w-4 mr-2" />
                          Encrypt File
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload File
                        </>
                      )}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        ) : null}
        
        {isPreviewModalOpen && file && (
          <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>File Preview: {file.name}</DialogTitle>
              </DialogHeader>
              <div className="preview-container max-h-[60vh] overflow-auto p-4 border border-border/30 rounded-md">
                {file.type.startsWith('image/') && previewContent && (
                  <img 
                    src={previewContent} 
                    alt={file.name} 
                    className="max-w-full object-contain mx-auto"
                  />
                )}
                {file.type === 'application/pdf' && previewContent && (
                  <iframe 
                    src={previewContent} 
                    className="w-full h-[50vh]" 
                    title={file.name}
                  />
                )}
                {(file.type === 'text/plain' || 
                  file.type === 'text/html' || 
                  file.type === 'application/json') && 
                  previewContent && (
                  <pre className="whitespace-pre-wrap text-sm p-4">
                    {previewContent}
                  </pre>
                )}
                {(!file.type.startsWith('image/') && 
                  file.type !== 'application/pdf' && 
                  file.type !== 'text/plain' && 
                  file.type !== 'text/html' && 
                  file.type !== 'application/json') && (
                  <div className="flex flex-col items-center justify-center p-8">
                    <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="font-medium">{file.name}</p>
                    <p className="text-muted-foreground">Preview not available for this file type</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setIsPreviewModalOpen(false)}
                >
                  Close Preview
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
