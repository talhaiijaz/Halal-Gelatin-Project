'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { 
  FileText, 
  BarChart3, 
  Eye,
  Upload,
  TrendingUp,
  Package,
  CheckCircle,
  Clock
} from 'lucide-react';

export default function ProductionPage() {
  const router = useRouter();

  // Fetch real production data
  const batches = useQuery(api.productionBatches.getAllBatches, {
    paginationOpts: { numItems: 1000 }
  });

  const yearInfo = useQuery(api.productionBatches.getCurrentYearInfo);
  const availableYears = useQuery(api.productionBatches.getAvailableYears);

  // Calculate statistics from real data
  const totalBatches = batches?.page?.length || 0;
  const availableBatches = batches?.page?.filter(batch => !batch.isUsed).length || 0;
  const usedBatches = batches?.page?.filter(batch => batch.isUsed).length || 0;
  const sourceReports = batches?.page ? 
    Array.from(new Set(batches.page.map(batch => batch.sourceReport).filter(Boolean))) : [];

  // Get recent reports (last 5 unique source reports)
  const recentReports = sourceReports.slice(0, 5).map((report, index) => {
    const reportBatches = batches?.page?.filter(batch => batch.sourceReport === report) || [];
    const reportDate = reportBatches[0]?.reportDate;
    return {
      id: index + 1,
      name: report,
      batches: reportBatches.length,
      date: reportDate ? new Date(reportDate).toLocaleDateString() : 'Unknown',
      status: 'completed'
    };
  });

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="h-8 w-8 text-orange-600" />
            <h1 className="text-3xl font-bold text-gray-900">Production Overview</h1>
          </div>
          <p className="text-gray-600">
            Manage production batches and quality data from PDF reports
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Batches</p>
                <p className="text-2xl font-bold text-gray-900">{totalBatches}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Available</p>
                <p className="text-2xl font-bold text-gray-900">{availableBatches}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Used</p>
                <p className="text-2xl font-bold text-gray-900">{usedBatches}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Reports</p>
                <p className="text-2xl font-bold text-gray-900">{sourceReports.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Production Tools */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Production Tools</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  onClick={() => router.push('/production/reader')}
                  className="p-4 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Upload className="h-5 w-5 text-orange-600" />
                    <h3 className="font-medium text-orange-900">Production Reader</h3>
                  </div>
                  <p className="text-sm text-orange-700">
                    Upload and extract data from production analysis reports
                  </p>
                </div>

                <div
                  onClick={() => router.push('/production/detail')}
                  className="p-4 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Eye className="h-5 w-5 text-blue-600" />
                    <h3 className="font-medium text-blue-900">Production Detail</h3>
                  </div>
                  <p className="text-sm text-blue-700">
                    View and manage all production batch data
                  </p>
                </div>
              </div>
            </div>

            {/* Recent Reports */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Production Reports</h2>
              {recentReports.length > 0 ? (
                <div className="space-y-3">
                  {recentReports.map((report) => (
                    <div key={report.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <div>
                          <p className="font-medium text-gray-900">{report.name}</p>
                          <p className="text-sm text-gray-600">{report.batches} batches • {report.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-600 capitalize">{report.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No reports yet</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Upload your first production report to get started
                  </p>
                  <div className="mt-6">
                    <button
                      onClick={() => router.push('/production/reader')}
                      className="btn-primary"
                    >
                      Upload Report
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Year Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Current Year</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Active Year</span>
                  <span className="font-semibold text-gray-900">{yearInfo?.currentYear || new Date().getFullYear()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Batches</span>
                  <span className="font-semibold text-gray-900">{yearInfo?.batchCount || 0}</span>
                </div>
                {availableYears && availableYears.length > 1 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Available Years</span>
                    <span className="font-semibold text-gray-900">{availableYears.length}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/production/reader')}
                  className="w-full btn-primary text-left flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload Production Report
                </button>
                <button
                  onClick={() => router.push('/production/detail')}
                  className="w-full btn-secondary text-left flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  View All Batches
                </button>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-orange-50 rounded-lg border border-orange-200 p-6">
              <h3 className="font-semibold text-orange-900 mb-3">💡 Getting Started</h3>
              <div className="space-y-2 text-sm text-orange-800">
                <p>• Upload PDF production reports using Production Reader</p>
                <p>• View and manage batches in Production Detail</p>
                <p>• Track batch availability and usage status</p>
                <p>• Reset batch numbers for new years</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
