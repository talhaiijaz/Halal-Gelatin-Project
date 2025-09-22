"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Calendar } from "lucide-react";
import { dateStringToTimestamp, timestampToDateString } from "@/app/utils/dateUtils";

interface DatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (date: Date) => void;
  title?: string;
  maxDate?: Date;
  minDate?: Date;
}

export default function DatePickerModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Select Date",
  maxDate,
  minDate,
}: DatePickerModalProps) {
  const [selectedDate, setSelectedDate] = useState("");
  const [error, setError] = useState("");

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalStyle = document.body.style.overflow;
      const scrollY = window.scrollY;
      
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        document.body.style.overflow = originalStyle;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!selectedDate) {
      setError("Please select a date");
      return;
    }

    // Parse selected date in Pakistan timezone (normalized to noon PKT)
    const selectedTs = dateStringToTimestamp(selectedDate);
    const date = new Date(selectedTs);

    // Validate date is not in the future (use PK today)
    const todayString = timestampToDateString(Date.now());
    const todayTs = dateStringToTimestamp(todayString);
    if (selectedTs > todayTs) {
      setError("Date cannot be in the future");
      return;
    }

    // Validate against min/max dates if provided
    if (minDate && selectedTs < minDate.getTime()) {
      setError(`Date cannot be before ${minDate.toLocaleDateString()}`);
      return;
    }

    if (maxDate && selectedTs > maxDate.getTime()) {
      setError(`Date cannot be after ${maxDate.toLocaleDateString()}`);
      return;
    }

    setError("");
    onConfirm(date);
    setSelectedDate("");
  };

  const handleClose = () => {
    setSelectedDate("");
    setError("");
    onClose();
  };

  // Set max date to today in Pakistan timezone for delivery dates
  const today = timestampToDateString(Date.now());

  const modalContent = (
    <div 
      className="fixed z-[60] flex items-center justify-center p-4 bg-black bg-opacity-50"
      style={{ 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        width: '100vw',
        height: '100vh'
      }}
    >
      <div className="bg-white rounded-lg sm:rounded-lg rounded-none shadow-xl max-w-md w-full mx-0 sm:mx-4 h-full sm:h-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 sticky top-0 bg-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setError("");
                }}
                max={today}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-4 sm:p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg sticky bottom-0" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );

  // Use portal to render modal directly to document.body
  return createPortal(modalContent, document.body);
}
