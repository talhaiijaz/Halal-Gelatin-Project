'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FileText, 
  BarChart3, 
  Settings, 
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

export default function ProductionPage() {
  const router = useRouter();

  const productionFeatures = [
    {
      id: 'reader',
      title: 'Production Reader',
      description: 'Upload and extract data from production analysis reports',
      icon: FileText,
      href: '/production/reader',
      status: 'active'
    },
    {
      id: 'analytics',
      title: 'Production Analytics',
      description: 'View production trends and quality metrics',
      icon: BarChart3,
      href: '/production/analytics',
      status: 'coming-soon'
    },
    {
      id: 'settings',
      title: 'Production Settings',
      description: 'Configure production parameters and thresholds',
      icon: Settings,
      href: '/production/settings',
      status: 'coming-soon'
    }
  ];

  const recentReports = [
    {
      id: 1,
      date: '2025-01-08',
      shift: 'Shift-A',
      batches: 115,
      status: 'completed'
    },
    {
      id: 2,
      date: '2025-01-08',
      shift: 'Shift-B', 
      batches: 114,
      status: 'completed'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="h-8 w-8 text-orange-600" />
            <h1 className="text-3xl font-bold text-gray-900">Production</h1>
          </div>
          <p className="text-gray-600">
            Manage production processes, analyze quality reports, and track manufacturing metrics
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Production Features */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Production Tools</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {productionFeatures.map((feature) => {
                  const Icon = feature.icon;
                  const isActive = feature.status === 'active';
                  const isComingSoon = feature.status === 'coming-soon';
                  
                  return (
                    <div
                      key={feature.id}
                      onClick={() => isActive && router.push(feature.href)}
                      className={`p-4 rounded-lg border transition-all ${
                        isActive 
                          ? 'border-orange-200 bg-orange-50 hover:bg-orange-100 cursor-pointer' 
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <Icon className={`h-5 w-5 ${isActive ? 'text-orange-600' : 'text-gray-400'}`} />
                        <h3 className={`font-medium ${isActive ? 'text-orange-900' : 'text-gray-500'}`}>
                          {feature.title}
                        </h3>
                        {isComingSoon && (
                          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                            Coming Soon
                          </span>
                        )}
                      </div>
                      <p className={`text-sm ${isActive ? 'text-orange-700' : 'text-gray-500'}`}>
                        {feature.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Reports */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Production Reports</h2>
              <div className="space-y-3">
                {recentReports.map((report) => (
                  <div key={report.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div>
                        <p className="font-medium text-gray-900">{report.date} - {report.shift}</p>
                        <p className="text-sm text-gray-600">{report.batches} batches processed</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600 capitalize">{report.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Today's Production</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Batches</span>
                  <span className="font-semibold text-gray-900">229</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Shift A</span>
                  <span className="font-semibold text-gray-900">115</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Shift B</span>
                  <span className="font-semibold text-gray-900">114</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Quality Score</span>
                  <span className="font-semibold text-green-600">98.5%</span>
                </div>
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
                  <FileText className="h-4 w-4" />
                  Upload Production Report
                </button>
                <button
                  disabled
                  className="w-full btn-secondary text-left flex items-center gap-2 opacity-50 cursor-not-allowed"
                >
                  <BarChart3 className="h-4 w-4" />
                  View Analytics
                </button>
              </div>
            </div>

            {/* Tips */}
            <div className="bg-orange-50 rounded-lg border border-orange-200 p-6">
              <h3 className="font-semibold text-orange-900 mb-3">💡 Production Tips</h3>
              <div className="space-y-2 text-sm text-orange-800">
                <p>• Upload daily production reports for quality tracking</p>
                <p>• Monitor batch consistency across shifts</p>
                <p>• Track quality metrics over time</p>
                <p>• Use Production Reader for automated data extraction</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
