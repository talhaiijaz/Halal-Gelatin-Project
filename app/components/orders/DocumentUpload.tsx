"use client";

import { useState, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { 
  Upload, 
  File, 
  X, 
  Download, 
  Trash2,
  FileText,
  Receipt,
  Package,
  Eye
} from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import toast from "react-hot-toast";

type DocumentType = "packingList" | "proformaInvoice" | "commercialInvoice";

interface DocumentUploadProps {
  orderId: Id<"orders">;
  documentType: DocumentType;
  currentFileId?: Id<"_storage">;
  currentFileName?: string;
  onUploadComplete?: () => void;
}

const documentConfig = {
  packingList: {
    label: "Packing List",
    icon: Package,
    acceptedTypes: ".pdf,.doc,.docx,.xls,.xlsx",
    description: "Upload packing list document"
  },
  proformaInvoice: {
    label: "Pro Forma Invoice",
    icon: FileText,
    acceptedTypes: ".pdf,.doc,.docx,.xls,.xlsx",
    description: "Upload pro forma invoice"
  },
  commercialInvoice: {
    label: "Commercial Invoice",
    icon: Receipt,
    acceptedTypes: ".pdf,.doc,.docx,.xls,.xlsx",
    description: "Upload commercial invoice"
  }
};

export default function DocumentUpload({
  orderId,
  documentType,
  currentFileId,
  currentFileName,
  onUploadComplete
}: DocumentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const uploadDocument = useMutation(api.orders.uploadDocument);
  const removeDocument = useMutation(api.orders.removeDocument);
  const logDocumentView = useMutation(api.orders.logDocumentView);
  const documentUrl = useQuery(
    api.orders.getDocumentUrl, 
    currentFileId ? { storageId: currentFileId } : "skip"
  );

  const config = documentConfig[documentType];
  const Icon = config.icon;

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      toast.error('Please upload a PDF, Word document, or Excel file');
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setIsUploading(true);

    try {
      // Get upload URL
      const uploadUrl = await generateUploadUrl();

      // Upload file to Convex storage
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      const { storageId } = await result.json();

      // Update order with document
      await uploadDocument({
        orderId,
        documentType,
        storageId,
      });

      toast.success(`${config.label} uploaded successfully`);
      onUploadComplete?.();
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleRemoveDocument = async () => {
    if (!currentFileId) return;

    try {
      await removeDocument({
        orderId,
        documentType,
      });

      toast.success(`${config.label} removed successfully`);
      onUploadComplete?.();
    } catch (error) {
      console.error('Remove failed:', error);
      toast.error('Failed to remove document');
    }
  };

  const handleView = async () => {
    if (documentUrl && currentFileId) {
      try {
        // Log the document view activity
        await logDocumentView({
          orderId,
          documentType,
          storageId: currentFileId,
        });
        
        // Open file in new tab for viewing
        window.open(documentUrl, '_blank');
      } catch (error) {
        console.error('Failed to log document view:', error);
        // Still open the document even if logging fails
        window.open(documentUrl, '_blank');
      }
    }
  };

  const handleDownload = async () => {
    if (documentUrl && currentFileId) {
      try {
        // Log the document download activity
        await logDocumentView({
          orderId,
          documentType,
          storageId: currentFileId,
        });
        
        // Create a temporary link and click it
        const link = document.createElement('a');
        link.href = documentUrl;
        link.download = currentFileName || `${config.label}.pdf`;
        link.target = '_blank';
        link.click();
      } catch (error) {
        console.error('Failed to log document download:', error);
        // Still download the document even if logging fails
        const link = document.createElement('a');
        link.href = documentUrl;
        link.download = currentFileName || `${config.label}.pdf`;
        link.target = '_blank';
        link.click();
      }
    }
  };

  return (
    <div className="border border-gray-300 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <Icon className="h-5 w-5 text-gray-500 mr-2" />
          <h3 className="text-sm font-medium text-gray-900">{config.label}</h3>
        </div>
        {currentFileId && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleView}
              className="p-1 text-gray-400 hover:text-green-500 transition-colors"
              title="View"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={handleDownload}
              className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={handleRemoveDocument}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
              title="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {currentFileId ? (
        // Show current file
        <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
          <File className="h-5 w-5 text-green-500 mr-3" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">
              {currentFileName || `${config.label}.pdf`}
            </p>
            <p className="text-xs text-green-600">Document uploaded</p>
          </div>
        </div>
      ) : (
        // Show upload area
        <div
          className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-gray-300 hover:border-gray-400'
          } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={config.acceptedTypes}
            onChange={handleFileInputChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isUploading}
          />
          
          <div className="space-y-2">
            <Upload className={`mx-auto h-8 w-8 ${
              dragActive ? 'text-primary' : 'text-gray-400'
            }`} />
            <div>
              <p className="text-sm text-gray-600">
                {isUploading ? 'Uploading...' : 'Drop file here or click to upload'}
              </p>
              <p className="text-xs text-gray-500">
                PDF, Word, or Excel files up to 10MB
              </p>
            </div>
          </div>

          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span className="text-sm text-gray-600">Uploading...</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
