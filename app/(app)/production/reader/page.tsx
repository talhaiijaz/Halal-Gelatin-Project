'use client';

import { useState, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  Download, 
  Trash2, 
  Loader2,
  AlertCircle,
  CheckCircle,
  Eye,
  Copy
} from 'lucide-react';

interface ExtractedData {
  text: string;
  summary: string;
  keyPoints: string[];
  metadata: {
    fileName: string;
    fileSize: number;
    extractedAt: string;
  };
}

export default function PDFExtractionPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setUploadedFile(file);
      setExtractedData(null);
      setError(null);
    } else {
      setError('Please select a valid PDF file');
    }
  };

  const handleExtract = async () => {
    if (!uploadedFile) return;

    setIsExtracting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const response = await fetch('/api/pdf/extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract PDF content');
      }

      const data = await response.json();
      setExtractedData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleClear = () => {
    setUploadedFile(null);
    setExtractedData(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const downloadAsText = () => {
    if (!extractedData) return;

    const content = `PDF Extraction Results
====================

File: ${extractedData.metadata.fileName}
Extracted: ${extractedData.metadata.extractedAt}

SUMMARY:
${extractedData.summary}

KEY POINTS:
${extractedData.keyPoints.map((point, index) => `${index + 1}. ${point}`).join('\n')}

FULL TEXT:
${extractedData.text}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${extractedData.metadata.fileName.replace('.pdf', '')}_extracted.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-8 w-8 text-orange-600" />
            <h1 className="text-3xl font-bold text-gray-900">Production Reader</h1>
          </div>
          <p className="text-gray-600">
            Upload production analysis reports to extract batch data and quality metrics
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="space-y-6">
            {/* File Upload */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Upload Production Report</h3>
              
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-orange-400 transition-colors">
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
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">File Selected</span>
                    </div>
                    <p className="text-sm text-green-700">{uploadedFile.name}</p>
                    <p className="text-xs text-green-600">
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm text-red-600">{error}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleExtract}
                    disabled={!uploadedFile || isExtracting}
                    className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExtracting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        Extract Information
                      </>
                    )}
                  </button>
                  
                  {uploadedFile && (
                    <button
                      onClick={handleClear}
                      className="px-4 btn-secondary"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Processing Status */}
            {isExtracting && (
              <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm font-medium">Processing PDF...</span>
                </div>
                <div className="text-xs text-blue-700">
                  <p>• Reading PDF content with AI</p>
                  <p>• Extracting all tabular data and measurements</p>
                  <p className="mt-1 text-blue-600">This typically takes 5-15 seconds</p>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-orange-50 rounded-lg border border-orange-200 p-6">
              <h3 className="font-semibold text-orange-900 mb-3">💡 How it works</h3>
              <div className="space-y-2 text-sm text-orange-800">
                <p>• Upload any PDF document (up to 10MB)</p>
                <p>• AI will extract ALL tabular data and rows/columns</p>
                <p>• Perfect for product analysis reports and data tables</p>
                <p>• Get clean, structured tabular data only</p>
                <p>• Download results or copy to clipboard</p>
                <p>• Works with complex tables and batch data</p>
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {extractedData ? (
              <>
                {/* Extracted Data */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Extracted Data</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(extractedData.text)}
                        className="text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </button>
                      <button
                        onClick={downloadAsText}
                        className="text-gray-600 hover:text-gray-800 px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </button>
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                        {extractedData.text}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                  <h4 className="font-medium text-gray-900 mb-2">File Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">File Name</p>
                      <p className="font-medium text-gray-900">{extractedData.metadata.fileName}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">File Size</p>
                      <p className="font-medium text-gray-900">
                        {(extractedData.metadata.fileSize / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-500">Extracted At</p>
                      <p className="font-medium text-gray-900">{extractedData.metadata.extractedAt}</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="font-medium text-gray-900 mb-2">No Results Yet</h3>
                <p className="text-gray-500 text-sm">
                  Upload a PDF file and click "Extract Information" to see results here
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
