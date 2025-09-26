"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

interface BatchData {
  _id: Id<"productionBatches">;
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
  isUsed?: boolean;
  usedInOrder?: string;
  usedDate?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export default function ProductionDetailPage() {
  const [editingBatch, setEditingBatch] = useState<BatchData | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSource, setFilterSource] = useState("all");
  const [filterUsed, setFilterUsed] = useState("all");

  // Fetch all batches
  const batches = useQuery(api.productionBatches.getAllBatches, {
    paginationOpts: { numItems: 1000 } // Get all batches for now
  });

  // Mutations
  const updateBatch = useMutation(api.productionBatches.updateBatch);
  const deleteBatch = useMutation(api.productionBatches.deleteBatch);

  // Get unique source reports for filter
  const sourceReports = batches?.page ? 
    Array.from(new Set(batches.page.map(batch => batch.sourceReport).filter(Boolean))) : [];

  // Filter batches based on search and filters
  const filteredBatches = batches?.page?.filter(batch => {
    const matchesSearch = searchTerm === "" || 
      batch.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      batch.batchNumber.toString().includes(searchTerm) ||
      (batch.sourceReport && batch.sourceReport.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesSource = filterSource === "all" || batch.sourceReport === filterSource;
    const matchesUsed = filterUsed === "all" || 
      (filterUsed === "used" && batch.isUsed) ||
      (filterUsed === "unused" && !batch.isUsed);

    return matchesSearch && matchesSource && matchesUsed;
  }) || [];

  const handleEditBatch = (batch: BatchData) => {
    setEditingBatch(batch);
    setShowEditModal(true);
  };

  const handleSaveBatch = async (updatedData: Partial<BatchData>) => {
    if (!editingBatch) return;

    try {
      await updateBatch({
        id: editingBatch._id,
        viscosity: updatedData.viscosity,
        bloom: updatedData.bloom,
        percentage: updatedData.percentage,
        ph: updatedData.ph,
        conductivity: updatedData.conductivity,
        moisture: updatedData.moisture,
        h2o2: updatedData.h2o2,
        so2: updatedData.so2,
        color: updatedData.color,
        clarity: updatedData.clarity,
        odour: updatedData.odour,
        notes: updatedData.notes,
      });
      setShowEditModal(false);
      setEditingBatch(null);
    } catch (error) {
      console.error("Error updating batch:", error);
    }
  };

  const handleDeleteBatch = async (batchId: Id<"productionBatches">) => {
    if (confirm("Are you sure you want to delete this batch?")) {
      try {
        await deleteBatch({ id: batchId });
      } catch (error) {
        console.error("Error deleting batch:", error);
      }
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleDateString();
  };

  const formatNumber = (value?: number) => {
    if (value === undefined || value === null) return "N/A";
    return value.toString();
  };

  if (batches === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading production batches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Production Detail</h1>
        <p className="text-gray-600">
          Manage and view all production batch data from uploaded reports.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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

        <div className="bg-white p-6 rounded-lg shadow-sm border">
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
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search by batch number, serial number, or report..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Source Report</label>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Reports</option>
              {sourceReports.map(report => (
                <option key={report} value={report}>{report}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filterUsed}
              onChange={(e) => setFilterUsed(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  Batch #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Serial #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Viscosity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bloom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  %
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  pH
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
                  Source
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
                <tr key={batch._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {batch.batchNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {batch.serialNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(batch.viscosity)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(batch.bloom)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(batch.percentage)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(batch.ph)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(batch.conductivity)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(batch.moisture)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(batch.h2o2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(batch.so2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {batch.color || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {batch.clarity || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {batch.odour || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {batch.sourceReport || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      batch.isUsed 
                        ? 'bg-orange-100 text-orange-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {batch.isUsed ? 'Used' : 'Available'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditBatch(batch)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteBatch(batch._id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
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
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No batches found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {batches.page?.length === 0 
                ? "Upload your first production report to get started."
                : "Try adjusting your search or filter criteria."
              }
            </p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && editingBatch && (
        <EditBatchModal
          batch={editingBatch}
          onSave={handleSaveBatch}
          onClose={() => {
            setShowEditModal(false);
            setEditingBatch(null);
          }}
        />
      )}
    </div>
  );
}

// Edit Batch Modal Component
function EditBatchModal({ 
  batch, 
  onSave, 
  onClose 
}: { 
  batch: BatchData; 
  onSave: (data: Partial<BatchData>) => void; 
  onClose: () => void; 
}) {
  const [formData, setFormData] = useState({
    viscosity: batch.viscosity || '',
    bloom: batch.bloom || '',
    percentage: batch.percentage || '',
    ph: batch.ph || '',
    conductivity: batch.conductivity || '',
    moisture: batch.moisture || '',
    h2o2: batch.h2o2 || '',
    so2: batch.so2 || '',
    color: batch.color || '',
    clarity: batch.clarity || '',
    odour: batch.odour || '',
    notes: batch.notes || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const updatedData = {
      viscosity: formData.viscosity ? parseFloat(formData.viscosity.toString()) : undefined,
      bloom: formData.bloom ? parseFloat(formData.bloom.toString()) : undefined,
      percentage: formData.percentage ? parseFloat(formData.percentage.toString()) : undefined,
      ph: formData.ph ? parseFloat(formData.ph.toString()) : undefined,
      conductivity: formData.conductivity ? parseFloat(formData.conductivity.toString()) : undefined,
      moisture: formData.moisture ? parseFloat(formData.moisture.toString()) : undefined,
      h2o2: formData.h2o2 ? parseFloat(formData.h2o2.toString()) : undefined,
      so2: formData.so2 ? parseFloat(formData.so2.toString()) : undefined,
      color: formData.color || undefined,
      clarity: formData.clarity || undefined,
      odour: formData.odour || undefined,
      notes: formData.notes || undefined,
    };

    onSave(updatedData);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Edit Batch #{batch.batchNumber} - {batch.serialNumber}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Viscosity</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.viscosity}
                  onChange={(e) => setFormData({ ...formData, viscosity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bloom</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.bloom}
                  onChange={(e) => setFormData({ ...formData, bloom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Percentage</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.percentage}
                  onChange={(e) => setFormData({ ...formData, percentage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">pH</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.ph}
                  onChange={(e) => setFormData({ ...formData, ph: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Conductivity</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.conductivity}
                  onChange={(e) => setFormData({ ...formData, conductivity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Moisture</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.moisture}
                  onChange={(e) => setFormData({ ...formData, moisture: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">H2O2</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.h2o2}
                  onChange={(e) => setFormData({ ...formData, h2o2: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SO2</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.so2}
                  onChange={(e) => setFormData({ ...formData, so2: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Clarity</label>
                <input
                  type="text"
                  value={formData.clarity}
                  onChange={(e) => setFormData({ ...formData, clarity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Odour</label>
                <input
                  type="text"
                  value={formData.odour}
                  onChange={(e) => setFormData({ ...formData, odour: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
