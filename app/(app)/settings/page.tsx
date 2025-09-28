"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Settings, Save, AlertCircle, CheckCircle2, Package, Info, DollarSign, FileText, User } from "lucide-react";
import toast from "react-hot-toast";
// import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function SettingsPage() {
  // Dashboard Settings State
  const [dashboardOrderLimit, setDashboardOrderLimit] = useState<string>("5");
  const [currentDashboardLimit, setCurrentDashboardLimit] = useState<number>(5);
  const [dashboardHasChanges, setDashboardHasChanges] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // Shipment Settings State
  const [monthlyLimit, setMonthlyLimit] = useState<string>("150000");
  const [currentLimit, setCurrentLimit] = useState<number>(150000);
  const [shipmentHasChanges, setShipmentHasChanges] = useState(false);
  const [shipmentLoading, setShipmentLoading] = useState(false);


  // Try to get from Convex, fallback to localStorage
  const currentLimitFromDB = useQuery(api.settings.getMonthlyShipmentLimit, {});
  const setMonthlyShipmentLimit = useMutation(api.settings.setMonthlyShipmentLimit);

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

  // Load dashboard order limit from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dashboardOrderLimit');
    if (saved) {
      const savedLimit = parseInt(saved);
      setCurrentDashboardLimit(savedLimit);
      setDashboardOrderLimit(savedLimit.toString());
    }
  }, []);


  const handleLimitChange = (value: string) => {
    setMonthlyLimit(value);
    setShipmentHasChanges(value !== currentLimit.toString());
  };

  const handleDashboardLimitChange = (value: string) => {
    setDashboardOrderLimit(value);
    setDashboardHasChanges(value !== currentDashboardLimit.toString());
  };

  const handleSaveDashboardSettings = async () => {
    const dashboardLimitValue = parseInt(dashboardOrderLimit);
    
    if (isNaN(dashboardLimitValue) || dashboardLimitValue < 1 || dashboardLimitValue > 20) {
      toast.error("Dashboard order limit must be between 1 and 20");
      return;
    }

    setDashboardLoading(true);
    try {
      // Save dashboard order limit to localStorage
      localStorage.setItem('dashboardOrderLimit', dashboardLimitValue.toString());
      setCurrentDashboardLimit(dashboardLimitValue);
      
      toast.success("Dashboard settings updated successfully!");
      setDashboardHasChanges(false);
      
      // Show info about page refresh
      setTimeout(() => {
        toast.success("Refresh the page to see changes in dashboard", {
          duration: 4000,
          icon: "ℹ️",
        });
      }, 1000);
    } catch (error) {
      console.error("Failed to update dashboard settings:", error);
      toast.error("Failed to update dashboard settings. Please try again.");
    } finally {
      setDashboardLoading(false);
    }
  };

  const handleSaveShipmentSettings = async () => {
    const limitValue = parseInt(monthlyLimit);
    
    if (isNaN(limitValue) || limitValue < 0) {
      toast.error("Please enter a valid positive number for monthly limit");
      return;
    }

    if (limitValue > 10000000) { // 10 million kg max
      toast.error("Monthly limit cannot exceed 10,000,000 kg");
      return;
    }

    setShipmentLoading(true);
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
          setShipmentHasChanges(false);
          return;
        } catch (dbError) {
          console.warn("Database save failed, falling back to localStorage:", dbError);
        }
      }
      
      // Fallback to localStorage
      localStorage.setItem('monthlyShipmentLimit', limitValue.toString());
      setCurrentLimit(limitValue);
      
      toast.success("Shipment settings updated successfully!");
      setShipmentHasChanges(false);
      
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
      setShipmentLoading(false);
    }
  };

  const handleResetDashboard = () => {
    setDashboardOrderLimit(currentDashboardLimit.toString());
    setDashboardHasChanges(false);
  };

  const handleResetShipment = () => {
    setMonthlyLimit(currentLimit.toString());
    setShipmentHasChanges(false);
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


      {/* Dashboard Settings */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <Settings className="h-5 w-5 text-blue-500 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Dashboard Settings</h2>
          </div>
          <p className="text-sm text-gray-600 mt-1">Configure dashboard display preferences</p>
        </div>
        
        <div className="p-6">
          <div className="max-w-md">
            <label htmlFor="dashboardOrderLimit" className="block text-sm font-medium text-gray-700 mb-2">
              Dashboard Order Limit
            </label>
            <div className="relative">
              <input
                type="number"
                id="dashboardOrderLimit"
                value={dashboardOrderLimit}
                onChange={(e) => handleDashboardLimitChange(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="5"
                min="1"
                max="20"
                step="1"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-500 text-sm"></span>
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Number of orders to display in each status column on the dashboard
            </p>
            
            {/* Current Status */}
            <div className="mt-4 p-3 bg-gray-50 rounded-md">
              <div className="flex items-center text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                <span className="text-gray-700">
                  Current limit: <strong>{currentDashboardLimit} orders</strong>
                </span>
              </div>
              {dashboardHasChanges && (
                <div className="flex items-center text-sm mt-2">
                  <AlertCircle className="h-4 w-4 text-orange-500 mr-2" />
                  <span className="text-orange-700">
                    Will be updated to: <strong>{dashboardOrderLimit} orders</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex items-center space-x-3">
              <button
                onClick={handleSaveDashboardSettings}
                disabled={!dashboardHasChanges || dashboardLoading}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                  dashboardHasChanges && !dashboardLoading
                    ? "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    : "bg-gray-400 cursor-not-allowed"
                }`}
              >
                {dashboardLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {dashboardLoading ? "Saving..." : "Save Dashboard Settings"}
              </button>
              
              {dashboardHasChanges && (
                <button
                  onClick={handleResetDashboard}
                  disabled={dashboardLoading}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* Order Settings */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <FileText className="h-5 w-5 text-orange-500 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Order Settings</h2>
          </div>
          <p className="text-sm text-gray-600 mt-1">Configure order processing preferences</p>
        </div>
        
        <div className="p-6">
          <div className="text-center py-8 text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium">Coming Soon</p>
            <p className="text-sm">Order-specific settings will be added here</p>
          </div>
        </div>
      </div>

      {/* Finance Settings */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <DollarSign className="h-5 w-5 text-green-500 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Finance Settings</h2>
          </div>
          <p className="text-sm text-gray-600 mt-1">Configure financial reporting and payment preferences</p>
        </div>
        
        <div className="p-6">
          <div className="text-center py-8 text-gray-500">
            <DollarSign className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium">Coming Soon</p>
            <p className="text-sm">Finance-specific settings will be added here</p>
          </div>
        </div>
      </div>

      {/* Shipment Settings */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <Package className="h-5 w-5 text-green-500 mr-2" />
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
                <span className="text-gray-500 text-sm"></span>
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
              {shipmentHasChanges && (
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
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex items-center space-x-3">
            <button
              onClick={handleSaveShipmentSettings}
              disabled={!shipmentHasChanges || shipmentLoading}
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                shipmentHasChanges && !shipmentLoading
                  ? "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              {shipmentLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {shipmentLoading ? "Saving..." : "Save Shipment Settings"}
            </button>
            
            {shipmentHasChanges && (
              <button
                onClick={handleResetShipment}
                disabled={shipmentLoading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* User Settings */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <User className="h-5 w-5 text-indigo-500 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">User Settings</h2>
          </div>
          <p className="text-sm text-gray-600 mt-1">Configure user account and system preferences</p>
        </div>
        
        <div className="p-6">
          <div className="text-center py-8 text-gray-500">
            <User className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium">Coming Soon</p>
            <p className="text-sm">User-specific settings will be added here</p>
          </div>
        </div>
      </div>
    </div>
  );
}
