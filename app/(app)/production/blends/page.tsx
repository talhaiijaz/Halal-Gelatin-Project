'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useProductionYear } from '../../../hooks/useProductionYear';
import Link from 'next/link';
import { FileDown, Eye, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ProtectedRoute from '@/app/components/ProtectedRoute';

function BlendsPageContent() {
  const router = useRouter();
  const { currentFiscalYear } = useProductionYear();
  const blends = useQuery(api.blends.getAllBlends, {
    paginationOpts: { numItems: 100, cursor: null },
    fiscalYear: currentFiscalYear,
  });
  const deleteBlend = useMutation(api.blends.deleteBlend);
  
  // Get current user role to check permissions
  const currentUserRole = useQuery(api.users.getCurrentUserRole);

  // Helper function to check if blend can be deleted (within 48 hours and not production role)
  const canDeleteBlend = (blend: any) => {
    // Production role cannot delete any blends
    if (currentUserRole === "production") {
      return false;
    }
    
    const now = Date.now();
    const creationTime = blend.createdAt || blend._creationTime;
    const hoursSinceCreation = (now - creationTime) / (1000 * 60 * 60);
    return hoursSinceCreation <= 48;
  };

  const handleDelete = async (blendId: string) => {
    if (confirm("Are you sure you want to delete this blend?")) {
      try {
        await deleteBlend({ blendId: blendId as any });
        toast.success("Blend deleted successfully!");
      } catch (error: any) {
        console.error("Error deleting blend:", error);
        toast.error(error.message || "Failed to delete blend. Please try again.");
      }
    }
  };

  const handleDownload = async (blendId: string, blendNumber: string) => {
    try {
      const res = await fetch('/api/blend/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blendId }),
      });
      if (!res.ok) throw new Error('Failed to generate PDF');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `blending-sheet-${blendNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      toast.error('Failed to download PDF');
    }
  };


  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Blends</h1>
          <Link href="/production/blend" className="btn-primary">Create Blend</Link>
        </div>

        <div className="bg-white rounded-lg border">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SR #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lot #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Bloom</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bags</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Bloom</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {blends?.page?.map((blend: any) => (
                  <tr key={blend._id} className="cursor-pointer hover:bg-gray-50" onClick={() => router.push(`/production/blends/${blend._id}`)}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{blend.serialNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 underline">{blend.lotNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{blend.targetBloomMin}-{blend.targetBloomMax}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{blend.totalBags}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{blend.averageBloom}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(blend.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-3">
                        <button onClick={(e) => { e.stopPropagation(); handleDownload(blend._id, blend.lotNumber); }} className="text-blue-600 hover:text-blue-800 flex items-center gap-1"><FileDown className="h-4 w-4" />PDF</button>
                        {canDeleteBlend(blend) && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(blend._id); }} 
                            className="text-red-600 hover:text-red-800 flex items-center gap-1"
                            title="Delete blend (within 48 hours)"
                          >
                            <Trash2 className="h-4 w-4" />Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BlendsPage() {
  return (
    <ProtectedRoute route="/production/blends">
      <BlendsPageContent />
    </ProtectedRoute>
  );
}


