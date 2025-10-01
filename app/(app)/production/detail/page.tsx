"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Search, Filter, Loader2, AlertCircle, CheckCircle, Upload, X, Trash2 } from "lucide-react";
import { useProductionYear } from "../../../hooks/useProductionYear";

interface BatchData {
  _id: Id<"productionBatches">;
  _creationTime: number;
  batchNumber: number;
  serialNumber: string;
  viscosity?: number;
  bloom?: number;
  percentage?: number;
  ph?: number;
  conductivity?: number;
  moisture?: number;
  h2o2?: number;
  so2?: number;
  color?: string;
  clarity?: string;
  odour?: string;
  sourceReport?: string;
  reportDate?: number;
  fileId?: Id<"_storage">;
  isUsed?: boolean;
  isOnHold?: boolean;
  usedInOrder?: string;
  usedDate?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export default function ProductionDetailPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUsed, setFilterUsed] = useState("all");
  const [selectedBatches, setSelectedBatches] = useState<Set<string>>(new Set());
  const [showReportsModal, setShowReportsModal] = useState(false);
  
  // Use the shared year management system
  const { currentYear, currentFiscalYear } = useProductionYear();
  
  // Upload functionality
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<{
    createdCount: number;
    skippedCount: number;
    summary: string;
    skippedBatches?: Array<{batchNumber: number; reason: string}>;
    extractedLinesCount?: number;
  } | null>(null);
  const [showUploadSection, setShowUploadSection] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch all batches for current fiscal year
  const batches = useQuery(api.productionBatches.getAllBatches, {
    paginationOpts: { numItems: 1000 },
    fiscalYear: currentFiscalYear
  });

  // Fetch current year info
  const yearInfo = useQuery(api.productionBatches.getCurrentYearInfo);
  
  // Fetch current processing state
  const processingState = useQuery(api.productionProcessing.getCurrentProcessingState);

  // Mutations
  const createBatchesFromExtractedData = useMutation(api.productionBatches.createBatchesFromExtractedData);
  const startProcessing = useMutation(api.productionProcessing.startProcessing);
  const updateProcessingState = useMutation(api.productionProcessing.updateProcessingState);
  const clearProcessingState = useMutation(api.productionProcessing.clearProcessingState);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const getFileUrl = useMutation(api.productionBatches.getFileUrl);
  const toggleBatchHold = useMutation(api.productionBatches.toggleBatchHold);
  const deleteBatch = useMutation(api.productionBatches.deleteBatch);
  const deleteMultipleBatches = useMutation(api.productionBatches.deleteMultipleBatches);

  // Get unique source reports for filter
  const sourceReports = batches?.page ? 
    Array.from(new Set(batches.page.map(batch => batch.sourceReport).filter(Boolean))) : [];

  // Calculate averages for available batches
  const availableBatches = batches?.page?.filter(batch => !batch.isUsed) || [];
  const bloomAverage = availableBatches.length > 0 
    ? (availableBatches.reduce((sum, batch) => sum + (batch.bloom || 0), 0) / availableBatches.length).toFixed(1)
    : "0.0";
  const viscosityAverage = availableBatches.length > 0 
    ? (availableBatches.reduce((sum, batch) => sum + (batch.viscosity || 0), 0) / availableBatches.length).toFixed(1)
    : "0.0";

  // Filter batches based on search and filters
  const filteredBatches = batches?.page?.filter(batch => {
    const matchesSearch = searchTerm === "" || 
      batch.batchNumber.toString().includes(searchTerm);

    const matchesUsed = filterUsed === "all" || 
      (filterUsed === "used" && batch.isUsed) ||
      (filterUsed === "unused" && !batch.isUsed);

    return matchesSearch && matchesUsed;
  }) || [];

  // Sort filtered batches: available first, then used, both by batch number (highest to lowest)
  const sortedBatches = filteredBatches.sort((a, b) => {
    // If one is used and one is not, prioritize available (unused) batches
    if (a.isUsed && !b.isUsed) return 1;  // Used batch goes after available
    if (!a.isUsed && b.isUsed) return -1; // Available batch goes before used
    
    // If both have the same usage status, sort by batch number (highest to lowest)
    return b.batchNumber - a.batchNumber;
  });

  // Helper function to check if batch can be deleted (within 48 hours)
  const canDeleteBatch = (batch: BatchData) => {
    const now = Date.now();
    const creationTime = batch.createdAt || batch._creationTime;
    const hoursSinceCreation = (now - creationTime) / (1000 * 60 * 60);
    return hoursSinceCreation <= 48;
  };

  const handleDeleteBatch = async (batchId: Id<"productionBatches">) => {
    // Find the batch to check if it's used and can be deleted
    const batch = batches?.page?.find(b => b._id === batchId);
    if (!batch) return;
    
    if (batch.isUsed) {
      alert("Cannot delete batch that has been used in a blend. Please delete the blend first to free up the batch.");
      return;
    }
    
    if (!canDeleteBatch(batch)) {
      alert("Cannot delete batch: Batch is older than 48 hours.");
      return;
    }
    
    if (confirm("Are you sure you want to delete this batch?")) {
      try {
        await deleteBatch({ id: batchId });
        console.log("Batch deleted successfully:", batchId);
      } catch (error) {
        console.error("Error deleting batch:", error);
        alert("Failed to delete batch. Please try again.");
      }
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedBatches.size === 0) return;

    // Filter to only include batches that can be deleted
    const deletableBatches = Array.from(selectedBatches).filter(batchId => {
      const batch = batches?.page?.find(b => b._id === batchId);
      return batch && !batch.isUsed && canDeleteBatch(batch);
    });

    if (deletableBatches.length === 0) {
      alert("No selected batches can be deleted (either used in blends or older than 48 hours).");
      return;
    }

    try {
      const batchIds = deletableBatches as Id<"productionBatches">[];
      const deletedCount = await deleteMultipleBatches({ batchIds });
      console.log(`Successfully deleted ${deletedCount} batches:`, batchIds);
      setSelectedBatches(new Set());
      alert(`Successfully deleted ${deletedCount} out of ${selectedBatches.size} selected batches.`);
    } catch (error) {
      console.error("Error deleting batches:", error);
      alert("Failed to delete selected batches. Please try again.");
    }
  };

  const handleSelectBatch = (batchId: string) => {
    // Find the batch to check if it's used
    const batch = batches?.page?.find(b => b._id === batchId);
    if (batch?.isUsed) {
      alert("Cannot select batch that has been used in a blend for deletion.");
      return;
    }
    
    const newSelected = new Set(selectedBatches);
    if (newSelected.has(batchId)) {
      newSelected.delete(batchId);
    } else {
      newSelected.add(batchId);
    }
    setSelectedBatches(newSelected);
  };

  const handleSelectAll = () => {
    // Only select available (unused) batches
    const availableBatches = sortedBatches.filter(batch => !batch.isUsed);
    const availableBatchIds = availableBatches.map(batch => batch._id);
    
    if (selectedBatches.size === availableBatchIds.length) {
      setSelectedBatches(new Set());
    } else {
      setSelectedBatches(new Set(availableBatchIds));
    }
  };




  // Upload functions
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setUploadedFile(file);
      setUploadError(null);
    } else {
      setUploadError('Please select a valid PDF file');
    }
  };

  const handleUploadAndProcess = async () => {
    if (!uploadedFile) return;

    setIsUploading(true);
    setUploadError(null);
    let processingId: Id<"productionProcessing"> | null = null;
    let fileId: Id<"_storage"> | null = null;

    try {
      // Start processing state
      processingId = await startProcessing({
        fileName: uploadedFile.name,
      });

      // Update processing state to uploading
      await updateProcessingState({
        processingId,
        status: "uploading",
        progress: "Uploading file...",
      });

      // First, upload the file to storage
      console.log('Uploading file to storage...');
      const uploadUrl = await generateUploadUrl();
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': uploadedFile.type },
        body: uploadedFile,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to storage');
      }

      const { storageId } = await uploadResponse.json();
      fileId = storageId;
      console.log('File uploaded to storage:', fileId);

      // Extract the data from PDF
      console.log('Extracting data from PDF...');
      
      // Update processing state to processing
      await updateProcessingState({
        processingId,
        status: "processing",
        progress: "Extracting data from PDF...",
      });

      const formData = new FormData();
      formData.append('file', uploadedFile);

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/pdf/extract', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract PDF content');
      }

      const data = await response.json();
      console.log('PDF extraction completed');

      // Create batches from extracted data with processing ID and file ID
      console.log('Creating batches...');
      const result = await createBatchesFromExtractedData({
        extractedData: data.text,
        sourceReport: uploadedFile.name,
        reportDate: Date.now(),
        processingId,
        fileId: fileId || undefined,
      });
      console.log('Batches created successfully');

      setUploadSuccess(true);
      setUploadSummary({
        createdCount: result.createdCount,
        skippedCount: result.skippedCount,
        summary: result.summary,
        skippedBatches: result.skippedBatches,
        extractedLinesCount: result.extractedLinesCount
      });
      setUploadedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Auto-dismiss success notification after 8 seconds
      setTimeout(() => {
        setUploadSuccess(false);
        setUploadSummary(null);
      }, 8000);

    } catch (err) {
      // Don't show error if the request was aborted (cancelled by user)
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Upload cancelled by user');
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'An error occurred during upload';
      setUploadError(errorMessage);
      
      // Update processing state to error if we have a processingId
      if (processingId) {
        try {
          await updateProcessingState({
            processingId,
            status: "error",
            errorMessage: errorMessage,
          });
        } catch (updateError) {
          console.error('Failed to update processing state to error:', updateError);
        }
      }
    } finally {
      setIsUploading(false);
      abortControllerRef.current = null;
    }
  };

  const handleClearUpload = () => {
    setUploadedFile(null);
    setUploadError(null);
    setUploadSuccess(false);
    setUploadSummary(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleViewFile = async (fileId: Id<"_storage">, fileName: string) => {
    try {
      // Use the Convex mutation to get file URL
      const fileUrl = await getFileUrl({ fileId });
      
      // Open the file in a new tab
      if (fileUrl) {
        window.open(fileUrl, '_blank');
      } else {
        alert('File URL not available. Please try again.');
      }
    } catch (error) {
      console.error('Error viewing file:', error);
      alert('Failed to open file. Please try again.');
    }
  };

  const handleClearProcessingState = async () => {
    if (processingState) {
      await clearProcessingState({ processingId: processingState._id });
    }
  };

  const handleStartNewUpload = () => {
    handleClearProcessingState();
    setShowUploadSection(true);
  };

  const handleCancelProcessing = async () => {
    // Abort the fetch request if it's in progress
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Clear processing state
    if (processingState) {
      await clearProcessingState({ processingId: processingState._id });
    }
    
    // Reset all upload states
    setIsUploading(false);
    setUploadedFile(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };



  const formatValue = (value: any) => {
    if (value === undefined || value === null) return "N/A";
    if (typeof value === 'number') return value.toString();
    return value;
  };

  if (batches === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-sm text-gray-600">Loading production data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
      <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Production Detail</h1>
              <p className="mt-2 text-gray-600">
                Manage and view production batch data extracted from PDF reports
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Fiscal Year:</label>
                <span className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm font-medium text-gray-900">
                  {currentFiscalYear}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Production Batches</h2>
              {!processingState && (
                <button
                  onClick={() => setShowUploadSection(!showUploadSection)}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload Production Report</span>
                </button>
              )}
            </div>

            {/* Processing State */}
            {processingState && (
              <div className="border-t border-gray-200 pt-4">
                {processingState.status === "uploading" && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        <div>
                          <p className="text-sm font-medium text-blue-800">Uploading {processingState.fileName}...</p>
                          <p className="text-xs text-blue-600">{processingState.progress}</p>
                        </div>
                      </div>
                      <button
                        onClick={handleCancelProcessing}
                        className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {processingState.status === "processing" && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-600"></div>
                        <div>
                          <p className="text-sm font-medium text-yellow-800">Processing {processingState.fileName}...</p>
                          <p className="text-xs text-yellow-600">{processingState.progress}</p>
                        </div>
                      </div>
                      <button
                        onClick={handleCancelProcessing}
                        className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {processingState.status === "completed" && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-green-800">Processing Complete!</p>
                          <p className="text-xs text-green-600">{processingState.progress}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={handleClearProcessingState}
                          className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-md hover:bg-green-200"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={handleStartNewUpload}
                          className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                        >
                          Upload New
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {processingState.status === "error" && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <X className="h-5 w-5 text-red-600" />
                        <div>
                          <p className="text-sm font-medium text-red-800">Processing Failed</p>
                          <p className="text-xs text-red-600">{processingState.errorMessage}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={handleClearProcessingState}
                          className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={handleStartNewUpload}
                          className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                        >
                          Try Again
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Upload Form */}
            {showUploadSection && !processingState && (
              <div className="border-t border-gray-200 pt-4">
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="pdf-upload"
                    />
                    <label
                      htmlFor="pdf-upload"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      <Upload className="h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-sm text-gray-600 mb-2">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">Production report PDFs only</p>
                    </label>
                  </div>

                  {uploadedFile && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <div>
                            <p className="text-sm font-medium text-green-800">{uploadedFile.name}</p>
                            <p className="text-xs text-green-600">
                              {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleClearUpload}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {uploadError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span className="text-sm text-red-600">{uploadError}</span>
                      </div>
                    </div>
                  )}

                  {isUploading && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-blue-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm font-medium">Processing PDF and creating batches...</span>
                      </div>
                      <div className="text-xs text-blue-700 mt-2">
                        <p>• Extracting data with AI</p>
                        <p>• Creating batch records</p>
                        <p>• Checking for duplicates</p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={handleUploadAndProcess}
                      disabled={!uploadedFile || isUploading}
                      className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload & Process
                        </>
                      )}
                    </button>
                    
                    {uploadedFile && (
                      <button
                        onClick={handleClearUpload}
                        className="px-4 btn-secondary"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
      </div>

      {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Batches</p>
              <p className="text-2xl font-bold text-gray-900">{batches.page?.length || 0}</p>
            </div>
          </div>
        </div>

       

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Available</p>
              <p className="text-2xl font-bold text-gray-900">
                {batches.page?.filter(batch => !batch.isUsed).length || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Used</p>
              <p className="text-2xl font-bold text-gray-900">
                {batches.page?.filter(batch => batch.isUsed).length || 0}
              </p>
            </div>
          </div>
        </div>

        <div 
          className="bg-white p-6 rounded-lg shadow-sm border cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowReportsModal(true)}
        >
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Reports</p>
              <p className="text-2xl font-bold text-gray-900">{sourceReports.length}</p>
            </div>
          </div>
        </div>

         {/* Total Quantity (kg) */}
         <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-cyan-100 rounded-lg">
              <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Quantity (kg)</p>
              <p className="text-2xl font-bold text-gray-900">{((batches.page?.length || 0) * 250).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Available Quantity (kg) */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Available Quantity (kg)</p>
              <p className="text-2xl font-bold text-gray-900">{(((batches.page?.filter(b => !b.isUsed).length) || 0) * 250).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Bloom Average</p>
              <p className="text-2xl font-bold text-gray-900">{bloomAverage}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-teal-100 rounded-lg">
              <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Viscosity Average</p>
              <p className="text-2xl font-bold text-gray-900">{viscosityAverage}</p>
            </div>
          </div>
        </div>
      </div>


      {/* Action Buttons */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-3">
          {selectedBatches.size > 0 && (
            <>
              <button
                onClick={() => setSelectedBatches(new Set())}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Clear Selection
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search by batch number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filterUsed}
              onChange={(e) => setFilterUsed(e.target.value)}
              className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Batches</option>
              <option value="unused">Available</option>
              <option value="used">Used</option>
            </select>
          </div>
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedBatches.size === sortedBatches.filter(b => !b.isUsed).length && sortedBatches.filter(b => !b.isUsed).length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="sticky left-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider z-10 border-r border-gray-200">
                          Batch
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Viscocity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bloom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    % age
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    PH
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Conductivity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Moisture
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  H2O2
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SO2
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Color
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Clarity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Odour
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedBatches.map((batch) => (
                <tr key={batch._id} className={`${batch.isUsed ? 'bg-green-100' : ''} ${batch.isOnHold ? 'bg-amber-50' : ''} hover:bg-gray-50`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedBatches.has(batch._id)}
                      onChange={() => handleSelectBatch(batch._id)}
                      disabled={batch.isUsed}
                      className={`rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${
                        batch.isUsed ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      title={batch.isUsed ? 'Cannot select used batch for deletion' : 'Select batch for deletion'}
                    />
                  </td>
                  <td className={`sticky left-0 px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 z-10 border-r border-gray-200 ${
                    batch.isUsed ? 'bg-green-100' : batch.isOnHold ? 'bg-amber-50' : 'bg-white'
                  }`}>
                    {batch.batchNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatValue(batch.viscosity)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatValue(batch.bloom)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatValue(batch.percentage)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatValue(batch.ph)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatValue(batch.conductivity)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatValue(batch.moisture)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatValue(batch.h2o2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatValue(batch.so2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatValue(batch.color)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatValue(batch.clarity)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatValue(batch.odour)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {batch.isOnHold ? (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">On Hold</span>
                    ) : (
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        batch.isUsed 
                          ? 'bg-orange-100 text-orange-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {batch.isUsed ? (
                          <span className="flex items-center gap-1">
                            <span>Used</span>
                            {batch.usedInOrder && (
                              <span className="text-xs opacity-75">({batch.usedInOrder})</span>
                            )}
                          </span>
                        ) : 'Available'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {batch.sourceReport && (
                      <span 
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          batch.fileId 
                            ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer' 
                            : 'bg-gray-100 text-gray-800'
                        }`}
                        onClick={batch.fileId ? () => handleViewFile(batch.fileId!, batch.sourceReport!) : undefined}
                        title={batch.fileId ? 'Click to view file' : 'File not available'}
                      >
                        {batch.sourceReport}
                        {batch.fileId && (
                          <svg className="ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                    <button
                      onClick={() => toggleBatchHold({ id: batch._id, isOnHold: !batch.isOnHold })}
                      className={`$${''} ${batch.isOnHold ? 'text-amber-700' : 'text-gray-700'} hover:underline`}
                      title="Toggle hold"
                    >
                      {batch.isOnHold ? 'Release Hold' : 'Hold'}
                    </button>
                    {canDeleteBatch(batch) && (
                      <button
                        onClick={() => handleDeleteBatch(batch._id)}
                        disabled={batch.isUsed}
                        className={`${
                          batch.isUsed 
                            ? 'text-gray-400 cursor-not-allowed' 
                            : 'text-red-600 hover:text-red-900'
                        }`}
                        title={batch.isUsed ? 'Cannot delete batch that has been used in a blend' : 'Delete batch (within 48 hours)'}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedBatches.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No batches found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {batches.page?.length === 0 
                  ? "No production batches have been created yet. Upload a PDF report to get started."
                : "Try adjusting your search or filter criteria."
              }
            </p>
          </div>
        )}
        </div>
      </div>




      {/* Upload Success Notification */}
      {uploadSuccess && (
        <div className="fixed top-4 right-4 bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg z-50 max-w-md">
          <div className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <span className="text-green-800 font-medium block">Production report processed successfully!</span>
              {uploadSummary && (
                <div className="mt-2 text-sm text-green-700">
                  <div className="font-medium">{uploadSummary.summary}</div>
                  {uploadSummary.extractedLinesCount && (
                    <div className="text-xs text-green-600 mt-1">
                      Extracted {uploadSummary.extractedLinesCount} lines from PDF
                    </div>
                  )}
                  {uploadSummary.skippedCount > 0 && uploadSummary.skippedBatches && (
                    <div className="mt-1">
                      <div className="text-xs text-green-600">Skipped batches:</div>
                      <div className="text-xs text-green-600">
                        {uploadSummary.skippedBatches.slice(0, 5).map(batch => `#${batch.batchNumber}`).join(', ')}
                        {uploadSummary.skippedBatches.length > 5 && ` and ${uploadSummary.skippedBatches.length - 5} more`}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reports Modal */}
      {showReportsModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 xl:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Production Reports ({sourceReports.length})
                </h3>
                <button
                  onClick={() => setShowReportsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {sourceReports.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No reports found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      No production reports have been uploaded yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sourceReports.map((reportName, index) => {
                      // Find batches with this report name and fileId
                      const batchesWithFile = batches?.page?.filter(batch => 
                        batch.sourceReport === reportName && batch.fileId
                      ) || [];
                      
                      return (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="p-2 bg-purple-100 rounded-lg">
                                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{reportName}</p>
                                <p className="text-xs text-gray-500">
                                  {batchesWithFile.length} batch(es) from this report
                                </p>
                              </div>
                            </div>
                            {batchesWithFile.length > 0 && (
                              <button
                                onClick={() => handleViewFile(batchesWithFile[0].fileId!, reportName || 'Unknown Report')}
                                className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                View File
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
