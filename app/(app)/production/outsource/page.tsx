"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Search, Filter, Trash2, Loader2, AlertCircle, CheckCircle, Upload, X, Plus, Edit, Save, XCircle } from "lucide-react";
import { useProductionYear } from "../../../hooks/useProductionYear";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface OutsourceBatchData {
  _id: Id<"outsourceBatches">;
  batchNumber: number;
  supplierName: string;
  supplierBatchId?: string;
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
  usedInOrder?: string;
  usedDate?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export default function OutsourceDetailPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUsed, setFilterUsed] = useState("all");
  const [selectedBatches, setSelectedBatches] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<OutsourceBatchData | null>(null);
  
  // Use the shared year management system
  const { currentYear, currentFiscalYear } = useProductionYear();
  
  const router = useRouter();

  // Fetch all outsource batches for current fiscal year
  const batches = useQuery(api.outsourceBatches.getAllOutsourceBatches, {
    paginationOpts: { numItems: 1000, cursor: null }
  });

  // Fetch outsource batch statistics
  const stats = useQuery(api.outsourceBatches.getOutsourceBatchStats, {
    fiscalYear: currentFiscalYear
  });

  // Mutations
  const deleteBatch = useMutation(api.outsourceBatches.deleteOutsourceBatch);
  const deleteMultipleBatches = useMutation(api.outsourceBatches.deleteOutsourceBatch);
  const createBatch = useMutation(api.outsourceBatches.createOutsourceBatch);
  const updateBatch = useMutation(api.outsourceBatches.updateOutsourceBatch);

  // Get unique supplier names for filter
  const supplierNames = batches?.page ? 
    Array.from(new Set(batches.page.map(batch => batch.supplierName).filter(Boolean))) : [];

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
      batch.batchNumber.toString().includes(searchTerm) ||
      batch.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (batch.supplierBatchId && batch.supplierBatchId.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFilter = filterUsed === "all" || 
      (filterUsed === "used" && batch.isUsed) ||
      (filterUsed === "available" && !batch.isUsed);

    return matchesSearch && matchesFilter;
  }) || [];

  // Handle batch selection
  const handleBatchSelect = (batchId: string) => {
    const newSelected = new Set(selectedBatches);
    if (newSelected.has(batchId)) {
      newSelected.delete(batchId);
    } else {
      newSelected.add(batchId);
    }
    setSelectedBatches(newSelected);
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedBatches.size === filteredBatches.length) {
      setSelectedBatches(new Set());
    } else {
      setSelectedBatches(new Set(filteredBatches.map(batch => batch._id)));
    }
  };

  // Handle delete single batch
  const handleDeleteBatch = async (batchId: string) => {
    try {
      await deleteBatch({ batchId: batchId as Id<"outsourceBatches"> });
      toast.success("Batch deleted successfully");
    } catch (error) {
      console.error("Error deleting batch:", error);
      toast.error("Failed to delete batch");
    }
  };

  // Handle delete multiple batches
  const handleDeleteMultiple = async () => {
    try {
      const batchIds = Array.from(selectedBatches);
      for (const batchId of batchIds) {
        await deleteBatch({ batchId: batchId as Id<"outsourceBatches"> });
      }
      setSelectedBatches(new Set());
      setShowDeleteModal(false);
      toast.success(`${batchIds.length} batches deleted successfully`);
    } catch (error) {
      console.error("Error deleting batches:", error);
      toast.error("Failed to delete batches");
    }
  };

  // Handle add new batch
  const handleAddBatch = async (formData: any) => {
    try {
      await createBatch(formData);
      setShowAddModal(false);
      toast.success("Outsource batch added successfully");
    } catch (error) {
      console.error("Error adding batch:", error);
      toast.error("Failed to add batch");
    }
  };

  // Handle edit batch
  const handleEditBatch = async (batchId: string, formData: any) => {
    try {
      await updateBatch({ batchId: batchId as Id<"outsourceBatches">, ...formData });
      setEditingBatch(null);
      toast.success("Batch updated successfully");
    } catch (error) {
      console.error("Error updating batch:", error);
      toast.error("Failed to update batch");
    }
  };

  if (!batches) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading outsource batches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Outsource Detail</h1>
          <p className="text-gray-600 mt-2">Manage batches from external suppliers and factories</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Batches</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalBatches || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Available</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.availableBatches || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertCircle className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Used</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.usedBatches || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Bloom</p>
                <p className="text-2xl font-bold text-gray-900">{bloomAverage}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Blending Information */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Blending Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Available Batches</p>
              <p className="text-2xl font-bold text-green-600">{availableBatches.length}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Average Bloom</p>
              <p className="text-2xl font-bold text-blue-600">{bloomAverage}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Average Viscosity</p>
              <p className="text-2xl font-bold text-purple-600">{viscosityAverage}</p>
            </div>
          </div>
          <div className="mt-4 text-center">
            <button
              onClick={() => router.push('/production/blend')}
              className="btn-primary"
            >
              Create New Blend
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              {/* Search */}
              <div className="relative">
                <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search batches..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Filter */}
              <select
                value={filterUsed}
                onChange={(e) => setFilterUsed(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Batches</option>
                <option value="available">Available Only</option>
                <option value="used">Used Only</option>
              </select>
            </div>

            <div className="flex gap-2">
              {selectedBatches.size > 0 && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="btn-danger flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete ({selectedBatches.size})
                </button>
              )}
              <button
                onClick={() => setShowAddModal(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Batch
              </button>
            </div>
          </div>
        </div>

        {/* Batches Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedBatches.size === filteredBatches.length && filteredBatches.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Batch #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Supplier Batch ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bloom
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Viscosity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    pH
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBatches.map((batch) => (
                  <tr key={batch._id} className={`${batch.isUsed ? 'bg-green-100' : 'hover:bg-gray-50'}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedBatches.has(batch._id)}
                        onChange={() => handleBatchSelect(batch._id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {batch.batchNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {batch.supplierName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {batch.supplierBatchId || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {batch.bloom || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {batch.viscosity || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {batch.ph || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        batch.isUsed 
                          ? 'bg-orange-100 text-orange-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {batch.isUsed ? (
                          <span className="flex items-center gap-1">
                            <span>Used</span>
                            {batch.usedInOrder && (
                              <span className="text-xs opacity-75">
                                ({batch.usedInOrder})
                              </span>
                            )}
                          </span>
                        ) : (
                          'Available'
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingBatch(batch)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBatch(batch._id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredBatches.length === 0 && (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No batches found</h3>
              <p className="text-gray-500">
                {searchTerm || filterUsed !== "all" 
                  ? "Try adjusting your search or filter criteria."
                  : "Get started by adding your first outsource batch."
                }
              </p>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Delete</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete {selectedBatches.size} selected batch(es)? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteMultiple}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Batch Modal */}
        {showAddModal && (
          <AddBatchModal
            onClose={() => setShowAddModal(false)}
            onSave={handleAddBatch}
            fiscalYear={currentFiscalYear}
          />
        )}

        {/* Edit Batch Modal */}
        {editingBatch && (
          <EditBatchModal
            batch={editingBatch}
            onClose={() => setEditingBatch(null)}
            onSave={(formData) => handleEditBatch(editingBatch._id, formData)}
          />
        )}
      </div>
    </div>
  );
}

// Add Batch Modal Component
function AddBatchModal({ onClose, onSave, fiscalYear }: { onClose: () => void; onSave: (data: any) => void; fiscalYear: string }) {
  const [formData, setFormData] = useState({
    batchNumber: 1,
    supplierName: '',
    supplierBatchId: '',
    viscosity: '',
    bloom: '',
    percentage: '',
    ph: '',
    conductivity: '',
    moisture: '',
    h2o2: '',
    so2: '',
    color: '',
    clarity: '',
    odour: '',
    notes: '',
    fiscalYear
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const processedData = {
      ...formData,
      batchNumber: Number(formData.batchNumber),
      viscosity: formData.viscosity ? Number(formData.viscosity) : undefined,
      bloom: formData.bloom ? Number(formData.bloom) : undefined,
      percentage: formData.percentage ? Number(formData.percentage) : undefined,
      ph: formData.ph ? Number(formData.ph) : undefined,
      conductivity: formData.conductivity ? Number(formData.conductivity) : undefined,
      moisture: formData.moisture ? Number(formData.moisture) : undefined,
      h2o2: formData.h2o2 ? Number(formData.h2o2) : undefined,
      so2: formData.so2 ? Number(formData.so2) : undefined,
      supplierBatchId: formData.supplierBatchId || undefined,
      notes: formData.notes || undefined,
    };
    onSave(processedData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Outsource Batch</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number</label>
              <input
                type="number"
                value={formData.batchNumber}
                onChange={(e) => setFormData({...formData, batchNumber: Number(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name</label>
              <input
                type="text"
                value={formData.supplierName}
                onChange={(e) => setFormData({...formData, supplierName: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Batch ID</label>
              <input
                type="text"
                value={formData.supplierBatchId}
                onChange={(e) => setFormData({...formData, supplierBatchId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bloom</label>
              <input
                type="number"
                step="0.1"
                value={formData.bloom}
                onChange={(e) => setFormData({...formData, bloom: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Viscosity</label>
              <input
                type="number"
                step="0.1"
                value={formData.viscosity}
                onChange={(e) => setFormData({...formData, viscosity: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">pH</label>
              <input
                type="number"
                step="0.1"
                value={formData.ph}
                onChange={(e) => setFormData({...formData, ph: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Percentage</label>
              <input
                type="number"
                step="0.1"
                value={formData.percentage}
                onChange={(e) => setFormData({...formData, percentage: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Conductivity</label>
              <input
                type="number"
                step="0.1"
                value={formData.conductivity}
                onChange={(e) => setFormData({...formData, conductivity: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Moisture</label>
              <input
                type="number"
                step="0.1"
                value={formData.moisture}
                onChange={(e) => setFormData({...formData, moisture: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">H2O2</label>
              <input
                type="number"
                step="0.1"
                value={formData.h2o2}
                onChange={(e) => setFormData({...formData, h2o2: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SO2</label>
              <input
                type="number"
                step="0.1"
                value={formData.so2}
                onChange={(e) => setFormData({...formData, so2: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({...formData, color: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clarity</label>
              <input
                type="text"
                value={formData.clarity}
                onChange={(e) => setFormData({...formData, clarity: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Odour</label>
              <input
                type="text"
                value={formData.odour}
                onChange={(e) => setFormData({...formData, odour: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Batch
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Batch Modal Component
function EditBatchModal({ batch, onClose, onSave }: { batch: OutsourceBatchData; onClose: () => void; onSave: (data: any) => void }) {
  const [formData, setFormData] = useState({
    supplierName: batch.supplierName,
    supplierBatchId: batch.supplierBatchId || '',
    viscosity: batch.viscosity?.toString() || '',
    bloom: batch.bloom?.toString() || '',
    percentage: batch.percentage?.toString() || '',
    ph: batch.ph?.toString() || '',
    conductivity: batch.conductivity?.toString() || '',
    moisture: batch.moisture?.toString() || '',
    h2o2: batch.h2o2?.toString() || '',
    so2: batch.so2?.toString() || '',
    color: batch.color || '',
    clarity: batch.clarity || '',
    odour: batch.odour || '',
    notes: batch.notes || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const processedData = {
      supplierName: formData.supplierName,
      supplierBatchId: formData.supplierBatchId || undefined,
      viscosity: formData.viscosity ? Number(formData.viscosity) : undefined,
      bloom: formData.bloom ? Number(formData.bloom) : undefined,
      percentage: formData.percentage ? Number(formData.percentage) : undefined,
      ph: formData.ph ? Number(formData.ph) : undefined,
      conductivity: formData.conductivity ? Number(formData.conductivity) : undefined,
      moisture: formData.moisture ? Number(formData.moisture) : undefined,
      h2o2: formData.h2o2 ? Number(formData.h2o2) : undefined,
      so2: formData.so2 ? Number(formData.so2) : undefined,
      color: formData.color || undefined,
      clarity: formData.clarity || undefined,
      odour: formData.odour || undefined,
      notes: formData.notes || undefined,
    };
    onSave(processedData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Outsource Batch #{batch.batchNumber}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name</label>
              <input
                type="text"
                value={formData.supplierName}
                onChange={(e) => setFormData({...formData, supplierName: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Batch ID</label>
              <input
                type="text"
                value={formData.supplierBatchId}
                onChange={(e) => setFormData({...formData, supplierBatchId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bloom</label>
              <input
                type="number"
                step="0.1"
                value={formData.bloom}
                onChange={(e) => setFormData({...formData, bloom: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Viscosity</label>
              <input
                type="number"
                step="0.1"
                value={formData.viscosity}
                onChange={(e) => setFormData({...formData, viscosity: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">pH</label>
              <input
                type="number"
                step="0.1"
                value={formData.ph}
                onChange={(e) => setFormData({...formData, ph: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Percentage</label>
              <input
                type="number"
                step="0.1"
                value={formData.percentage}
                onChange={(e) => setFormData({...formData, percentage: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Conductivity</label>
              <input
                type="number"
                step="0.1"
                value={formData.conductivity}
                onChange={(e) => setFormData({...formData, conductivity: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Moisture</label>
              <input
                type="number"
                step="0.1"
                value={formData.moisture}
                onChange={(e) => setFormData({...formData, moisture: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">H2O2</label>
              <input
                type="number"
                step="0.1"
                value={formData.h2o2}
                onChange={(e) => setFormData({...formData, h2o2: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SO2</label>
              <input
                type="number"
                step="0.1"
                value={formData.so2}
                onChange={(e) => setFormData({...formData, so2: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({...formData, color: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clarity</label>
              <input
                type="text"
                value={formData.clarity}
                onChange={(e) => setFormData({...formData, clarity: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Odour</label>
              <input
                type="text"
                value={formData.odour}
                onChange={(e) => setFormData({...formData, odour: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Update Batch
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
