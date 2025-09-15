"use client";

import { useState } from "react";
import { X, Calendar } from "lucide-react";

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

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!selectedDate) {
      setError("Please select a date");
      return;
    }

    const date = new Date(selectedDate);
    
    // Validate date is not in the future
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    if (date > today) {
      setError("Date cannot be in the future");
      return;
    }

    // Validate against min/max dates if provided
    if (minDate && date < minDate) {
      setError(`Date cannot be before ${minDate.toLocaleDateString()}`);
      return;
    }

    if (maxDate && date > maxDate) {
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

  // Set max date to today for delivery dates
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
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
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
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
}
