"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Calendar, Package, Truck, Ship, Plane, Train, Car, Search, Filter, Eye, Plus } from "lucide-react";
import { getCurrentFiscalYear, getFiscalYearOptions, getFiscalYearLabel, getFiscalYearForDate } from "@/app/utils/fiscalYear";

// Shipment data structure
interface ShipmentEntry {
  id: string;
  fiscalYear: number;
  fiscalMonth: string;
  bloom: string;
  companyName: string;
  quantity: number;
}

import { BLOOM_RANGES, BLOOM_INDIVIDUAL_VALUES } from "@/app/utils/bloomRanges";

// Bloom ranges and individual values
const bloomRanges = [
  ...BLOOM_RANGES,
  ...BLOOM_INDIVIDUAL_VALUES,
  "No Bloom"
];

// Fiscal year months (July to June)
const fiscalMonths = [
  "July", "August", "September", "October", "November", "December",
  "January", "February", "March", "April", "May", "June"
];

// Get current fiscal month
const getCurrentFiscalMonth = () => {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  
  // Map calendar months to fiscal months
  // July (6) = 0, August (7) = 1, ..., June (5) = 11
  const fiscalMonthIndex = month >= 6 ? month - 6 : month + 6;
  return fiscalMonths[fiscalMonthIndex];
};

export default function ShipmentsPage() {
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(getCurrentFiscalYear());
  const [selectedFiscalMonth, setSelectedFiscalMonth] = useState(getCurrentFiscalMonth());

  const orders = useQuery(api.orders.list, {});
  const clients = useQuery(api.clients.list, {});
  const orderItems = useQuery(api.orders.listItems, {});

  // Get fiscal year options
  const fiscalYearOptions = getFiscalYearOptions();
  
  // Create a map of client IDs to client names for quick lookup
  const clientMap = clients?.reduce((acc, client) => {
    acc[client._id] = client;
    return acc;
  }, {} as Record<string, any>) || {};

  // Create a map of order IDs to order items for quick lookup
  const itemsByOrderId = orderItems?.reduce((acc, item) => {
    if (!acc[item.orderId]) {
      acc[item.orderId] = [];
    }
    acc[item.orderId].push(item);
    return acc;
  }, {} as Record<string, any[]>) || {};

  // Generate shipment data from actual orders
  const generateShipmentData = (): ShipmentEntry[] => {
    if (!orders || !clients) return [];

    const shipmentEntries: ShipmentEntry[] = [];
    let entryId = 1;

    orders.forEach(order => {
      const client = clientMap[order.clientId];
      const clientName = client?.name || 'Unknown Client';
      
      // Get order creation date and convert to fiscal year and month
      let fiscalYear: number;
      let fiscalMonth: string;
      
      if (order.orderCreationDate) {
        const date = new Date(order.orderCreationDate);
        fiscalYear = getFiscalYearForDate(date);
        
        // Map calendar month to fiscal month
        const month = date.getMonth(); // 0-11
        const fiscalMonthIndex = month >= 6 ? month - 6 : month + 6;
        fiscalMonth = fiscalMonths[fiscalMonthIndex];
      } else {
        // Fallback to current fiscal year and month
        fiscalYear = getCurrentFiscalYear();
        fiscalMonth = getCurrentFiscalMonth();
      }

      // Get items for this order
      const items = itemsByOrderId[order._id] || [];
      
      items.forEach(item => {
        // Use bloom value if available, otherwise use "No Bloom"
        const bloomKey = item.bloom ? item.bloom.toString() : "No Bloom";
        
        shipmentEntries.push({
          id: entryId.toString(),
          fiscalYear,
          fiscalMonth,
          bloom: bloomKey,
          companyName: clientName,
          quantity: item.quantityKg
        });
        
        entryId++;
      });
    });

    return shipmentEntries;
  };

  // Generate shipment data from orders
  const shipmentData = generateShipmentData();

  // Get data for selected fiscal year and month
  const getFiscalMonthData = (fiscalYear: number, fiscalMonth: string) => {
    return shipmentData.filter(item => 
      item.fiscalYear === fiscalYear && item.fiscalMonth === fiscalMonth
    );
  };

  // Get unique companies that have data for the selected fiscal month
  const getActiveCompanies = (fiscalYear: number, fiscalMonth: string) => {
    const monthData = getFiscalMonthData(fiscalYear, fiscalMonth);
    return Array.from(new Set(monthData.map(item => item.companyName)));
  };

  // Get unique bloom ranges that have data for the selected fiscal month
  const getActiveBloomRanges = (fiscalYear: number, fiscalMonth: string) => {
    const monthData = getFiscalMonthData(fiscalYear, fiscalMonth);
    return Array.from(new Set(monthData.map(item => item.bloom)));
  };

  // Get quantity for specific bloom and company in selected fiscal month
  const getQuantity = (bloom: string, company: string, fiscalYear: number, fiscalMonth: string) => {
    const entry = shipmentData.find(item => 
      item.bloom === bloom && 
      item.companyName === company && 
      item.fiscalYear === fiscalYear &&
      item.fiscalMonth === fiscalMonth
    );
    return entry?.quantity || 0;
  };

  // Calculate total quantity for bloom in selected fiscal month
  const getBloomTotal = (bloom: string, fiscalYear: number, fiscalMonth: string) => {
    return shipmentData
      .filter(item => item.bloom === bloom && item.fiscalYear === fiscalYear && item.fiscalMonth === fiscalMonth)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  // Calculate total quantity for company in selected fiscal month
  const getCompanyTotal = (company: string, fiscalYear: number, fiscalMonth: string) => {
    return shipmentData
      .filter(item => item.companyName === company && item.fiscalYear === fiscalYear && item.fiscalMonth === fiscalMonth)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  // Calculate grand total for selected fiscal month
  const getGrandTotal = (fiscalYear: number, fiscalMonth: string) => {
    return shipmentData
      .filter(item => item.fiscalYear === fiscalYear && item.fiscalMonth === fiscalMonth)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  // Get active companies and bloom ranges for current fiscal month
  const activeCompanies = getActiveCompanies(selectedFiscalYear, selectedFiscalMonth);
  const activeBloomRanges = getActiveBloomRanges(selectedFiscalYear, selectedFiscalMonth);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shipment Scheduler</h1>
          <p className="text-gray-600 mt-1">Monthly shipment quantities by bloom range and company</p>
        </div>

      </div>

      {/* Fiscal Year and Month Selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Fiscal Year:</label>
            <select
              value={selectedFiscalYear}
              onChange={(e) => setSelectedFiscalYear(parseInt(e.target.value))}
              className="ml-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {fiscalYearOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Month:</label>
            <select
              value={selectedFiscalMonth}
              onChange={(e) => setSelectedFiscalMonth(e.target.value)}
              className="ml-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {fiscalMonths.map((month) => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Shipments</p>
              <p className="text-2xl font-bold text-gray-900">{getFiscalMonthData(selectedFiscalYear, selectedFiscalMonth).length}</p>
            </div>
            <Package className="h-8 w-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Quantity</p>
              <p className="text-2xl font-bold text-blue-600">{getGrandTotal(selectedFiscalYear, selectedFiscalMonth).toLocaleString()} kg</p>
            </div>
            <Truck className="h-8 w-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Shipment Scheduler Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Shipment Schedule for {selectedFiscalMonth} {getFiscalYearLabel(selectedFiscalYear)}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left py-3 px-4 font-medium text-gray-900 sticky left-0 bg-gray-50 z-10 min-w-[120px]">
                  Bloom Range
                </th>
                {activeCompanies.map((company) => (
                  <th key={company} className="text-center py-3 px-2 font-medium text-gray-900 min-w-[150px]">
                    {company}
                  </th>
                ))}
                <th className="text-center py-3 px-4 font-medium text-gray-900 bg-gray-100 min-w-[120px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {activeBloomRanges.map((bloom) => (
                <tr key={bloom} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900 sticky left-0 bg-white z-10">
                    {bloom}
                  </td>
                  {activeCompanies.map((company) => {
                    const quantity = getQuantity(bloom, company, selectedFiscalYear, selectedFiscalMonth);
                    return (
                      <td key={company} className="text-center py-3 px-2">
                        {quantity > 0 ? (
                          <div className="font-medium text-blue-600">
                            {quantity.toLocaleString()} kg
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-center py-3 px-4 font-bold text-gray-900 bg-gray-100">
                    {getBloomTotal(bloom, selectedFiscalYear, selectedFiscalMonth).toLocaleString()} kg
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-100 border-t-2 border-gray-300">
                <td className="py-3 px-4 font-bold text-gray-900 sticky left-0 bg-gray-100 z-10">
                  Company Total
                </td>
                {activeCompanies.map((company) => {
                  const companyTotal = getCompanyTotal(company, selectedFiscalYear, selectedFiscalMonth);
                  return (
                    <td key={company} className="text-center py-3 px-2 font-bold text-gray-900">
                      {companyTotal > 0 ? `${companyTotal.toLocaleString()} kg` : '-'}
                    </td>
                  );
                })}
                <td className="text-center py-3 px-4 font-bold text-gray-900 bg-gray-200">
                  {getGrandTotal(selectedFiscalYear, selectedFiscalMonth).toLocaleString()} kg
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>


    </div>
  );
}
