'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useProductionYear } from '../../../hooks/useProductionYear';
import { 
  Calculator, 
  Download, 
  Save, 
  RefreshCw, 
  Target,
  Package,
  CheckCircle,
  AlertCircle,
  Info,
  Plus,
  Minus
} from 'lucide-react';
import toast from 'react-hot-toast';

interface SelectedBatch {
  batchId: string;
  batchNumber: number;
  bags: number;
  bloom?: number;
  viscosity?: number;
  percentage?: number;
  ph?: number;
  conductivity?: number;
  moisture?: number;
  h2o2?: number;
  so2?: number;
  color?: string;
  clarity?: string;
  odour?: string;
}

interface OptimizationResult {
  selectedBatches: SelectedBatch[];
  totalBags: number;
  totalWeight: number;
  averageBloom: number;
  ct3AverageBloom?: number;
  message: string;
}

export default function BlendPage() {
  const { currentFiscalYear } = useProductionYear();
  
  // Form state
  const [targetBloomMin, setTargetBloomMin] = useState<number>(240);
  const [targetBloomMax, setTargetBloomMax] = useState<number>(260);
  const [targetMeanBloom, setTargetMeanBloom] = useState<number | undefined>(undefined);
  const [targetMesh, setTargetMesh] = useState<number>(20);
  const [targetBags, setTargetBags] = useState<number>(100);
  
  // Additional targets (optional)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [additionalTargets, setAdditionalTargets] = useState({
    viscosity: undefined as number | undefined,
    percentage: undefined as number | undefined,
    ph: undefined as number | undefined,
    conductivity: undefined as number | undefined,
    moisture: undefined as number | undefined,
    h2o2: undefined as number | undefined,
    so2: undefined as number | undefined,
  });

  // Results state
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notes, setNotes] = useState('');

  // Get available batches for reference
  const availableBatches = useQuery(api.blends.getAvailableBatches, {
    fiscalYear: currentFiscalYear,
    targetBloomMin,
    targetBloomMax,
  });

  // Optimize batch selection
  const handleOptimize = async () => {
    if (!targetBloomMin || !targetBloomMax) {
      toast.error('Please enter target bloom range');
      return;
    }

    if (targetBloomMin >= targetBloomMax) {
      toast.error('Minimum bloom must be less than maximum bloom');
      return;
    }

    setIsOptimizing(true);
    try {
      const response = await fetch('/api/blend/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetBloomMin,
          targetBloomMax,
          targetMeanBloom,
          targetBags,
          fiscalYear: currentFiscalYear,
          additionalTargets: showAdvanced ? additionalTargets : undefined,
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        setOptimizationResult(result);
        toast.success(result.message);
      } else {
        toast.error(result.error || 'Failed to optimize batch selection');
      }
    } catch (error) {
      console.error('Optimization error:', error);
      toast.error('Failed to optimize batch selection');
    } finally {
      setIsOptimizing(false);
    }
  };

  // Save blend
  const handleSave = async () => {
    if (!optimizationResult || optimizationResult.selectedBatches.length === 0) {
      toast.error('Please optimize batch selection first');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/blend/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetBloomMin,
          targetBloomMax,
          targetMeanBloom,
          targetMesh,
          additionalTargets: showAdvanced ? additionalTargets : undefined,
          selectedBatches: optimizationResult.selectedBatches,
          notes,
          fiscalYear: currentFiscalYear,
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        toast.success('Blend created successfully!');
        // Reset form
        setOptimizationResult(null);
        setNotes('');
        // You could redirect to a blend details page here
      } else {
        toast.error(result.error || 'Failed to save blend');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save blend');
    } finally {
      setIsSaving(false);
    }
  };

  // Download PDF
  const handleDownloadPDF = async () => {
    if (!optimizationResult) {
      toast.error('Please optimize batch selection first');
      return;
    }

    try {
      // First save the blend if not already saved
      const saveResponse = await fetch('/api/blend/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetBloomMin,
          targetBloomMax,
          targetMeanBloom,
          targetMesh,
          additionalTargets: showAdvanced ? additionalTargets : undefined,
          selectedBatches: optimizationResult.selectedBatches,
          notes,
          fiscalYear: currentFiscalYear,
        }),
      });

      const saveResult = await saveResponse.json();
      
      if (saveResponse.ok) {
        // Now generate PDF
        const pdfResponse = await fetch('/api/blend/pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            blendId: saveResult.blendId,
          }),
        });

        if (pdfResponse.ok) {
          const blob = await pdfResponse.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `blending-sheet-${Date.now()}.pdf`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          toast.success('PDF downloaded successfully!');
        } else {
          toast.error('Failed to generate PDF');
        }
      } else {
        toast.error(saveResult.error || 'Failed to save blend');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download PDF');
    }
  };

  // Adjust bag quantities
  const adjustBags = () => {
    // No-op: Bags per batch are fixed at 10
    return;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Calculator className="h-8 w-8 text-orange-600" />
            <h1 className="text-3xl font-bold text-gray-900">Blending Sheet</h1>
          </div>
          <p className="text-gray-600">
            Create optimized blends from available production batches
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Target Specifications */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                Target Specifications
              </h2>
              
              {/* Optimization Parameters */}
              <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-700 mb-4">Optimization Parameters</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Target Bloom Range *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={targetBloomMin}
                        onChange={(e) => setTargetBloomMin(Number(e.target.value))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Min"
                      />
                      <span className="flex items-center text-gray-500">to</span>
                      <input
                        type="number"
                        value={targetBloomMax}
                        onChange={(e) => setTargetBloomMax(Number(e.target.value))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Max"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Target Mean Bloom (Optional)
                    </label>
                    <input
                      type="number"
                      value={targetMeanBloom || ''}
                      onChange={(e) => setTargetMeanBloom(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 255"
                    />
                    <p className="text-xs text-gray-500 mt-2">Preferred average bloom (±2 tolerance)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Target Bags
                    </label>
                    <input
                      type="number"
                      value={targetBags}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const rounded = Math.max(10, Math.round(val / 10) * 10);
                        setTargetBags(rounded);
                      }}
                      step={10}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="100"
                      min={10}
                      max={200}
                    />
                    <p className="text-xs text-gray-500 mt-2">Must be multiple of 10 (10 bags per batch)</p>
                  </div>
                </div>
              </div>

              {/* Documentation Fields */}
              <div className="mb-8 p-5 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-4">Documentation Fields (for PDF output)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mesh Size
                    </label>
                    <input
                      type="number"
                      value={targetMesh}
                      onChange={(e) => setTargetMesh(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="20"
                    />
                    <p className="text-xs text-gray-500 mt-2">For PDF documentation only</p>
                  </div>
                </div>
              </div>

              {/* Advanced Targets Toggle */}
              <div className="mt-4">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  <Plus className="h-4 w-4" />
                  {showAdvanced ? 'Hide' : 'Show'} Advanced Targets
                </button>
              </div>

              {/* Advanced Targets */}
              {showAdvanced && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Additional Quality Targets</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Viscosity</label>
                      <input
                        type="number"
                        value={additionalTargets.viscosity || ''}
                        onChange={(e) => setAdditionalTargets(prev => ({ ...prev, viscosity: e.target.value ? Number(e.target.value) : undefined }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Percentage</label>
                      <input
                        type="number"
                        value={additionalTargets.percentage || ''}
                        onChange={(e) => setAdditionalTargets(prev => ({ ...prev, percentage: e.target.value ? Number(e.target.value) : undefined }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">pH</label>
                      <input
                        type="number"
                        step="0.1"
                        value={additionalTargets.ph || ''}
                        onChange={(e) => setAdditionalTargets(prev => ({ ...prev, ph: e.target.value ? Number(e.target.value) : undefined }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Conductivity</label>
                      <input
                        type="number"
                        value={additionalTargets.conductivity || ''}
                        onChange={(e) => setAdditionalTargets(prev => ({ ...prev, conductivity: e.target.value ? Number(e.target.value) : undefined }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Moisture</label>
                      <input
                        type="number"
                        value={additionalTargets.moisture || ''}
                        onChange={(e) => setAdditionalTargets(prev => ({ ...prev, moisture: e.target.value ? Number(e.target.value) : undefined }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">H2O2</label>
                      <input
                        type="number"
                        value={additionalTargets.h2o2 || ''}
                        onChange={(e) => setAdditionalTargets(prev => ({ ...prev, h2o2: e.target.value ? Number(e.target.value) : undefined }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Optimize Button */}
              <div className="mt-6">
                <button
                  onClick={handleOptimize}
                  disabled={isOptimizing}
                  className="btn-primary flex items-center gap-2"
                >
                  {isOptimizing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Calculator className="h-4 w-4" />
                  )}
                  {isOptimizing ? 'Optimizing...' : 'Optimize Batch Selection'}
                </button>
              </div>
            </div>

            {/* Results */}
            {optimizationResult && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5 text-green-600" />
                  Selected Batches
                </h2>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-600 font-medium">Total Bags</p>
                    <p className="text-2xl font-bold text-blue-900">{optimizationResult.totalBags}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-green-600 font-medium">Total Weight</p>
                    <p className="text-2xl font-bold text-green-900">{optimizationResult.totalWeight.toLocaleString()} kg</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <p className="text-sm text-orange-600 font-medium">Average Bloom</p>
                    <p className="text-2xl font-bold text-orange-900">{optimizationResult.averageBloom}</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-sm text-purple-600 font-medium">Target Range</p>
                    <p className="text-2xl font-bold text-purple-900">{targetBloomMin}-{targetBloomMax}</p>
                  </div>
                </div>

                {/* Batch Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S.No.</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch No.</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bloom</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bags</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {optimizationResult.selectedBatches.map((batch, index) => (
                        <tr key={batch.batchId}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{batch.batchNumber}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{batch.bloom || 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className="font-medium">10</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Selected
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Notes */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add any notes about this blend..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="btn-primary flex items-center gap-2"
                  >
                    {isSaving ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {isSaving ? 'Saving...' : 'Save Blend'}
                  </button>
                  
                  <button
                    onClick={handleDownloadPDF}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download PDF
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Available Batches Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-600" />
                Available Batches
              </h3>
              
              {availableBatches ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Available</span>
                    <span className="font-semibold text-gray-900">{availableBatches.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">In Target Range</span>
                    <span className="font-semibold text-gray-900">
                      {availableBatches.filter(batch => 
                        batch.bloom && batch.bloom >= targetBloomMin && batch.bloom <= targetBloomMax
                      ).length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Fiscal Year</span>
                    <span className="font-semibold text-gray-900">{currentFiscalYear}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <p className="mt-2 text-sm text-gray-600">Loading batches...</p>
                </div>
              )}
            </div>

            {/* Tips */}
            <div className="bg-orange-50 rounded-lg border border-orange-200 p-6">
              <h3 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                💡 Tips
              </h3>
              <div className="space-y-2 text-sm text-orange-800">
                <p>• Enter your target bloom range (e.g., 240-260)</p>
                <p>• Optionally set target mean bloom (e.g., 255) for precise control</p>
                <p>• Set target bags (default: 100, must be multiple of 10)</p>
                <p>• System automatically selects optimal batches (10 bags each)</p>
                <p>• Mesh size is for PDF documentation only</p>
                <p>• Download the PDF for your records</p>
                <p>• Used batches will be marked in Production Detail</p>
              </div>
            </div>

            {/* Target Validation */}
            {targetBloomMin && targetBloomMax && (
              <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
                <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Target Validation
                </h3>
                <div className="space-y-2 text-sm text-blue-800">
                  <p>• Bloom Range: {targetBloomMin} - {targetBloomMax}</p>
                  {targetMeanBloom && <p>• Target Mean: {targetMeanBloom} (±2 tolerance)</p>}
                  <p>• Target Bags: {targetBags} (will select {targetBags / 10} batches)</p>
                  <p>• Mesh Size: {targetMesh || 'Not specified'} (for PDF only)</p>
                  {targetBloomMin >= targetBloomMax && (
                    <p className="text-red-600">⚠️ Min bloom must be less than max bloom</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
