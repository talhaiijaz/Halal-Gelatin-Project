'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useProductionYear } from '../../../hooks/useProductionYear';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { 
  Calculator, 
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
  isOutsource?: boolean;
}

interface OptimizationResult {
  selectedBatches: SelectedBatch[];
  totalBags: number;
  totalWeight: number;
  averageBloom: number;
  ct3AverageBloom?: number;
  message: string;
  averageViscosity?: number;
  warning?: string;
  optimizationStatus?: string;
}

function BlendPageContent() {
  const { currentFiscalYear } = useProductionYear();
  
  // Form state
  const [targetBloomMin, setTargetBloomMin] = useState<number>(240);
  const [targetBloomMax, setTargetBloomMax] = useState<number>(260);
  const [targetMeanBloom, setTargetMeanBloom] = useState<number | undefined>(undefined);
  const [bloomSelectionMode, setBloomSelectionMode] = useState<'target-range' | 'high-low' | 'random-average'>('random-average');
  const [targetMesh, setTargetMesh] = useState<number>(20);
  const [targetBags, setTargetBags] = useState<number>(100);
  const [includeOutsourceBatches, setIncludeOutsourceBatches] = useState<boolean>(false);
  const [onlyOutsourceBatches, setOnlyOutsourceBatches] = useState<boolean>(false);
  const [lotNumber, setLotNumber] = useState<string>("");
  
  // Additional targets (optional)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [additionalTargets, setAdditionalTargets] = useState({
    viscosity: { enabled: false, min: undefined as number | undefined, max: undefined as number | undefined },
    percentage: { enabled: false, min: undefined as number | undefined, max: undefined as number | undefined },
    ph: { enabled: false, min: undefined as number | undefined, max: undefined as number | undefined },
    conductivity: { enabled: false, min: undefined as number | undefined, max: undefined as number | undefined },
    moisture: { enabled: false, min: undefined as number | undefined, max: undefined as number | undefined },
    h2o2: { enabled: false, min: undefined as number | undefined, max: undefined as number | undefined },
    so2: { enabled: false, min: undefined as number | undefined, max: undefined as number | undefined },
    color: { enabled: false, min: undefined as string | undefined, max: undefined as string | undefined },
    clarity: { enabled: false, min: undefined as number | undefined, max: undefined as number | undefined },
    odour: { enabled: false, min: undefined as string | undefined, max: undefined as string | undefined },
  });

  // Results state
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [preSelectedBatchIds, setPreSelectedBatchIds] = useState<Set<string>>(new Set());

  // Get available batches for reference
  const availableBatches = useQuery(api.blends.getAvailableBatches, {
    fiscalYear: currentFiscalYear,
    targetBloomMin,
    targetBloomMax,
  });

  // Get available outsource batches for reference
  const availableOutsourceBatches = useQuery(api.outsourceBatches.getAvailableOutsourceBatches, {
    fiscalYear: currentFiscalYear,
  });

  // Helper function to check if any additional targets are enabled
  const hasEnabledTargets = () => {
    return Object.values(additionalTargets).some(target => target.enabled);
  };

  // Helper function to validate range inputs
  const validateRanges = () => {
    for (const [key, target] of Object.entries(additionalTargets)) {
      if (target.enabled) {
        if (target.min === undefined || target.max === undefined) {
          toast.error(`Please enter both min and max values for ${key}`);
          return false;
        }
        if (typeof target.min === 'number' && typeof target.max === 'number' && target.min >= target.max) {
          toast.error(`${key}: Minimum value must be less than maximum value`);
          return false;
        }
      }
    }
    return true;
  };

  // Optimize batch selection
  const handleOptimize = async () => {
    if (!lotNumber.trim()) {
      toast.error('Please enter a Lot Number');
      return;
    }

    if (!targetBloomMin || !targetBloomMax) {
      toast.error('Please enter target bloom range');
      return;
    }

    if (targetBloomMin >= targetBloomMax) {
      toast.error('Minimum bloom must be less than maximum bloom');
      return;
    }

    if (showAdvanced && hasEnabledTargets() && !validateRanges()) {
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
          bloomSelectionMode,
          targetBags,
          includeOutsourceBatches,
          fiscalYear: currentFiscalYear,
          additionalTargets: showAdvanced && hasEnabledTargets() ? additionalTargets : undefined,
          preSelectedBatchIds: Array.from(preSelectedBatchIds),
          onlyOutsourceBatches,
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
    if (!lotNumber.trim()) {
      toast.error('Please enter a Lot Number');
      return;
    }

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
          bloomSelectionMode,
          targetMesh,
          lotNumber,
          additionalTargets: showAdvanced && hasEnabledTargets() ? additionalTargets : undefined,
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

  // Download PDF removed: downloads are available from the Blends page only.

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
                        step={10}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Min"
                      />
                      <span className="flex items-center text-gray-500">to</span>
                      <input
                        type="number"
                        value={targetBloomMax}
                        onChange={(e) => setTargetBloomMax(Number(e.target.value))}
                        step={10}
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
                      Bloom Selection Mode
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-start">
                        <input
                          type="radio"
                          name="bloomMode"
                          value="random-average"
                          checked={bloomSelectionMode === 'random-average'}
                          onChange={(e) => setBloomSelectionMode(e.target.value as 'target-range' | 'high-low' | 'random-average')}
                          className="mr-3 mt-1"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-700">Average Random Select Mode</div>
                          <div className="text-xs text-gray-500">Randomly select any batches from available inventory, ensuring the final average bloom falls within the target range. Most flexible option.</div>
                        </div>
                      </label>
                      <label className="flex items-start">
                        <input
                          type="radio"
                          name="bloomMode"
                          value="target-range"
                          checked={bloomSelectionMode === 'target-range'}
                          onChange={(e) => setBloomSelectionMode(e.target.value as 'target-range' | 'high-low' | 'random-average')}
                          className="mr-3 mt-1"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-700">Target Bloom Range Mode</div>
                          <div className="text-xs text-gray-500">Select only batches that fall within the specified bloom range ({targetBloomMin}-{targetBloomMax}). Most conservative option with consistent quality.</div>
                        </div>
                      </label>
                      <label className="flex items-start">
                        <input
                          type="radio"
                          name="bloomMode"
                          value="high-low"
                          checked={bloomSelectionMode === 'high-low'}
                          onChange={(e) => setBloomSelectionMode(e.target.value as 'target-range' | 'high-low' | 'random-average')}
                          className="mr-3 mt-1"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-700">High and Low Mode</div>
                          <div className="text-xs text-gray-500">Mix batches lower than {targetBloomMin} and higher than {targetBloomMax} to achieve the target average. Requires both low and high batches to be available.</div>
                        </div>
                      </label>
                    </div>
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Outsource Batch Options
                    </label>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="outsourceMode"
                            checked={!includeOutsourceBatches && !onlyOutsourceBatches}
                            onChange={() => { setIncludeOutsourceBatches(false); setOnlyOutsourceBatches(false); }}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">Production only</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="outsourceMode"
                            checked={includeOutsourceBatches && !onlyOutsourceBatches}
                            onChange={() => { setIncludeOutsourceBatches(true); setOnlyOutsourceBatches(false); }}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">Include outsource</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="outsourceMode"
                            checked={onlyOutsourceBatches}
                            onChange={() => { setIncludeOutsourceBatches(true); setOnlyOutsourceBatches(true); }}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">Only outsource</span>
                        </label>
                      </div>
                      <p className="text-xs text-gray-500">Choose whether to use production batches, include outsource, or use only outsource batches.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Documentation Fields */}
              <div className="mb-8 p-5 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-4">Documentation Fields (for PDF output)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Lot Number *
                    </label>
                    <input
                      type="text"
                      value={lotNumber}
                      onChange={(e) => setLotNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., HG-720-MFI-912-3"
                    />
                    <p className="text-xs text-gray-500 mt-2">Required and must be unique</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mesh Size
                    </label>
                    <input
                      type="number"
                      value={targetMesh}
                      onChange={(e) => setTargetMesh(Number(e.target.value))}
                      step={5}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(additionalTargets).map(([key, target]) => (
                      <div key={key} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center mb-2">
                          <input
                            type="checkbox"
                            id={`${key}-enabled`}
                            checked={target.enabled}
                            onChange={(e) => setAdditionalTargets(prev => ({
                              ...prev,
                              [key]: { ...prev[key as keyof typeof prev], enabled: e.target.checked }
                            }))}
                            className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor={`${key}-enabled`} className="text-sm font-medium text-gray-700 capitalize">
                            {key}
                          </label>
                        </div>
                        {target.enabled && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Min</label>
                              <input
                                type={['color', 'odour'].includes(key) ? 'text' : 'number'}
                                step={key === 'ph' ? '0.1' : undefined}
                                value={target.min || ''}
                                onChange={(e) => setAdditionalTargets(prev => ({
                                  ...prev,
                                  [key]: { 
                                    ...prev[key as keyof typeof prev], 
                                    min: ['color', 'odour'].includes(key) ? (e.target.value || undefined) : (e.target.value ? Number(e.target.value) : undefined)
                                  }
                                }))}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="Min"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Max</label>
                              <input
                                type={['color', 'odour'].includes(key) ? 'text' : 'number'}
                                step={key === 'ph' ? '0.1' : undefined}
                                value={target.max || ''}
                                onChange={(e) => setAdditionalTargets(prev => ({
                                  ...prev,
                                  [key]: { 
                                    ...prev[key as keyof typeof prev], 
                                    max: ['color', 'odour'].includes(key) ? (e.target.value || undefined) : (e.target.value ? Number(e.target.value) : undefined)
                                  }
                                }))}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="Max"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Optimize Button */}
              <div className="mt-6">
                <button
                  onClick={handleOptimize}
                  disabled={isOptimizing || !lotNumber.trim()}
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

                {/* Optimization Status */}
                {(optimizationResult.warning || optimizationResult.optimizationStatus) && (
                  <div className="mb-6 space-y-3">
                    {optimizationResult.warning && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                          <div>
                            <h4 className="text-sm font-medium text-red-800">Optimization Warnings</h4>
                            <p className="text-sm text-red-700 mt-1">{optimizationResult.warning}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {optimizationResult.optimizationStatus && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
                          <div>
                            <h4 className="text-sm font-medium text-green-800">Optimization Status</h4>
                            <p className="text-sm text-green-700 mt-1">{optimizationResult.optimizationStatus}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

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
                  <div className="bg-teal-50 p-4 rounded-lg">
                    <p className="text-sm text-teal-600 font-medium">Average Viscosity</p>
                    <p className="text-2xl font-bold text-teal-900">{optimizationResult.averageViscosity ?? 'N/A'}</p>
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{batch.batchNumber}{batch.isOutsource ? ' (O)' : ''}</td>
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

                {/* Action Button */}
                <div className="mt-6">
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !lotNumber.trim()}
                    className="btn-primary flex items-center gap-2"
                  >
                    {isSaving ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {isSaving ? 'Saving...' : 'Save Blend'}
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
                    <span className="font-semibold text-gray-900">
                      {(() => {
                        if (onlyOutsourceBatches) {
                          return availableOutsourceBatches ? availableOutsourceBatches.length : 0;
                        }
                        if (includeOutsourceBatches && availableOutsourceBatches) {
                          return availableBatches.length + availableOutsourceBatches.length;
                        }
                        return availableBatches.length;
                      })()}
                    </span>
                  </div>
                  {includeOutsourceBatches && !onlyOutsourceBatches && availableOutsourceBatches && (
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>Production: {availableBatches.length}</span>
                      <span>Outsource: {availableOutsourceBatches.length}</span>
                    </div>
                  )}
                  <div className="max-h-72 overflow-auto border rounded">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Select</th>
                          <th className="px-3 py-2 text-left">Batch #</th>
                          <th className="px-3 py-2 text-left">Bloom</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {(() => {
                          const allBatches = (() => {
                            if (onlyOutsourceBatches) {
                              return availableOutsourceBatches || [];
                            }
                            if (includeOutsourceBatches && availableOutsourceBatches) {
                              return [...availableBatches, ...availableOutsourceBatches];
                            }
                            return availableBatches;
                          })();
                          
                          return allBatches
                            .filter(b => b.bloom !== undefined)
                            .sort((a,b) => (a.batchNumber||0) - (b.batchNumber||0))
                            .map((b:any) => (
                            <tr key={b._id} className="hover:bg-gray-50">
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={preSelectedBatchIds.has(b._id)}
                                  onChange={(e) => {
                                    setPreSelectedBatchIds(prev => {
                                      const next = new Set(prev);
                                      if (e.target.checked) next.add(b._id);
                                      else next.delete(b._id);
                                      return next;
                                    });
                                  }}
                                />
                              </td>
                              <td className="px-3 py-2">
                                {b.batchNumber}
                                {includeOutsourceBatches && availableOutsourceBatches && 
                                 availableOutsourceBatches.some((ob: any) => ob._id === b._id) && 
                                 <span className="text-xs text-blue-600 ml-1">(O)</span>}
                              </td>
                              <td className="px-3 py-2">{b.bloom}</td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-between items-center">
                    {preSelectedBatchIds.size > 0 && (
                      <>
                        <span className="text-sm text-gray-600">Manually Selected</span>
                        <span className="font-semibold text-gray-900">{preSelectedBatchIds.size}</span>
                      </>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">In Range Batches</span>
                    <span className="font-semibold text-gray-900">
                      {(() => {
                        const allBatches = (() => {
                          if (onlyOutsourceBatches) {
                            return availableOutsourceBatches || [];
                          }
                          if (includeOutsourceBatches && availableOutsourceBatches) {
                            return [...availableBatches, ...availableOutsourceBatches];
                          }
                          return availableBatches;
                        })();
                        return allBatches.filter(batch => 
                          batch.bloom && batch.bloom >= targetBloomMin && batch.bloom <= targetBloomMax
                        ).length;
                      })()}
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

export default function BlendPage() {
  return (
    <ProtectedRoute route="/production/blend">
      <BlendPageContent />
    </ProtectedRoute>
  );
}
