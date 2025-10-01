'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import { ArrowLeft, FileDown, Package } from 'lucide-react';
import toast from 'react-hot-toast';

function BlendDetailPageContent() {
  const params = useParams();
  const router = useRouter();
  const blendId = params?.id as string;

  const blend = useQuery(api.blends.getBlendById, { blendId } as any);

  const handleDownload = async () => {
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
      a.download = `blending-sheet-${blend?.lotNumber || 'blend'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e: any) {
      toast.error(e.message || 'PDF download failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button onClick={() => router.back()} className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Blend Detail</h1>
              {blend && (
                <div className="text-sm text-gray-600 mt-1 space-y-1">
                  <p>SR #: <span className="font-medium text-gray-900">{blend.serialNumber}</span></p>
                  <p>Lot #: <span className="font-medium text-gray-900">{blend.lotNumber}</span></p>
                </div>
              )}
            </div>
            <button onClick={handleDownload} className="btn-secondary inline-flex items-center gap-2">
              <FileDown className="h-4 w-4" /> Download PDF
            </button>
          </div>

          {!blend ? (
            <div className="py-10 text-center text-gray-600">Loading blend...</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-600 font-medium">Target Range</p>
                  <p className="text-2xl font-bold text-blue-900">{blend.targetBloomMin}-{blend.targetBloomMax}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-orange-600 font-medium">Average Bloom</p>
                  <p className="text-2xl font-bold text-orange-900">{blend.averageBloom}</p>
                </div>
                {('averageViscosity' in blend) && (
                  <div className="bg-teal-50 p-4 rounded-lg">
                    <p className="text-sm text-teal-600 font-medium">Average Viscosity</p>
                    <p className="text-2xl font-bold text-teal-900">{(blend as any).averageViscosity ?? 'N/A'}</p>
                  </div>
                )}
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-600 font-medium">Total Bags</p>
                  <p className="text-2xl font-bold text-green-900">{blend.totalBags}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-purple-600 font-medium">Date</p>
                  <p className="text-2xl font-bold text-purple-900">{new Date(blend.date).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S.No.</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch No.</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bloom</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bags</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {blend.selectedBatches.map((b: any, idx: number) => (
                      <tr key={b.batchId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{idx + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{b.batchNumber}{b.isOutsource ? ' (O)' : ''}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{b.bloom || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{b.bags}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {blend.notes && (
                <div className="mt-6">
                  <p className="text-sm font-medium text-gray-700 mb-2">Notes</p>
                  <div className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 rounded p-4 border">{blend.notes}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BlendDetailPage() {
  return (
    <ProtectedRoute route="/production/blends">
      <BlendDetailPageContent />
    </ProtectedRoute>
  );
}


