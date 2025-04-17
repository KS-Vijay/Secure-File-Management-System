
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { FileGrid } from "@/components/file-grid";
import { FileToolbar } from "@/components/file-toolbar";
import { UploadModal, UploadFileData } from "@/components/upload-modal";
import { DecryptionModal } from "@/components/decryption-modal";
import { Button } from "@/components/ui/button";
import { NavIcons } from "@/components/ui/icons";
import { Unlock } from "lucide-react";
import { isAuthenticated } from "@/utils/auth";
import { useNavigate } from "react-router-dom";
import { getAllFiles, FileInfo } from "@/utils/file-storage";
import { toast } from "sonner";
import { logInfo, LogCategory } from "@/utils/audit-logger";

export default function Dashboard() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDecryptModalOpen, setIsDecryptModalOpen] = useState(false);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentView, setCurrentView] = useState<"grid" | "list">("grid");
  const navigate = useNavigate();
  const { toast: uiToast } = useToast();
  
  useEffect(() => {
    // Redirect if not authenticated
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }
    
    // Load files
    loadFiles();
    
    // Set up interval to refresh files every 10 seconds
    const refreshInterval = setInterval(() => {
      loadFiles();
    }, 10000);
    
    return () => clearInterval(refreshInterval);
  }, [navigate]);
  
  // Add this new useEffect to load files when the component mounts or when route changes
  useEffect(() => {
    if (isAuthenticated()) {
      loadFiles();
    }
  }, []);
  
  const loadFiles = () => {
    try {
      // Get all files
      const allFiles = getAllFiles();
      console.log("Loaded files:", allFiles.length);
      setFiles(allFiles);
      
      // Log file load operation
      logInfo(LogCategory.FILE, `Loaded ${allFiles.length} files in dashboard`, {});
    } catch (error) {
      console.error("Error loading files:", error);
      toast.error("Failed to load files");
    }
  };
  
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query) {
      loadFiles();
      return;
    }
    
    // Filter files by query
    const filteredFiles = getAllFiles().filter(file => 
      file.name.toLowerCase().includes(query.toLowerCase()) ||
      file.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
    );
    setFiles(filteredFiles);
  };
  
  const handleFilter = () => {
    toast.info("Filter applied");
  };
  
  const handleSort = () => {
    const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name));
    setFiles(sortedFiles);
    toast.info("Files sorted alphabetically");
  };
  
  const handleViewChange = (view: "grid" | "list") => {
    setCurrentView(view);
    toast.info(`View changed to ${view} view`);
  };

  const handleFileUploaded = (fileData?: UploadFileData) => {
    // Reload files after upload
    loadFiles();
    setIsUploadModalOpen(false);
    
    // Notify the user
    if (fileData) {
      toast.success(`${fileData.file.name} uploaded successfully`);
    }
  };
  
  return (
    <div className="flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Files</h1>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setIsDecryptModalOpen(true)}
          >
            <Unlock className="h-4 w-4 mr-2" />
            Decrypt File
          </Button>
          <Button onClick={() => setIsUploadModalOpen(true)}>
            <NavIcons.Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>
      </div>
      
      <FileToolbar 
        onSearch={handleSearch}
        onFilter={handleFilter}
        onSort={handleSort}
        onViewChange={handleViewChange}
        currentView={currentView}
      />
      
      {files.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border/40 rounded-lg">
          <h3 className="text-lg font-medium mb-2">No files found</h3>
          {searchQuery ? (
            <p className="text-muted-foreground">
              No files match your search criteria.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                You haven't uploaded any files yet.
              </p>
              <Button onClick={() => setIsUploadModalOpen(true)}>
                <NavIcons.Upload className="h-4 w-4 mr-2" />
                Upload File
              </Button>
            </div>
          )}
        </div>
      ) : (
        <FileGrid files={files} />
      )}
      
      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleFileUploaded}
      />
      
      <DecryptionModal
        isOpen={isDecryptModalOpen}
        onClose={() => setIsDecryptModalOpen(false)}
      />
    </div>
  );
}
