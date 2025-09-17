"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { 
  Users, 
  Package, 
  DollarSign, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AddCustomerModal from "@/app/components/clients/AddCustomerModal";
import CreateOrderModal from "@/app/components/orders/CreateOrderModal";
import toast from "react-hot-toast";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { getCurrentFiscalYear, getFiscalYearForDate, formatFiscalYear } from "@/app/utils/fiscalYear";
import { formatDateForDisplay } from "@/app/utils/dateUtils";
import { getUsdRates, type UsdRates } from "@/app/utils/fx";
import { formatCurrency, getCurrencyForClientType, type SupportedCurrency } from "@/app/utils/currencyFormat";

export default function DashboardPage() {
  console.log("DashboardPage rendering...");
  const router = useRouter();
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
  const [clientType, setClientType] = useState<"local" | "international">("local");
  const [monthlyLimit, setMonthlyLimit] = useState<number>(150000);
  const [expandedMetric, setExpandedMetric] = useState<null | { metric: 'revenue' | 'pending' | 'advance' | 'receivables'; audience: 'local' | 'international' }>(null);

  // Get dashboard order limit from localStorage
  const [dashboardOrderLimit, setDashboardOrderLimit] = useState<number>(5);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(Math.max(2025, getCurrentFiscalYear()));
  
  // Fetch real data from Convex
  const dashboardStats = useQuery(api.dashboard.getStats, { fiscalYear: selectedFiscalYear });
  const orders = useQuery(api.orders.list, { fiscalYear: selectedFiscalYear });
  const orderItems = useQuery(api.orders.listItems, {});
  const monthlyLimitFromDB = useQuery(api.migrations.getMonthlyShipmentLimit, {});
  
  // Fetch client-specific stats for accurate local/international breakdown
  const localStats = useQuery(api.clients.getStats, { type: "local", fiscalYear: selectedFiscalYear });
  const internationalStats = useQuery(api.clients.getStats, { type: "international", fiscalYear: selectedFiscalYear });
  const [usdRates, setUsdRates] = useState<UsdRates>({ USD: 1, EUR: 1.08, AED: 0.2723 });
  // USD total and info toggles removed per request
  useEffect(() => {
    const ac = new AbortController();
    const fetchRates = () => getUsdRates(ac.signal).then(setUsdRates).catch(() => {});
    fetchRates();
    const intervalId = setInterval(fetchRates, 1000 * 60 * 60 * 6); // refresh every 6 hours
    const onFocus = () => fetchRates();
    window.addEventListener('focus', onFocus);
    return () => {
      ac.abort();
      clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
    };
  }, []);
  
  useEffect(() => {
    const saved = localStorage.getItem('dashboardOrderLimit');
    if (saved) {
      setDashboardOrderLimit(parseInt(saved));
    }
    
    // Load fiscal year setting from localStorage
    const savedFiscalYear = localStorage.getItem('selectedFiscalYear');
    if (savedFiscalYear) {
      setSelectedFiscalYear(parseInt(savedFiscalYear));
    } else {
      // Smart default: Use current fiscal year, but ensure it's at least 2025
      const defaultYear = Math.max(2025, getCurrentFiscalYear());
      setSelectedFiscalYear(defaultYear);
    }

    // Listen for fiscal year changes from settings
    const handleStorageChange = (event: CustomEvent) => {
      if (event.detail.key === 'selectedFiscalYear') {
        setSelectedFiscalYear(event.detail.value);
      }
    };

    window.addEventListener('localStorageChange', handleStorageChange as EventListener);
    
    return () => {
      window.removeEventListener('localStorageChange', handleStorageChange as EventListener);
    };
  }, []);

  // Fetch orders by status
  const ordersData = useQuery(api.dashboard.getOrdersByStatus, { limit: dashboardOrderLimit, fiscalYear: selectedFiscalYear });

  // Detail queries (lazy-loaded when a metric is expanded)
  const receivablesDetails = useQuery(
    api.dashboard.getReceivablesDetails,
    expandedMetric && expandedMetric.metric === 'receivables'
      ? { fiscalYear: selectedFiscalYear, type: expandedMetric.audience }
      : 'skip'
  );
  const advanceDetails = useQuery(
    api.dashboard.getAdvancePaymentsDetails,
    expandedMetric && expandedMetric.metric === 'advance'
      ? { fiscalYear: selectedFiscalYear, type: expandedMetric.audience }
      : 'skip'
  );
  const revenueDetails = useQuery(
    api.dashboard.getRevenueDetails,
    expandedMetric && expandedMetric.metric === 'revenue'
      ? { fiscalYear: selectedFiscalYear, type: expandedMetric.audience }
      : 'skip'
  );
  const pendingOrdersDetails = useQuery(
    api.dashboard.getPendingOrdersDetails,
    expandedMetric && expandedMetric.metric === 'pending'
      ? { fiscalYear: selectedFiscalYear, type: expandedMetric.audience }
      : 'skip'
  );

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


  // Helper function to get next 3 months shipment data
  const getNext3MonthsShipmentData = () => {
    if (!orders || !orderItems) return [];
    
    const limit = monthlyLimit || 150000; // Default to 150,000 kg if setting not available
    const now = new Date();
    const months = [];
    
    // Fiscal months array
    const fiscalMonths = [
      "July", "August", "September", "October", "November", "December",
      "January", "February", "March", "April", "May", "June"
    ];
    
    for (let i = 0; i < 3; i++) {
      const date = new Date(now);
      date.setMonth(date.getMonth() + i);
      
      const fiscalYear = getFiscalYearForDate(date);
      const month = date.getMonth(); // 0-11
      const fiscalMonthIndex = month >= 6 ? month - 6 : month + 6;
      const fiscalMonth = fiscalMonths[fiscalMonthIndex];
      
      // Calculate total quantity for this month
      let totalQuantity = 0;
      
      orders.forEach(order => {
        // Use stored fiscalYear field if available, otherwise calculate from factoryDepartureDate
        let orderFiscalYear: number;
        let orderFiscalMonth: string;
        
        if (order.fiscalYear !== undefined && order.fiscalYear !== null) {
          orderFiscalYear = order.fiscalYear;
          
          // Calculate fiscal month from factoryDepartureDate (preferred) or orderCreationDate
          const orderDate = order.factoryDepartureDate || order.orderCreationDate;
          if (orderDate) {
            const date = new Date(orderDate);
            const orderMonth = date.getMonth();
            const orderFiscalMonthIndex = orderMonth >= 6 ? orderMonth - 6 : orderMonth + 6;
            orderFiscalMonth = fiscalMonths[orderFiscalMonthIndex];
          } else {
            // Skip this order if no date available
            return;
          }
        } else {
          // Fallback: calculate fiscal year from factoryDepartureDate (preferred) or orderCreationDate
          const orderDate = order.factoryDepartureDate || order.orderCreationDate;
          if (orderDate) {
            const date = new Date(orderDate);
            orderFiscalYear = getFiscalYearForDate(date);
            const orderMonth = date.getMonth();
            const orderFiscalMonthIndex = orderMonth >= 6 ? orderMonth - 6 : orderMonth + 6;
            orderFiscalMonth = fiscalMonths[orderFiscalMonthIndex];
          } else {
            // Skip this order if no date available
            return;
          }
        }
        
        if (orderFiscalYear === fiscalYear && orderFiscalMonth === fiscalMonth) {
          const items = orderItems.filter(item => item.orderId === order._id);
          items.forEach(item => {
            totalQuantity += item.quantityKg;
          });
        }
      });
      
      months.push({
        fiscalYear,
        fiscalMonth,
        displayName: date.toLocaleString('default', { month: 'long' }),
        totalQuantity,
        exceedsLimit: totalQuantity >= limit
      });
    }
    
    return months;
  };

  const monthsData = getNext3MonthsShipmentData();
  const hasLimitExceeded = monthsData.some(month => month.exceedsLimit);

  // Helper function to get client currency
  const getClientCurrency = (clientType: string): SupportedCurrency => {
    return getCurrencyForClientType(clientType as 'local' | 'international', 'USD');
  };

  // Create stats array with real data - simplified since we now have separate financial sections
  const stats = dashboardStats && localStats && internationalStats ? [
    {
      name: "Total Clients",
      value: dashboardStats.totalClients.value.toString(),
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      name: "Active Orders",
      value: dashboardStats.activeOrders.value.toString(),
      icon: Package,
      color: "text-green-600",
      bgColor: "bg-green-100",
      subtitle: `Total Orders: ${(localStats.totalOrders + internationalStats.totalOrders).toString()}`,
    },
    {
      name: "Local Clients",
      value: dashboardStats.localClients.toString(),
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      subtitle: `Active Orders: ${localStats.activeOrders}`,
    },
    {
      name: "International Clients",
      value: dashboardStats.internationalClients.toString(),
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-100",
      subtitle: `Active Orders: ${internationalStats.activeOrders}`,
    },
  ] : [];


  return (
    <div>
      {/* Monthly Limit Alert */}
      {hasLimitExceeded && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Monthly Shipment Limit Exceeded</h3>
              <div className="mt-2 text-sm text-red-700">
                {monthsData.filter(month => month.exceedsLimit).map((month, index) => (
                  <div key={`${month.fiscalYear}-${month.fiscalMonth}`} className="mb-1">
                    <strong>{month.displayName}:</strong> {month.totalQuantity.toLocaleString()} kg 
                    (exceeds limit of {(monthlyLimit || 150000).toLocaleString()} kg)
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <Link
                  href="/shipments"
                  className="inline-flex items-center text-sm text-red-600 hover:text-red-500 font-medium"
                >
                  View Shipment Schedule
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Welcome back!
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Here's what's happening with your business today.
        </p>
      </div>


      {/* Modern Financial Overview */}
      <div className="space-y-8">
        {/* Financial Performance Summary - Local Clients */}
        <div className="card p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Financial Performance - Local Clients</h2>
            <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{formatFiscalYear(selectedFiscalYear)} Fiscal Year{selectedFiscalYear !== getCurrentFiscalYear() ? ' (Custom)' : ''}</div>
          </div>
          
          {/* Key Metrics Row - Order: Revenue, Pending, Advance, Receivables */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Revenue */}
            <div
              className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200 shadow-sm cursor-pointer hover:shadow-md transition"
              role="button"
              onClick={() => setExpandedMetric({ metric: 'revenue', audience: 'local' })}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-green-200 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-700" />
                </div>
                <div className="text-right">
                  <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Received</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-green-700 mb-1">Total Revenue</p>
                <p className="text-2xl font-bold text-green-900">
                  {localStats ? formatCurrency(localStats.totalRevenue || 0, 'PKR') : <Skeleton width={100} height={32} />}
                </p>
                <p className="text-xs text-green-600 mt-1">Local payments received</p>
              </div>
            </div>

            {/* Current Pending Orders Value */}
            <div
              className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 shadow-sm cursor-pointer hover:shadow-md transition"
              role="button"
              onClick={() => setExpandedMetric({ metric: 'pending', audience: 'local' })}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-200 rounded-lg">
                  <Package className="h-6 w-6 text-blue-700" />
                </div>
                <div className="text-right">
                  <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Pipeline</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-blue-700 mb-1">Current Pending Orders Value</p>
                <p className="text-2xl font-bold text-blue-900">
                  {localStats ? formatCurrency((localStats as any).currentPendingOrdersValue || localStats.totalOrderValue || 0, 'PKR') : <Skeleton width={100} height={32} />}
                </p>
                <p className="text-xs text-blue-600 mt-1">Local orders in pipeline</p>
              </div>
            </div>

            {/* Advance Payments */}
            <div
              className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200 shadow-sm cursor-pointer hover:shadow-md transition"
              role="button"
              onClick={() => setExpandedMetric({ metric: 'advance', audience: 'local' })}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-purple-200 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-purple-700" />
                </div>
                <div className="text-right">
                  <p className="text-xs text-purple-600 font-medium uppercase tracking-wide">Advance</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-purple-700 mb-1">Advance Payments</p>
                <p className="text-2xl font-bold text-purple-900">
                  {localStats ? formatCurrency(localStats.advancePayments || 0, 'PKR') : <Skeleton width={100} height={32} />}
                </p>
                <p className="text-xs text-purple-600 mt-1">Pre-shipment payments</p>
              </div>
            </div>

            {/* Receivables */}
            <div
              className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200 shadow-sm cursor-pointer hover:shadow-md transition"
              role="button"
              onClick={() => setExpandedMetric({ metric: 'receivables', audience: 'local' })}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-red-200 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-red-700" />
                </div>
                <div className="text-right">
                  <p className="text-xs text-red-600 font-medium uppercase tracking-wide">Pending</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-red-700 mb-1">Receivables</p>
                <p className="text-2xl font-bold text-red-900">
                  {localStats ? formatCurrency(localStats.outstandingAmount || 0, 'PKR') : <Skeleton width={100} height={32} />}
                </p>
                <p className="text-xs text-red-600 mt-1">Shipped awaiting payment</p>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Performance Summary - International Clients */}
        <div className="card p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Financial Performance - International Clients</h2>
            <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{formatFiscalYear(selectedFiscalYear)} Fiscal Year{selectedFiscalYear !== getCurrentFiscalYear() ? ' (Custom)' : ''}</div>
          </div>
          
          {/* Key Metrics Row - Order: Revenue, Pending, Advance, Receivables */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Revenue (USD/EUR/AED only) */}
            <div
              className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200 shadow-sm cursor-pointer hover:shadow-md transition"
              role="button"
              onClick={() => setExpandedMetric({ metric: 'revenue', audience: 'international' })}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-green-200 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-700" />
                </div>
                <div className="text-right">
                  <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Received</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-green-700 mb-1">Total Revenue</p>
                <div className="text-2xl font-bold text-green-900 space-y-1">
                  {internationalStats ? (
                    <>
                      <div className="text-lg">{formatCurrency(internationalStats.revenueByCurrency?.USD || 0, 'USD')}</div>
                      <div className="text-lg">{formatCurrency(internationalStats.revenueByCurrency?.EUR || 0, 'EUR')}</div>
                      <div className="text-lg">{formatCurrency(internationalStats.revenueByCurrency?.AED || 0, 'AED')}</div>
                      {/* USD Total removed per request */}
                    </>
                  ) : <Skeleton width={100} height={32} />}
                </div>
                <p className="text-xs text-green-600 mt-1">International payments received</p>
              </div>
            </div>

            {/* Current Pending Orders Value (USD/EUR/AED only) */}
            <div
              className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 shadow-sm cursor-pointer hover:shadow-md transition"
              role="button"
              onClick={() => setExpandedMetric({ metric: 'pending', audience: 'international' })}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-200 rounded-lg">
                  <Package className="h-6 w-6 text-blue-700" />
                </div>
                <div className="text-right">
                  <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Pipeline</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-blue-700 mb-1">Current Pending Orders Value</p>
                <div className="text-2xl font-bold text-blue-900 space-y-1">
                  {internationalStats ? (
                    <>
                      <div className="text-lg">{formatCurrency(((internationalStats as any).currentPendingValueByCurrency?.USD) || internationalStats.orderValueByCurrency?.USD || 0, 'USD')}</div>
                      <div className="text-lg">{formatCurrency(((internationalStats as any).currentPendingValueByCurrency?.EUR) || internationalStats.orderValueByCurrency?.EUR || 0, 'EUR')}</div>
                      <div className="text-lg">{formatCurrency(((internationalStats as any).currentPendingValueByCurrency?.AED) || internationalStats.orderValueByCurrency?.AED || 0, 'AED')}</div>
                      {/* USD Total removed per request */}
                    </>
                  ) : <Skeleton width={100} height={32} />}
                </div>
                <p className="text-xs text-blue-600 mt-1">International orders in pipeline</p>
              </div>
            </div>

            {/* Advance Payments */}
            <div
              className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200 shadow-sm cursor-pointer hover:shadow-md transition"
              role="button"
              onClick={() => setExpandedMetric({ metric: 'advance', audience: 'international' })}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-purple-200 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-purple-700" />
                </div>
                <div className="text-right">
                  <p className="text-xs text-purple-600 font-medium uppercase tracking-wide">Advance</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-purple-700 mb-1">Advance Payments</p>
                <div className="text-2xl font-bold text-purple-900 space-y-1">
                  {internationalStats ? (
                    <>
                      <div className="text-lg">{formatCurrency(internationalStats.advancePaymentsByCurrency?.USD || 0, 'USD')}</div>
                  
                      <div className="text-lg">{formatCurrency(internationalStats.advancePaymentsByCurrency?.EUR || 0, 'EUR')}</div>
                      <div className="text-lg">{formatCurrency(internationalStats.advancePaymentsByCurrency?.AED || 0, 'AED')}</div>
                      {/* USD Total removed per request */}
                    </>
                  ) : <Skeleton width={100} height={32} />}
                </div>
                <p className="text-xs text-purple-600 mt-1">Pre-shipment payments</p>
              </div>
            </div>

            {/* Receivables */}
            <div
              className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200 shadow-sm cursor-pointer hover:shadow-md transition"
              role="button"
              onClick={() => setExpandedMetric({ metric: 'receivables', audience: 'international' })}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-red-200 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-red-700" />
                </div>
                <div className="text-right">
                  <p className="text-xs text-red-600 font-medium uppercase tracking-wide">Pending</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-red-700 mb-1">Receivables</p>
                <div className="text-2xl font-bold text-red-900 space-y-1">
                  {internationalStats ? (
                    <>
                      <div className="text-lg">{formatCurrency(internationalStats.outstandingByCurrency?.USD || 0, 'USD')}</div>
                      <div className="text-lg">{formatCurrency(internationalStats.outstandingByCurrency?.EUR || 0, 'EUR')}</div>
                      <div className="text-lg">{formatCurrency(internationalStats.outstandingByCurrency?.AED || 0, 'AED')}</div>
                      {/* USD Total removed per request */}
                    </>
                  ) : <Skeleton width={100} height={32} />}
                </div>
                <p className="text-xs text-red-600 mt-1">Shipped awaiting payment</p>
              </div>
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        {expandedMetric && (
          <div className="card p-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {expandedMetric.metric === 'pending' && 'Current Pending Orders'}
                {expandedMetric.metric === 'advance' && 'Advance Payments'}
                {expandedMetric.metric === 'receivables' && 'Receivables'}
                {expandedMetric.metric === 'revenue' && 'Total Revenue'}
                {` — ${expandedMetric.audience === 'local' ? 'Local' : 'International'} (${formatFiscalYear(selectedFiscalYear)})`}
              </h3>
              <button
                onClick={() => setExpandedMetric(null)}
                className="text-sm text-gray-600 hover:text-gray-900 border px-3 py-1 rounded"
              >Close</button>
            </div>

            {/* Tables by metric */}
            {expandedMetric.metric === 'pending' && (
              <div className="overflow-x-auto">
                {!pendingOrdersDetails ? (
                  <Skeleton count={5} height={24} />
                ) : pendingOrdersDetails.length === 0 ? (
                  <p className="text-sm text-gray-600">No pending orders found.</p>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-gray-600">
                      <tr>
                        <th className="py-2 pr-4">Order No</th>
                        <th className="py-2 pr-4">Client</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Qty (kg)</th>
                        <th className="py-2 pr-4">Amount</th>
                        <th className="py-2 pr-4">Currency</th>
                        <th className="py-2 pr-4">Fac. Dep. Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingOrdersDetails.map((row) => (
                        <tr key={String(row.orderId)} className="border-t">
                          <td className="py-2 pr-4">{row.orderNumber}</td>
                          <td className="py-2 pr-4">{row.clientName || '—'}</td>
                          <td className="py-2 pr-4">{row.status}</td>
                          <td className="py-2 pr-4">{row.totalQuantity.toLocaleString()}</td>
                          <td className="py-2 pr-4">{formatCurrency(row.totalAmount, row.currency as any)}</td>
                          <td className="py-2 pr-4">{row.currency}</td>
                          <td className="py-2 pr-4">{row.factoryDepartureDate ? formatDateForDisplay(row.factoryDepartureDate) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {expandedMetric.metric === 'advance' && (
              <div className="overflow-x-auto">
                {!advanceDetails ? (
                  <Skeleton count={5} height={24} />
                ) : advanceDetails.length === 0 ? (
                  <p className="text-sm text-gray-600">No advance payments found.</p>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-gray-600">
                      <tr>
                        <th className="py-2 pr-4">Invoice No</th>
                        <th className="py-2 pr-4">Client</th>
                        <th className="py-2 pr-4">Order No</th>
                        <th className="py-2 pr-4">Advance Paid</th>
                        <th className="py-2 pr-4">Currency</th>
                        <th className="py-2 pr-4">Issue Date</th>
                        <th className="py-2 pr-4">Due Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {advanceDetails.map((row) => (
                        <tr key={String(row.invoiceId)} className="border-t">
                          <td className="py-2 pr-4">{row.invoiceNumber || '—'}</td>
                          <td className="py-2 pr-4">{row.clientName || '—'}</td>
                          <td className="py-2 pr-4">{row.orderNumber}</td>
                          <td className="py-2 pr-4">{formatCurrency(row.advancePaid, row.currency as any)}</td>
                          <td className="py-2 pr-4">{row.currency}</td>
                          <td className="py-2 pr-4">{new Date(row.issueDate).toLocaleDateString()}</td>
                          <td className="py-2 pr-4">{new Date(row.dueDate).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {expandedMetric.metric === 'receivables' && (
              <div className="overflow-x-auto">
                {!receivablesDetails ? (
                  <Skeleton count={5} height={24} />
                ) : receivablesDetails.length === 0 ? (
                  <p className="text-sm text-gray-600">No receivables found.</p>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-gray-600">
                      <tr>
                        <th className="py-2 pr-4">Invoice No</th>
                        <th className="py-2 pr-4">Client</th>
                        <th className="py-2 pr-4">Order No</th>
                        <th className="py-2 pr-4">Outstanding</th>
                        <th className="py-2 pr-4">Currency</th>
                        <th className="py-2 pr-4">Issue Date</th>
                        <th className="py-2 pr-4">Due Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receivablesDetails.map((row) => (
                        <tr key={String(row.invoiceId)} className="border-t">
                          <td className="py-2 pr-4">{row.invoiceNumber || '—'}</td>
                          <td className="py-2 pr-4">{row.clientName || '—'}</td>
                          <td className="py-2 pr-4">{row.orderNumber}</td>
                          <td className="py-2 pr-4">{formatCurrency(row.outstandingBalance, row.currency as any)}</td>
                          <td className="py-2 pr-4">{row.currency}</td>
                          <td className="py-2 pr-4">{new Date(row.issueDate).toLocaleDateString()}</td>
                          <td className="py-2 pr-4">{new Date(row.dueDate).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {expandedMetric.metric === 'revenue' && (
              <div className="overflow-x-auto">
                {!revenueDetails ? (
                  <Skeleton count={5} height={24} />
                ) : revenueDetails.length === 0 ? (
                  <p className="text-sm text-gray-600">No revenue payments found.</p>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-gray-600">
                      <tr>
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 pr-4">Client</th>
                        <th className="py-2 pr-4">Invoice No</th>
                        <th className="py-2 pr-4">Amount</th>
                        <th className="py-2 pr-4">Currency</th>
                        <th className="py-2 pr-4">Method</th>
                        <th className="py-2 pr-4">Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenueDetails.map((row) => (
                        <tr key={String(row.paymentId)} className="border-t">
                          <td className="py-2 pr-4">{new Date(row.paymentDate).toLocaleDateString()}</td>
                          <td className="py-2 pr-4">{row.clientName || '—'}</td>
                          <td className="py-2 pr-4">{row.invoiceNumber || '—'}</td>
                          <td className="py-2 pr-4">{formatCurrency(row.amount, row.currency as any)}</td>
                          <td className="py-2 pr-4">{row.currency}</td>
                          <td className="py-2 pr-4">{row.method}</td>
                          <td className="py-2 pr-4">{row.reference}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Orders by Status */}
      <div className="mt-12">
        <div className="space-y-6">
        {/* Pending Orders */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Pending Orders</h3>
            <Clock className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            {!ordersData ? (
              <div className="space-y-4">
                <Skeleton count={5} height={120} />
              </div>
            ) : ordersData.pendingOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No pending orders</p>
              </div>
            ) : (
              <div className="space-y-4">
                {ordersData.pendingOrders.map((order) => (
                  <div key={order._id} className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-orange-600 font-medium mb-1">Invoice Number</p>
                        <p className="text-orange-800 font-semibold">{order.invoiceNumber}</p>
                      </div>
                      <div>
                        <p className="text-orange-600 font-medium mb-1">Quantity</p>
                        <p className="text-orange-800 font-semibold">{order.totalQuantity.toLocaleString()} kg</p>
                      </div>
                      <div>
                        <p className="text-orange-600 font-medium mb-1">Customer Name</p>
                        <p className="text-orange-800 font-semibold">{order.clientName}</p>
                      </div>
                      <div>
                        <p className="text-orange-600 font-medium mb-1">Fac. Dep. Date</p>
                        <p className="text-orange-800 font-semibold">
                          {formatDateForDisplay(order.factoryDepartureDate)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* In Production Orders */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">In Production</h3>
            <Package className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            {!ordersData ? (
              <div className="space-y-4">
                <Skeleton count={5} height={120} />
              </div>
            ) : ordersData.inProductionOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No orders in production</p>
              </div>
            ) : (
              <div className="space-y-4">
                {ordersData.inProductionOrders.map((order) => (
                  <div key={order._id} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-blue-600 font-medium mb-1">Invoice Number</p>
                        <p className="text-blue-800 font-semibold">{order.invoiceNumber}</p>
                      </div>
                      <div>
                        <p className="text-blue-600 font-medium mb-1">Quantity</p>
                        <p className="text-blue-800 font-semibold">{order.totalQuantity.toLocaleString()} kg</p>
                      </div>
                      <div>
                        <p className="text-blue-600 font-medium mb-1">Customer Name</p>
                        <p className="text-blue-800 font-semibold">{order.clientName}</p>
                      </div>
                      <div>
                        <p className="text-blue-600 font-medium mb-1">Fac. Dep. Date</p>
                        <p className="text-blue-800 font-semibold">
                          {formatDateForDisplay(order.factoryDepartureDate)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Shipped Orders */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Shipped Orders</h3>
            <TrendingUp className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            {!ordersData ? (
              <div className="space-y-4">
                <Skeleton count={5} height={120} />
              </div>
            ) : ordersData.shippedOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No shipped orders</p>
              </div>
            ) : (
              <div className="space-y-4">
                {ordersData.shippedOrders.map((order) => (
                  <div key={order._id} className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-purple-600 font-medium mb-1">Invoice Number</p>
                        <p className="text-purple-800 font-semibold">{order.invoiceNumber}</p>
                      </div>
                      <div>
                        <p className="text-purple-600 font-medium mb-1">Quantity</p>
                        <p className="text-purple-800 font-semibold">{order.totalQuantity.toLocaleString()} kg</p>
                      </div>
                      <div>
                        <p className="text-purple-600 font-medium mb-1">Customer Name</p>
                        <p className="text-purple-800 font-semibold">{order.clientName}</p>
                      </div>
                      <div>
                        <p className="text-purple-600 font-medium mb-1">Fac. Dep. Date</p>
                        <p className="text-purple-800 font-semibold">
                          {formatDateForDisplay(order.factoryDepartureDate)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Delivered Orders */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Delivered Orders</h3>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </div>
          <div>
            {!ordersData ? (
              <div className="space-y-4">
                <Skeleton count={5} height={120} />
              </div>
            ) : ordersData.deliveredOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No delivered orders</p>
              </div>
            ) : (
              <div className="space-y-4">
                {ordersData.deliveredOrders.map((order) => (
                  <div key={order._id} className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-green-600 font-medium mb-1">Invoice Number</p>
                        <p className="text-green-800 font-semibold">{order.invoiceNumber}</p>
                      </div>
                      <div>
                        <p className="text-green-600 font-medium mb-1">Quantity</p>
                        <p className="text-green-800 font-semibold">{order.totalQuantity.toLocaleString()} kg</p>
                      </div>
                      <div>
                        <p className="text-green-600 font-medium mb-1">Customer Name</p>
                        <p className="text-green-800 font-semibold">{order.clientName}</p>
                      </div>
                      <div>
                        <p className="text-green-600 font-medium mb-1">Fac. Dep. Date</p>
                        <p className="text-green-800 font-semibold">
                          {formatDateForDisplay(order.factoryDepartureDate)}
                        </p>
                      </div>
                    </div>
                    {order.deliveryDate && (
                      <div className="mt-3 pt-3 border-t border-green-200">
                        <p className="text-xs text-green-600">
                          <strong>Delivered:</strong> {new Date(order.deliveryDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Add Client Modal */}
      <AddCustomerModal
        isOpen={isAddClientOpen}
        onClose={() => setIsAddClientOpen(false)}
        type={clientType}
      />

      {/* Create Order Modal */}
      <CreateOrderModal
        isOpen={isCreateOrderOpen}
        onClose={() => setIsCreateOrderOpen(false)}
        onSuccess={() => {
          setIsCreateOrderOpen(false);
          toast.success("Order created successfully");
          router.push("/orders");
        }}
      />
    </div>
  );
}
