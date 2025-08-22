"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Calendar, Package, Truck, Ship, Plane, Train, Car, Search, Filter, Eye, Plus } from "lucide-react";

// Shipment data structure
interface ShipmentEntry {
  id: string;
  month: string;
  bloom: string;
  companyName: string;
  quantity: number;
}

// Bloom ranges
const bloomRanges = [
  "160-180",
  "200-220", 
  "220-240",
  "240-260",
  "250-270",
  "No Bloom"
];

// Get current month and year
const getCurrentMonth = () => {
  const now = new Date();
  const monthName = now.toLocaleString('en-US', { month: 'long' });
  const year = now.getFullYear();
  return `${monthName} ${year}`;
};

// Get next 6 months
const getUpcomingMonths = () => {
  const months = [];
  const now = new Date();
  
  for (let i = 0; i < 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthName = date.toLocaleString('en-US', { month: 'long' });
    const year = date.getFullYear();
    months.push(`${monthName} ${year}`);
  }
  
  return months;
};

export default function ShipmentsPage() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);

  const orders = useQuery(api.orders.list);
  const clients = useQuery(api.clients.list);
  const orderItems = useQuery(api.orders.listItems);

  // Get upcoming months
  const upcomingMonths = getUpcomingMonths();
  
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
      
      // Get order creation date and convert to month string
      let monthKey: string;
      if (order.orderCreationDate) {
        const date = new Date(order.orderCreationDate);
        monthKey = `${date.toLocaleString('en-US', { month: 'long' })} ${date.getFullYear()}`;
      } else {
        // Fallback to current month if no creation date
        const now = new Date();
        monthKey = `${now.toLocaleString('en-US', { month: 'long' })} ${now.getFullYear()}`;
      }

      // Get items for this order
      const items = itemsByOrderId[order._id] || [];
      
      items.forEach(item => {
        // Use bloom value if available, otherwise use "No Bloom"
        const bloomKey = item.bloom ? item.bloom.toString() : "No Bloom";
        
        shipmentEntries.push({
          id: entryId.toString(),
          month: monthKey,
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

  // Get data for selected month
  const getMonthData = (month: string) => {
    return shipmentData.filter(item => item.month === month);
  };

  // Get unique companies that have data for the selected month
  const getActiveCompanies = (month: string) => {
    const monthData = getMonthData(month);
    return [...new Set(monthData.map(item => item.companyName))];
  };

  // Get unique bloom ranges that have data for the selected month
  const getActiveBloomRanges = (month: string) => {
    const monthData = getMonthData(month);
    return [...new Set(monthData.map(item => item.bloom))];
  };

  // Get quantity for specific bloom and company in selected month
  const getQuantity = (bloom: string, company: string, month: string) => {
    const entry = shipmentData.find(item => 
      item.bloom === bloom && 
      item.companyName === company && 
      item.month === month
    );
    return entry?.quantity || 0;
  };

  // Calculate total quantity for bloom in selected month
  const getBloomTotal = (bloom: string, month: string) => {
    return shipmentData
      .filter(item => item.bloom === bloom && item.month === month)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  // Calculate total quantity for company in selected month
  const getCompanyTotal = (company: string, month: string) => {
    return shipmentData
      .filter(item => item.companyName === company && item.month === month)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  // Calculate grand total for selected month
  const getGrandTotal = (month: string) => {
    return shipmentData
      .filter(item => item.month === month)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  // Get active companies and bloom ranges for current month
  const activeCompanies = getActiveCompanies(selectedMonth);
  const activeBloomRanges = getActiveBloomRanges(selectedMonth);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shipment Scheduler</h1>
          <p className="text-gray-600 mt-1">Monthly shipment quantities by bloom range and company</p>
        </div>
        <button
          onClick={() => setIsAddEntryOpen(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Entry
        </button>
      </div>

      {/* Month Selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Select Month:</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {upcomingMonths.map((month) => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Shipments</p>
              <p className="text-2xl font-bold text-gray-900">{getMonthData(selectedMonth).length}</p>
            </div>
            <Package className="h-8 w-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Quantity</p>
              <p className="text-2xl font-bold text-blue-600">{getGrandTotal(selectedMonth).toLocaleString()} kg</p>
            </div>
            <Truck className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Companies</p>
              <p className="text-2xl font-bold text-green-600">{activeCompanies.length}</p>
            </div>
            <Calendar className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Bloom Ranges</p>
              <p className="text-2xl font-bold text-purple-600">{activeBloomRanges.length}</p>
            </div>
            <Package className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Shipment Scheduler Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Shipment Schedule for {selectedMonth}</h2>
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
                    const quantity = getQuantity(bloom, company, selectedMonth);
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
                    {getBloomTotal(bloom, selectedMonth).toLocaleString()} kg
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-100 border-t-2 border-gray-300">
                <td className="py-3 px-4 font-bold text-gray-900 sticky left-0 bg-gray-100 z-10">
                  Company Total
                </td>
                {activeCompanies.map((company) => {
                  const companyTotal = getCompanyTotal(company, selectedMonth);
                  return (
                    <td key={company} className="text-center py-3 px-2 font-bold text-gray-900">
                      {companyTotal > 0 ? `${companyTotal.toLocaleString()} kg` : '-'}
                    </td>
                  );
                })}
                <td className="text-center py-3 px-4 font-bold text-gray-900 bg-gray-200">
                  {getGrandTotal(selectedMonth).toLocaleString()} kg
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>


    </div>
  );
}
