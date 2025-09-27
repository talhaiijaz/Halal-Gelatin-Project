'use client';

import { useRouter } from 'next/navigation';
import { 
  AlertTriangle,
  ArrowLeft
} from 'lucide-react';

export default function ProductionReaderPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-red-100 rounded-full">
            <AlertTriangle className="h-12 w-12 text-red-600" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Access Denied
        </h1>
        
        <p className="text-gray-600 mb-6">
          The Production Reader feature is currently not available. 
          Please use the Production Detail page to manage your production data.
        </p>
        
        <div className="space-y-3">
          <button
            onClick={() => router.push('/production')}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Production Overview
          </button>
          
          <button
            onClick={() => router.push('/production/detail')}
            className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
          >
            Go to Production Detail
          </button>
        </div>
      </div>
    </div>
  );
}