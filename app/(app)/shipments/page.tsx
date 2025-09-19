"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Calendar, Package, Truck, Ship, Plane, Train, Car, Search, Filter, Eye, Plus } from "lucide-react";
import { getCurrentFiscalYear, getFiscalYearOptions, getFiscalYearLabel, getFiscalYearForDate } from "@/app/utils/fiscalYear";
import { timestampToDateString } from "@/app/utils/dateUtils";

// Shipment data structure
interface ShipmentEntry {
  id: string;
  fiscalYear: number;
  fiscalMonth: string;
  bloom: string;
  companyName: string;
  quantity: number;
  orderStatus: string;
  orderId: string;
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
  const [monthlyLimit, setMonthlyLimit] = useState<number>(150000);

  const orders = useQuery(api.orders.list, {});
  const clients = useQuery(api.clients.list, {});
  const orderItems = useQuery(api.orders.listItems, {});
  const monthlyLimitFromDB = useQuery(api.migrations.getMonthlyShipmentLimit, {});

  // Load monthly limit from database or localStorage
  useEffect(() => {
    if (monthlyLimitFromDB !== undefined) {
      setMonthlyLimit(monthlyLimitFromDB);
    } else {
      const saved = localStorage.getItem('monthlyShipmentLimit');
      if (saved) {
        setMonthlyLimit(parseInt(saved));
      }
    }
  }, [monthlyLimitFromDB]);

  // Get fiscal year options
  const fiscalYearOptions = getFiscalYearOptions();
  
  // Create a map of client IDs to client names for quick lookup
  const clientMap = (Array.isArray(clients) ? clients : clients?.page || []).reduce((acc, client) => {
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

    (Array.isArray(orders) ? orders : orders?.page || []).forEach(order => {
      const client = clientMap[order.clientId];
      const clientName = client?.name || 'Unknown Client';
      
      // Debug: Log order details
      console.log(`Processing order: ${order.invoiceNumber}`);
      console.log(`  Stored fiscalYear: ${order.fiscalYear}`);
      console.log(`  Factory departure date: ${order.factoryDepartureDate ? timestampToDateString(order.factoryDepartureDate) : 'Not set'}`);
      console.log(`  Order creation date: ${order.orderCreationDate ? timestampToDateString(order.orderCreationDate) : 'Not set'}`);
      
      // Get fiscal year and month from order data
      let fiscalYear: number;
      let fiscalMonth: string;
      
      // Use stored fiscalYear field if available, otherwise calculate from factoryDepartureDate
      if (order.fiscalYear !== undefined && order.fiscalYear !== null) {
        fiscalYear = order.fiscalYear;
        
        // Calculate fiscal month from factoryDepartureDate (preferred) or orderCreationDate
        const orderDate = order.factoryDepartureDate || order.orderCreationDate;
        if (orderDate) {
          const date = new Date(orderDate);
          const month = date.getMonth(); // 0-11
          const fiscalMonthIndex = month >= 6 ? month - 6 : month + 6;
          fiscalMonth = fiscalMonths[fiscalMonthIndex];
        } else {
          // Fallback to current fiscal month if no date available
          fiscalMonth = getCurrentFiscalMonth();
        }
      } else {
        // Fallback: calculate fiscal year from factoryDepartureDate (preferred) or orderCreationDate
        const orderDate = order.factoryDepartureDate || order.orderCreationDate;
        if (orderDate) {
          const date = new Date(orderDate);
          fiscalYear = getFiscalYearForDate(date);
          
          // Map calendar month to fiscal month
          const month = date.getMonth(); // 0-11
          const fiscalMonthIndex = month >= 6 ? month - 6 : month + 6;
          fiscalMonth = fiscalMonths[fiscalMonthIndex];
        } else {
          // Final fallback to current fiscal year and month
          fiscalYear = getCurrentFiscalYear();
          fiscalMonth = getCurrentFiscalMonth();
        }
      }
      
      console.log(`  Calculated fiscalYear: ${fiscalYear}, fiscalMonth: ${fiscalMonth}`);

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
          quantity: item.quantityKg,
          orderStatus: order.status,
          orderId: order._id
        });
        
        entryId++;
      });
    });

    return shipmentEntries;
  };

  // Generate shipment data from orders
  const shipmentData = generateShipmentData();

  // Debug: Log shipment data for troubleshooting
  console.log('All shipment data:', shipmentData);
  console.log('Selected fiscal year:', selectedFiscalYear);
  console.log('Selected fiscal month:', selectedFiscalMonth);

  // Get data for selected fiscal year and month
  const getFiscalMonthData = (fiscalYear: number, fiscalMonth: string) => {
    const filtered = shipmentData.filter(item => 
      item.fiscalYear === fiscalYear && item.fiscalMonth === fiscalMonth
    );
    console.log(`Filtered data for FY ${fiscalYear} ${fiscalMonth}:`, filtered);
    return filtered;
  };

  // Get unique companies that have data for the selected fiscal month
  const getActiveCompanies = (fiscalYear: number, fiscalMonth: string) => {
    const monthData = getFiscalMonthData(fiscalYear, fiscalMonth);
    return Array.from(new Set(monthData.map(item => item.companyName)));
  };

  // Custom sorting function for bloom ranges
  const sortBloomRanges = (bloomRanges: string[]): string[] => {
    return bloomRanges.sort((a, b) => {
      // "No Bloom" should always be at the end
      if (a === "No Bloom") return 1;
      if (b === "No Bloom") return -1;
      
      // Extract numeric values for comparison
      const getNumericValue = (bloom: string): number => {
        if (bloom.includes('-')) {
          // For ranges like "160-180", use the lower bound
          return parseInt(bloom.split('-')[0]);
        } else {
          // For individual values like "160", use the value directly
          return parseInt(bloom);
        }
      };
      
      const aValue = getNumericValue(a);
      const bValue = getNumericValue(b);
      
      return aValue - bValue;
    });
  };

  // Get unique bloom ranges that have data for the selected fiscal month
  const getActiveBloomRanges = (fiscalYear: number, fiscalMonth: string) => {
    const monthData = getFiscalMonthData(fiscalYear, fiscalMonth);
    const uniqueBloomRanges = Array.from(new Set(monthData.map(item => item.bloom)));
    return sortBloomRanges(uniqueBloomRanges);
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

  // Check if all orders for a specific bloom/company combination are delivered
  const isBloomCompanyDelivered = (bloom: string, company: string, fiscalYear: number, fiscalMonth: string) => {
    const entries = shipmentData.filter(item => 
      item.bloom === bloom && 
      item.companyName === company && 
      item.fiscalYear === fiscalYear &&
      item.fiscalMonth === fiscalMonth
    );
    
    if (entries.length === 0) return false;
    return entries.every(entry => entry.orderStatus === "delivered");
  };

  // Check if all orders for a specific bloom range are delivered
  const isBloomDelivered = (bloom: string, fiscalYear: number, fiscalMonth: string) => {
    const entries = shipmentData.filter(item => 
      item.bloom === bloom && 
      item.fiscalYear === fiscalYear &&
      item.fiscalMonth === fiscalMonth
    );
    
    if (entries.length === 0) return false;
    return entries.every(entry => entry.orderStatus === "delivered");
  };

  // Check if all orders for a company are delivered
  const isCompanyDelivered = (company: string, fiscalYear: number, fiscalMonth: string) => {
    const entries = shipmentData.filter(item => 
      item.companyName === company && 
      item.fiscalYear === fiscalYear &&
      item.fiscalMonth === fiscalMonth
    );
    
    if (entries.length === 0) return false;
    return entries.every(entry => entry.orderStatus === "delivered");
  };

  // Get active companies and bloom ranges for current fiscal month
  const activeCompanies = getActiveCompanies(selectedFiscalYear, selectedFiscalMonth);
  const activeBloomRanges = getActiveBloomRanges(selectedFiscalYear, selectedFiscalMonth);

  // Get the next 3 months from current date
  const getNext3Months = () => {
    const now = new Date();
    const months = [];
    
    for (let i = 0; i < 3; i++) {
      const date = new Date(now);
      date.setMonth(date.getMonth() + i);
      
      const fiscalYear = getFiscalYearForDate(date);
      const month = date.getMonth(); // 0-11
      const fiscalMonthIndex = month >= 6 ? month - 6 : month + 6;
      const fiscalMonth = fiscalMonths[fiscalMonthIndex];
      
      months.push({
        fiscalYear,
        fiscalMonth,
        displayName: date.toLocaleString('default', { month: 'long' }),
        shortName: date.toLocaleString('default', { month: 'short' })
      });
    }
    
    return months;
  };

  const next3Months = getNext3Months();

  // Check if a quantity exceeds the monthly limit
  const exceedsLimit = (quantity: number) => {
    const limit = monthlyLimit || 150000; // Default to 150,000 kg if setting not available
    return quantity >= limit;
  };

  // Get styling for quantities based on limit
  const getQuantityStyle = (quantity: number, isDelivered: boolean = false) => {
    if (exceedsLimit(quantity)) {
      return "bg-red-100 text-red-800 font-semibold";
    }
    if (isDelivered) {
      return "text-green-700";
    }
    return "text-blue-600";
  };

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
              <p className={`text-2xl font-bold ${exceedsLimit(getGrandTotal(selectedFiscalYear, selectedFiscalMonth)) ? 'text-red-600' : 'text-blue-600'}`}>
                {getGrandTotal(selectedFiscalYear, selectedFiscalMonth).toLocaleString()} kg
              </p>
              {exceedsLimit(getGrandTotal(selectedFiscalYear, selectedFiscalMonth)) && (
                <p className="text-xs text-red-500 mt-1">
                  Exceeds limit of {(monthlyLimit || 150000).toLocaleString()} kg
                </p>
              )}
            </div>
            <Truck className={`h-8 w-8 ${exceedsLimit(getGrandTotal(selectedFiscalYear, selectedFiscalMonth)) ? 'text-red-500' : 'text-blue-500'}`} />
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
              {activeBloomRanges.map((bloom) => {
                const isRowDelivered = isBloomDelivered(bloom, selectedFiscalYear, selectedFiscalMonth);
                return (
                  <tr key={bloom} className={`border-b hover:bg-gray-50 ${isRowDelivered ? 'bg-green-50' : ''}`}>
                    <td className={`py-3 px-4 font-medium sticky left-0 z-10 ${isRowDelivered ? 'bg-green-50 text-green-800' : 'bg-white text-gray-900'}`}>
                      {bloom}
                    </td>
                    {activeCompanies.map((company) => {
                      const quantity = getQuantity(bloom, company, selectedFiscalYear, selectedFiscalMonth);
                      const isCellDelivered = isBloomCompanyDelivered(bloom, company, selectedFiscalYear, selectedFiscalMonth);
                      return (
                        <td key={company} className="text-center py-3 px-2">
                          {quantity > 0 ? (
                            <div className={`font-medium ${isCellDelivered ? 'text-green-700' : 'text-blue-600'}`}>
                              {quantity.toLocaleString()} kg
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className={`text-center py-3 px-4 font-bold ${isRowDelivered ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-900'}`}>
                      {getBloomTotal(bloom, selectedFiscalYear, selectedFiscalMonth).toLocaleString()} kg
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-gray-100 border-t-2 border-gray-300">
                <td className="py-3 px-4 font-bold text-gray-900 sticky left-0 bg-gray-100 z-10">
                  Company Total
                </td>
                {activeCompanies.map((company) => {
                  const companyTotal = getCompanyTotal(company, selectedFiscalYear, selectedFiscalMonth);
                  const isCompanyFullyDelivered = isCompanyDelivered(company, selectedFiscalYear, selectedFiscalMonth);
                  return (
                    <td key={company} className={`text-center py-3 px-2 font-bold ${isCompanyFullyDelivered ? 'text-green-700' : 'text-gray-900'}`}>
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

      {/* 3-Month View */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">3-Month Outlook: {next3Months.map(m => m.displayName).join(', ')}</h2>
          <p className="text-sm text-gray-600 mt-1">Upcoming shipments across the next three months</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left py-3 px-4 font-medium text-gray-900 sticky left-0 bg-gray-50 z-10 min-w-[120px]">
                  Bloom Range
                </th>
                {next3Months.map((monthData) => (
                  <th key={`${monthData.fiscalYear}-${monthData.fiscalMonth}`} className="text-center py-3 px-4 font-medium text-gray-900 min-w-[150px]">
                    <div>
                      <div className="font-semibold">{monthData.displayName}</div>
                      <div className="text-xs text-gray-500 font-normal">{getFiscalYearLabel(monthData.fiscalYear)}</div>
                    </div>
                  </th>
                ))}
                <th className="text-center py-3 px-4 font-medium text-gray-900 bg-gray-100 min-w-[120px]">
                  3-Month Total
                </th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Get all unique bloom ranges across all 3 months
                const allBloomRanges = new Set<string>();
                next3Months.forEach(monthData => {
                  const monthBloomRanges = getActiveBloomRanges(monthData.fiscalYear, monthData.fiscalMonth);
                  monthBloomRanges.forEach(bloom => allBloomRanges.add(bloom));
                });
                
                const sortedBloomRanges = sortBloomRanges(Array.from(allBloomRanges));
                
                return sortedBloomRanges.map((bloom) => {
                  // Check if bloom is delivered across any of the 3 months
                  const isAnyMonthDelivered = next3Months.some(monthData => 
                    isBloomDelivered(bloom, monthData.fiscalYear, monthData.fiscalMonth)
                  );
                  
                  return (
                    <tr key={bloom} className={`border-b hover:bg-gray-50 ${isAnyMonthDelivered ? 'bg-green-50' : ''}`}>
                      <td className={`py-3 px-4 font-medium sticky left-0 z-10 ${isAnyMonthDelivered ? 'bg-green-50 text-green-800' : 'bg-white text-gray-900'}`}>
                        {bloom}
                      </td>
                      {next3Months.map((monthData) => {
                        const monthTotal = getBloomTotal(bloom, monthData.fiscalYear, monthData.fiscalMonth);
                        const isMonthDelivered = isBloomDelivered(bloom, monthData.fiscalYear, monthData.fiscalMonth);
                        return (
                          <td key={`${monthData.fiscalYear}-${monthData.fiscalMonth}`} className="text-center py-3 px-4">
                            {monthTotal > 0 ? (
                              <div className={`font-medium ${isMonthDelivered ? 'text-green-700' : 'text-blue-600'}`}>
                                {monthTotal.toLocaleString()} kg
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className={`text-center py-3 px-4 font-bold ${isAnyMonthDelivered ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-900'}`}>
                        {(() => {
                          const threeMonthTotal = next3Months.reduce((sum, monthData) => 
                            sum + getBloomTotal(bloom, monthData.fiscalYear, monthData.fiscalMonth), 0);
                          return threeMonthTotal > 0 ? `${threeMonthTotal.toLocaleString()} kg` : '-';
                        })()}
                      </td>
                    </tr>
                  );
                });
              })()}
              <tr className="bg-gray-100 border-t-2 border-gray-300">
                <td className="py-3 px-4 font-bold text-gray-900 sticky left-0 bg-gray-100 z-10">
                  Monthly Total
                </td>
                {next3Months.map((monthData) => {
                  const monthGrandTotal = getGrandTotal(monthData.fiscalYear, monthData.fiscalMonth);
                  return (
                    <td key={`${monthData.fiscalYear}-${monthData.fiscalMonth}`} className="text-center py-3 px-4 font-bold text-gray-900">
                      {monthGrandTotal > 0 ? `${monthGrandTotal.toLocaleString()} kg` : '-'}
                    </td>
                  );
                })}
                <td className="text-center py-3 px-4 font-bold text-gray-900 bg-gray-200">
                  {(() => {
                    const overallTotal = next3Months.reduce((sum, monthData) => 
                      sum + getGrandTotal(monthData.fiscalYear, monthData.fiscalMonth), 0);
                    return `${overallTotal.toLocaleString()} kg`;
                  })()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 3-Month Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {next3Months.map((monthData, index) => {
          const monthTotal = getGrandTotal(monthData.fiscalYear, monthData.fiscalMonth);
          const isOverLimit = exceedsLimit(monthTotal);
          
          return (
            <div key={`${monthData.fiscalYear}-${monthData.fiscalMonth}`} className={`rounded-lg shadow p-6 ${isOverLimit ? 'bg-red-50 border-2 border-red-200' : 'bg-white'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{monthData.displayName} Shipments</p>
                  <p className={`text-2xl font-bold ${isOverLimit ? 'text-red-600' : 'text-blue-600'}`}>
                    {monthTotal.toLocaleString()} kg
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {getFiscalMonthData(monthData.fiscalYear, monthData.fiscalMonth).length} shipments
                  </p>
                  {isOverLimit && (
                    <p className="text-xs text-red-500 mt-1">
                      ⚠️ Exceeds limit of {(monthlyLimit || 150000).toLocaleString()} kg
                    </p>
                  )}
                </div>
                <div className={`h-8 w-8 ${isOverLimit ? 'text-red-500' : index === 0 ? 'text-green-500' : index === 1 ? 'text-blue-500' : 'text-purple-500'}`}>
                  {index === 0 && <Calendar className="h-8 w-8" />}
                  {index === 1 && <Package className="h-8 w-8" />}
                  {index === 2 && <Truck className="h-8 w-8" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
