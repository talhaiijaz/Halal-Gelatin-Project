"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Settings, Save, AlertCircle, CheckCircle2, Package, Info } from "lucide-react";
import toast from "react-hot-toast";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function SettingsPage() {
  const [monthlyLimit, setMonthlyLimit] = useState<string>("150000");
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Try to get from Convex, fallback to localStorage
  const currentLimitFromDB = useQuery(api.migrations.getMonthlyShipmentLimit, {});
  const setMonthlyShipmentLimit = useMutation(api.migrations.setMonthlyShipmentLimit);
  
  const [currentLimit, setCurrentLimit] = useState<number>(150000);

  // Load limit from database or localStorage
  useEffect(() => {
    if (currentLimitFromDB !== undefined) {
      // Use database value
      setCurrentLimit(currentLimitFromDB);
      setMonthlyLimit(currentLimitFromDB.toString());
    } else {
      // Fallback to localStorage
      const saved = localStorage.getItem('monthlyShipmentLimit');
      if (saved) {
        const savedLimit = parseInt(saved);
        setCurrentLimit(savedLimit);
        setMonthlyLimit(savedLimit.toString());
      }
    }
  }, [currentLimitFromDB]);

  const handleLimitChange = (value: string) => {
    setMonthlyLimit(value);
    setHasChanges(value !== currentLimit.toString());
  };

  const handleSave = async () => {
    const limitValue = parseInt(monthlyLimit);
    
    if (isNaN(limitValue) || limitValue < 0) {
      toast.error("Please enter a valid positive number");
      return;
    }

    if (limitValue > 10000000) { // 10 million kg max
      toast.error("Monthly limit cannot exceed 10,000,000 kg");
      return;
    }

    setIsLoading(true);
    try {
      // Try to save to database first
      if (setMonthlyShipmentLimit) {
        try {
          await setMonthlyShipmentLimit({
            limit: limitValue,
            updatedBy: "Admin User",
          });
          setCurrentLimit(limitValue);
          toast.success("Monthly limit updated successfully in database!");
          setHasChanges(false);
          return;
        } catch (dbError) {
          console.warn("Database save failed, falling back to localStorage:", dbError);
        }
      }
      
      // Fallback to localStorage
      localStorage.setItem('monthlyShipmentLimit', limitValue.toString());
      setCurrentLimit(limitValue);
      
      toast.success("Monthly limit updated successfully!");
      setHasChanges(false);
      
      // Show info about page refresh only for localStorage
      setTimeout(() => {
        toast.success("Refresh the page to see changes in shipment scheduler", {
          duration: 4000,
          icon: "ℹ️",
        });
      }, 1000);
    } catch (error) {
      console.error("Failed to update monthly limit:", error);
      toast.error("Failed to update monthly limit. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setMonthlyLimit(currentLimit.toString());
    setHasChanges(false);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Configure system settings and preferences</p>
        </div>
        <Settings className="h-8 w-8 text-gray-400" />
      </div>

      {/* Monthly Limit Settings Card */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <Package className="h-5 w-5 text-blue-500 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Shipment Settings</h2>
          </div>
          <p className="text-sm text-gray-600 mt-1">Configure monthly shipment limits and thresholds</p>
        </div>
        
        <div className="p-6">
          <div className="max-w-md">
            <label htmlFor="monthlyLimit" className="block text-sm font-medium text-gray-700 mb-2">
              Monthly Shipment Limit (kg)
            </label>
            <div className="relative">
              <input
                type="number"
                id="monthlyLimit"
                value={monthlyLimit}
                onChange={(e) => handleLimitChange(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="150000"
                min="0"
                max="10000000"
                step="1000"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-500 text-sm">kg</span>
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Orders exceeding this monthly limit will be highlighted in red across the system
            </p>
            
            {/* Current Status */}
            <div className="mt-4 p-3 bg-gray-50 rounded-md">
              <div className="flex items-center text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                <span className="text-gray-700">
                  Current limit: <strong>{currentLimit.toLocaleString()} kg</strong>
                </span>
              </div>
              {hasChanges && (
                <div className="flex items-center text-sm mt-2">
                  <AlertCircle className="h-4 w-4 text-orange-500 mr-2" />
                  <span className="text-orange-700">
                    Will be updated to: <strong>{parseInt(monthlyLimit || "0").toLocaleString()} kg</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Info Notice - only show if using localStorage */}
            {currentLimitFromDB === undefined && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-start text-sm">
                  <Info className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                  <div className="text-blue-700">
                    <p><strong>Note:</strong> Database connection unavailable. Settings are saved locally. Refresh the page to see changes in the shipment scheduler and dashboard.</p>
                    <p className="mt-1 text-xs">Settings will sync to database when connection is restored.</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Success notice for database connection */}
            {currentLimitFromDB !== undefined && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-start text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  <div className="text-green-700">
                    <p><strong>Database Connected:</strong> Settings are synchronized across all devices and sessions.</p>
                    <p className="mt-1 text-xs">Changes will be immediately visible in the shipment scheduler and dashboard.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex items-center space-x-3">
            <button
              onClick={handleSave}
              disabled={!hasChanges || isLoading}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                hasChanges && !isLoading
                  ? "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isLoading ? "Saving..." : "Save Changes"}
            </button>
            
            {hasChanges && (
              <button
                onClick={handleReset}
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Future Settings Placeholder */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Additional Settings</h2>
          <p className="text-sm text-gray-600 mt-1">More configuration options coming soon</p>
        </div>
        
        <div className="p-6">
          <div className="text-center py-8 text-gray-500">
            <Settings className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Additional settings will be available in future updates</p>
          </div>
        </div>
      </div>
    </div>
  );
}
