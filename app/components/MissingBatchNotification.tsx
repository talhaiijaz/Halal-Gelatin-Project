"use client";

import React, { useState } from 'react';
import { AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react';

interface MissingBatchNotificationProps {
  missingBatches: number[];
  range: { min: number; max: number };
  totalBatches: number;
  batchType: 'production' | 'outsource';
}

export default function MissingBatchNotification({
  missingBatches,
  range,
  totalBatches,
  batchType
}: MissingBatchNotificationProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed || missingBatches.length === 0) {
    return null;
  }

  const batchTypeLabel = batchType === 'production' ? 'Production' : 'Outsource';
  
  // Group consecutive missing batches for better display
  const groupedMissingBatches = [];
  let start = missingBatches[0];
  let end = missingBatches[0];
  
  for (let i = 1; i < missingBatches.length; i++) {
    if (missingBatches[i] === end + 1) {
      end = missingBatches[i];
    } else {
      groupedMissingBatches.push(start === end ? start : `${start}-${end}`);
      start = missingBatches[i];
      end = missingBatches[i];
    }
  }
  groupedMissingBatches.push(start === end ? start : `${start}-${end}`);

  const displayMissingBatches = isExpanded 
    ? groupedMissingBatches 
    : groupedMissingBatches.slice(0, 3);

  const hasMoreBatches = groupedMissingBatches.length > 3;

  return (
    <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
        </div>
        <div className="ml-3 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-amber-800">
              Missing {batchTypeLabel} Batches Detected
            </h3>
            <button
              onClick={() => setIsDismissed(true)}
              className="text-amber-600 hover:text-amber-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="mt-2">
            <p className="text-sm text-amber-700">
              Found {missingBatches.length} missing batch{missingBatches.length !== 1 ? 'es' : ''} 
              {' '}in the range {range.min} to {range.max} 
              {' '}({totalBatches} total batches).
            </p>
            
            {missingBatches.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-amber-800 mb-2">
                  Missing batch numbers:
                </p>
                <div className="flex flex-wrap gap-1">
                  {displayMissingBatches.map((batch, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300"
                    >
                      {batch}
                    </span>
                  ))}
                  {hasMoreBatches && !isExpanded && (
                    <span className="text-xs text-amber-600">
                      +{groupedMissingBatches.length - 3} more
                    </span>
                  )}
                </div>
                
                {hasMoreBatches && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="mt-2 text-xs text-amber-600 hover:text-amber-800 font-medium flex items-center gap-1 transition-colors"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-3 w-3" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" />
                        Show all missing batches
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
