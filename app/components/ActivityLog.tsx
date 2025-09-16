"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Clock, User, Edit, Plus, Trash2, FileText, Eye, Upload, ChevronDown, ChevronRight } from "lucide-react";

interface ActivityLogProps {
  entityId: string;
  entityTable?: string; // Optional; when provided we use indexed query
  limit?: number;
  title?: string;
  collapsible?: boolean; // New prop to enable collapsible functionality
  defaultExpanded?: boolean; // New prop to set default state
}

export default function ActivityLog({ entityId, entityTable, limit = 10, title = "Activity Log", collapsible = false, defaultExpanded = true }: ActivityLogProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  // Prefer indexed query when entityTable provided
  const logs = entityTable
    ? useQuery(api.dashboard.listEntityLogs, { entityTable, entityId })
    : useQuery(api.dashboard.getEntityActivityLogs, { entityId, limit });

  const getActionIcon = (action: string, metadata?: any) => {
    // Check if this is a document activity
    if (metadata?.action === "document_upload") {
      return <Upload className="h-4 w-4 text-green-600" />;
    }
    if (metadata?.action === "document_view") {
      return <Eye className="h-4 w-4 text-blue-600" />;
    }
    if (metadata?.action === "document_delete") {
      return <Trash2 className="h-4 w-4 text-red-600" />;
    }
    
    // Regular actions
    switch (action) {
      case "create":
        return <Plus className="h-4 w-4 text-green-600" />;
      case "update":
        return <Edit className="h-4 w-4 text-blue-600" />;
      case "delete":
        return <Trash2 className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActionColor = (action: string, metadata?: any) => {
    // Check if this is a document activity
    if (metadata?.action === "document_upload") {
      return "bg-green-100 text-green-800";
    }
    if (metadata?.action === "document_view") {
      return "bg-blue-100 text-blue-800";
    }
    if (metadata?.action === "document_delete") {
      return "bg-red-100 text-red-800";
    }
    
    // Regular actions
    switch (action) {
      case "create":
        return "bg-green-100 text-green-800";
      case "update":
        return "bg-blue-100 text-blue-800";
      case "delete":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (!logs) {
    return (
      <div className="mt-6">
        {collapsible ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-between w-full text-left mb-4"
          >
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronRight className="h-5 w-5 text-gray-500" />
            )}
          </button>
        ) : (
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        )}
        {(!collapsible || isExpanded) && (
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="h-4 w-4 bg-gray-200 rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="mt-6">
        {collapsible ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-between w-full text-left mb-4"
          >
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronRight className="h-5 w-5 text-gray-500" />
            )}
          </button>
        ) : (
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        )}
        {(!collapsible || isExpanded) && (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No activity recorded yet</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6">
      {collapsible ? (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full text-left mb-4 hover:bg-gray-50 p-2 rounded-lg transition-colors"
        >
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-500" />
          )}
        </button>
      ) : (
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      )}
      {(!collapsible || isExpanded) && (
        <div className="space-y-4">
          {logs.map((log) => (
            <div key={log._id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0 mt-1">
                {getActionIcon(log.action, log.metadata)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action, log.metadata)}`}>
                      {log.metadata?.action === "document_upload" ? "Document Upload" :
                       log.metadata?.action === "document_view" ? "Document View" :
                       log.metadata?.action === "document_delete" ? "Document Delete" :
                       log.action.charAt(0).toUpperCase() + log.action.slice(1)}
                    </span>
                    {log.userId && (
                      <div className="flex items-center space-x-1 text-sm text-gray-500">
                        <User className="h-3 w-3" />
                        <span>Admin</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-1 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(log.createdAt)}</span>
                  </div>
                </div>
                <p className="mt-1 text-sm text-gray-900 break-all whitespace-pre-wrap">{log.message}</p>
                {log.metadata && (
                  <div className="mt-2 text-xs text-gray-600">
                    <details className="cursor-pointer">
                      <summary className="hover:text-gray-800">View Details</summary>
                      <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
