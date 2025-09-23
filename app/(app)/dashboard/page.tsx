"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { 
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
import { getUsdRates, toUSD, type UsdRates } from "@/app/utils/fx";
import { formatCurrency, type SupportedCurrency } from "@/app/utils/currencyFormat";
import { shouldHighlightOrderRed, shouldHighlightOrderYellowWithTransfers } from "@/app/utils/orderHighlighting";
import OrderDetailModal from "@/app/components/orders/OrderDetailModal";
import { Id } from "@/convex/_generated/dataModel";

export default function DashboardPage() {
  console.log("DashboardPage rendering...");
  const router = useRouter();
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<Id<"orders"> | null>(null);
  const [clientType] = useState<"local" | "international">("local");
  const [monthlyLimit, setMonthlyLimit] = useState<number>(150000);
  const [expandedMetric, setExpandedMetric] = useState<null | { metric: 'revenue' | 'pending' | 'advance' | 'receivables'; audience: 'local' | 'international' }>(null);
  const [showUsdView, setShowUsdView] = useState(false);

  // Get dashboard order limit from localStorage
  const [dashboardOrderLimit, setDashboardOrderLimit] = useState<number>(5);
  // Always use current fiscal year for dashboard totals
  const currentFiscalYear = getCurrentFiscalYear();
  
  // Fetch real data from Convex
  // const dashboardStats = useQuery(api.dashboard.getStats, { fiscalYear: currentFiscalYear });
  const ordersData = useQuery(api.orders.list, {}); // Orders are rolling, no fiscal year filter
  
  // Extract orders array (handle both paginated and non-paginated responses)
  const orders = Array.isArray(ordersData) ? ordersData : ordersData?.page || [];
  const orderItems = useQuery(api.orders.listItems, {});
  const monthlyLimitFromDB = useQuery(api.migrations.getMonthlyShipmentLimit, {});
  
  // Fetch bank accounts and transfer status for red order highlighting
  const bankAccounts = useQuery(api.banks.list, {});
  const invoiceIds = orders
    .filter((order: any) => order.invoice?._id)
    .map((order: any) => order.invoice!._id);
  const batchTransferStatus = useQuery(api.interBankTransfers.getBatchTransferStatus, 
    invoiceIds.length > 0 ? { invoiceIds } : "skip");
  
  // Fetch client-specific stats for accurate local/international breakdown
  const localStats = useQuery(api.clients.getStats, { type: "local", fiscalYear: currentFiscalYear });
  const internationalStats = useQuery(api.clients.getStats, { type: "international", fiscalYear: currentFiscalYear });
  const [usdRates, setUsdRates] = useState<UsdRates>({ USD: 1, EUR: 0.93, AED: 0.2723 });
  // USD total and info toggles removed per request
  useEffect(() => {
    const ac = new AbortController();
    const fetchRates = () => {
      getUsdRates(ac.signal)
        .then((rates) => {
          console.log('Fetched USD rates:', rates);
          setUsdRates(rates);
        })
        .catch((error) => {
          console.error('Failed to fetch USD rates:', error);
        });
    };
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

  // Close modal on Escape and prevent body scroll
  useEffect(() => {
    if (!expandedMetric) {
      setShowUsdView(false); // Reset USD view when modal closes
      return;
    }
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedMetric(null);
    };
    window.addEventListener('keydown', onKey);
    
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', onKey);
    };
  }, [expandedMetric]);
  
  useEffect(() => {
    const saved = localStorage.getItem('dashboardOrderLimit');
    if (saved) {
      setDashboardOrderLimit(parseInt(saved));
    }
  }, []);

  // Fetch orders by status - use rolling data (no fiscal year filter for orders)
  const ordersByStatusData = useQuery(api.dashboard.getOrdersByStatus, { limit: dashboardOrderLimit });

  // Detail queries (lazy-loaded when a metric is expanded)
  const receivablesDetails = useQuery(
    api.dashboard.getReceivablesDetails,
    expandedMetric && expandedMetric.metric === 'receivables'
      ? { type: expandedMetric.audience } // Rolling - no fiscal year filter
      : 'skip'
  );
  const advanceDetails = useQuery(
    api.dashboard.getAdvancePaymentsDetails,
    expandedMetric && expandedMetric.metric === 'advance'
      ? { type: expandedMetric.audience } // Rolling - no fiscal year filter
      : 'skip'
  );
  const revenueDetails = useQuery(
    api.dashboard.getRevenueDetails,
    expandedMetric && expandedMetric.metric === 'revenue'
      ? { fiscalYear: currentFiscalYear, type: expandedMetric.audience }
      : 'skip'
  );
  const pendingOrdersDetails = useQuery(
    api.dashboard.getPendingOrdersDetails,
    expandedMetric && expandedMetric.metric === 'pending'
      ? { type: expandedMetric.audience } // Rolling - no fiscal year filter
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
  
  // Identify red orders (20+ days past factory departure, no 70% transfer)
  const redOrders = orders.filter((order: any) => {
    const bankAccount = bankAccounts?.find(bank => bank._id === order.bankAccountId);
    const transferStatus = order.invoice?._id ? batchTransferStatus?.[order.invoice._id] : undefined;
    return shouldHighlightOrderRed(order, bankAccount, transferStatus);
  });

  // Helper function to get client currency
  // const getClientCurrency = (clientType: string): SupportedCurrency => {
  //   return getCurrencyForClientType(clientType as 'local' | 'international', 'USD');
  // };

  // Helper function to convert to USD
  const convertToUsd = (amount: number, currency: string) => {
    return toUSD(amount, currency as keyof UsdRates, usdRates);
  };

  // Create stats array with real data - simplified since we now have separate financial sections
  // const stats = dashboardStats && localStats && internationalStats ? [
  //   {
  //     name: "Total Clients",
  //     value: dashboardStats.totalClients.value.toString(),
  //     icon: Users,
  //     color: "text-blue-600",
  //     bgColor: "bg-blue-100",
  //   },
  //   {
  //     name: "Active Orders",
  //     value: dashboardStats.activeOrders.value.toString(),
  //     icon: Package,
  //     color: "text-green-600",
  //     bgColor: "bg-green-100",
  //     subtitle: `Total Orders: ${(localStats.totalOrders + internationalStats.totalOrders).toString()}`,
  //   },
  //   {
  //     name: "Local Clients",
  //     value: dashboardStats.localClients.toString(),
  //     icon: Users,
  //     color: "text-blue-600",
  //     bgColor: "bg-blue-100",
  //     subtitle: `Active Orders: ${localStats.activeOrders}`,
  //   },
  //   {
  //     name: "International Clients",
  //     value: dashboardStats.internationalClients.toString(),
  //     icon: Users,
  //     color: "text-green-600",
  //     bgColor: "bg-green-100",
  //     subtitle: `Active Orders: ${internationalStats.activeOrders}`,
  //   },
  // ] : [];


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
                {monthsData.filter(month => month.exceedsLimit).map((month) => (
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

      {/* Red Orders Alert - Payment Compliance Notice */}
      {redOrders.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">
                Urgent: Payment Orders Requiring Pakistan Transfer Compliance
              </h3>
              <p className="mt-1 text-sm text-red-700">
                {redOrders.length} order{redOrders.length > 1 ? 's' : ''} have exceeded the 20-day limit and still need 70% transfer to Pakistani banks for government compliance.
              </p>
              
              {/* Red Orders List */}
              <div className="mt-3">
                <div className="text-sm font-medium text-red-800 mb-2">Orders requiring immediate attention:</div>
                <div className="space-y-1">
                  {redOrders.slice(0, 5).map((order: any) => {
                    const daysSinceDeparture = order.factoryDepartureDate ? 
                      Math.floor((new Date().getTime() - new Date(order.factoryDepartureDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                    
                    return (
                      <div 
                        key={order._id}
                        className="flex items-center justify-between p-2 bg-red-100 rounded-md cursor-pointer hover:bg-red-200 transition-colors"
                        onClick={() => setSelectedOrderId(order._id)}
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-red-900">
                            {order.invoiceNumber} - {order.client?.name || "Unknown Client"}
                          </div>
                          <div className="text-xs text-red-700">
                            {daysSinceDeparture} days since factory departure • {formatCurrency(order.items?.reduce((total: number, item: any) => total + ((item.quantityKg || 0) * (item.pricePerKg || 0)), 0) || 0, order.currency as SupportedCurrency)}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-red-600 ml-2" />
                      </div>
                    );
                  })}
                </div>
                
                {redOrders.length > 5 && (
                  <div className="mt-2 text-xs text-red-600">
                    +{redOrders.length - 5} more orders requiring attention
                  </div>
                )}
                
                <div className="mt-3 flex space-x-3">
                  <button
                    onClick={() => router.push('/orders')}
                    className="inline-flex items-center text-sm text-red-600 hover:text-red-500 font-medium"
                  >
                    View All Orders
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </button>
                  <button
                    onClick={() => router.push('/finance')}
                    className="inline-flex items-center text-sm text-red-600 hover:text-red-500 font-medium"
                  >
                    Manage Transfers
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </button>
                </div>
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
          Here&apos;s what&apos;s happening with your business today.
        </p>
      </div>


      {/* Modern Financial Overview */}
      <div className="space-y-8">
        {/* Financial Performance Summary - Local Clients */}
        <div className="card p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Financial Performance - Local Clients</h2>
            <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{formatFiscalYear(currentFiscalYear)} Fiscal Year</div>
          </div>
          
          {/* Key Metrics Row - Order: Revenue, Pending, Advance, Receivables */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
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
                  {localStats ? formatCurrency((localStats as Record<string, unknown>).currentPendingOrdersValue as number || localStats.totalOrderValue || 0, 'PKR') : <Skeleton width={100} height={32} />}
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
            <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{formatFiscalYear(currentFiscalYear)} Fiscal Year</div>
          </div>
          
          {/* Key Metrics Row - Order: Revenue, Pending, Advance, Receivables */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
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
                      <div className="text-lg">{formatCurrency(((internationalStats as Record<string, unknown>).currentPendingValueByCurrency as Record<string, number>)?.USD || internationalStats.orderValueByCurrency?.USD || 0, 'USD')}</div>
                      <div className="text-lg">{formatCurrency(((internationalStats as Record<string, unknown>).currentPendingValueByCurrency as Record<string, number>)?.EUR || internationalStats.orderValueByCurrency?.EUR || 0, 'EUR')}</div>
                      <div className="text-lg">{formatCurrency(((internationalStats as Record<string, unknown>).currentPendingValueByCurrency as Record<string, number>)?.AED || internationalStats.orderValueByCurrency?.AED || 0, 'AED')}</div>
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

        {/* Modal for Details */}
        {expandedMetric && createPortal((
          <div 
            className="fixed z-[60] flex items-start justify-center pt-4" 
            style={{ 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0,
              width: '100vw', 
              height: '100vh' 
            }}
          >
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
              onClick={() => setExpandedMetric(null)} 
            />
            <div 
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[calc(100vh-2rem)] mx-2 sm:mx-4 overflow-hidden border border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">
                      {expandedMetric.metric === 'pending' && 'Current Pending Orders'}
                      {expandedMetric.metric === 'advance' && 'Advance Payments'}
                      {expandedMetric.metric === 'receivables' && 'Receivables'}
                      {expandedMetric.metric === 'revenue' && 'Total Revenue'}
                    </h2>
                    <p className="text-sm text-gray-600">
                      {expandedMetric.audience === 'local' ? 'Local' : 'International'} Clients • {formatFiscalYear(currentFiscalYear)} Fiscal Year
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {expandedMetric.audience === 'international' && (
                      <button
                        onClick={() => setShowUsdView(!showUsdView)}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        {showUsdView ? 'Back to original view' : 'See total in dollars'}
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedMetric(null)}
                      className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full p-2 transition-colors"
                      aria-label="Close"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-auto h-[calc(100vh-2rem-80px)] bg-gray-50">
                {expandedMetric.metric === 'pending' && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {!pendingOrdersDetails ? (
                      <div className="p-8">
                        <Skeleton count={5} height={48} />
                      </div>
                    ) : pendingOrdersDetails.length === 0 ? (
                      <div className="p-8 text-center">
                        <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-600">No pending orders found.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice No</th>
                              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty (kg)</th>
                              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {showUsdView ? 'Amount (USD)' : 'Amount'}
                              </th>
                              {!showUsdView && <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</th>}
                              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fac. Dep. Date</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                             {pendingOrdersDetails.map((row: any) => (
                              <tr key={String(row.orderId)} className="hover:bg-gray-50 transition-colors">
                                <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.invoiceNumber || '—'}</td>
                                <td className="px-3 sm:px-6 py-4 text-sm text-gray-900 max-w-[150px] truncate" title={row.clientName || '—'}>{row.clientName || '—'}</td>
                                <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    row.status === 'pending' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {row.status}
                                  </span>
                                </td>
                                <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.totalQuantity.toLocaleString()}</td>
                                <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {showUsdView ? formatCurrency(row.totalAmountUSD || convertToUsd(row.totalAmount, row.currency), 'USD') : formatCurrency(row.totalAmount, row.currency as SupportedCurrency)}
                                </td>
                                {!showUsdView && <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.currency}</td>}
                                <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.factoryDepartureDate ? formatDateForDisplay(row.factoryDepartureDate) : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {showUsdView && (
                          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-700">Total USD:</span>
                              <span className="text-lg font-bold text-gray-900">
                                {formatCurrency(
                                  pendingOrdersDetails.reduce((sum: number, row: any) => sum + (row.totalAmountUSD || convertToUsd(row.totalAmount, row.currency)), 0),
                                  'USD'
                                )}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {expandedMetric.metric === 'advance' && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {!advanceDetails ? (
                      <div className="p-8">
                        <Skeleton count={5} height={48} />
                      </div>
                    ) : advanceDetails.length === 0 ? (
                      <div className="p-8 text-center">
                        <TrendingUp className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-600">No advance payments found.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice No</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice No</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {showUsdView ? 'Advance Paid (USD)' : 'Advance Paid'}
                              </th>
                              {!showUsdView && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</th>}
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue Date</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {advanceDetails.map((row: any) => (
                              <tr key={String(row.invoiceId)} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.invoiceNumber || '—'}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 max-w-[150px] truncate" title={row.clientName || '—'}>{row.clientName || '—'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.invoiceNumber || '—'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                                  {showUsdView ? formatCurrency(row.advancePaidUSD || convertToUsd(row.advancePaid, row.currency), 'USD') : formatCurrency(row.advancePaid, row.currency as SupportedCurrency)}
                                </td>
                                {!showUsdView && <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.currency}</td>}
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(row.issueDate).toLocaleDateString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(row.dueDate).toLocaleDateString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {showUsdView && (
                          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-700">Total USD:</span>
                              <span className="text-lg font-bold text-gray-900">
                                {formatCurrency(
                                  advanceDetails.reduce((sum: number, row: any) => sum + (row.advancePaidUSD || convertToUsd(row.advancePaid, row.currency)), 0),
                                  'USD'
                                )}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {expandedMetric.metric === 'receivables' && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {!receivablesDetails ? (
                      <div className="p-8">
                        <Skeleton count={5} height={48} />
                      </div>
                    ) : receivablesDetails.length === 0 ? (
                      <div className="p-8 text-center">
                        <AlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-600">No receivables found.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice No</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice No</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {showUsdView ? 'Outstanding (USD)' : 'Outstanding'}
                              </th>
                              {!showUsdView && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</th>}
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue Date</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {receivablesDetails.map((row: any) => (
                              <tr key={String(row.invoiceId)} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.invoiceNumber || '—'}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 max-w-[150px] truncate" title={row.clientName || '—'}>{row.clientName || '—'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.invoiceNumber || '—'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                                  {showUsdView ? formatCurrency(row.outstandingBalanceUSD || convertToUsd(row.outstandingBalance, row.currency), 'USD') : formatCurrency(row.outstandingBalance, row.currency as SupportedCurrency)}
                                </td>
                                {!showUsdView && <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.currency}</td>}
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(row.issueDate).toLocaleDateString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(row.dueDate).toLocaleDateString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {showUsdView && (
                          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-700">Total USD:</span>
                              <span className="text-lg font-bold text-gray-900">
                                {formatCurrency(
                                  receivablesDetails.reduce((sum: number, row: any) => sum + (row.outstandingBalanceUSD || convertToUsd(row.outstandingBalance, row.currency)), 0),
                                  'USD'
                                )}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {expandedMetric.metric === 'revenue' && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {!revenueDetails ? (
                      <div className="p-8">
                        <Skeleton count={5} height={48} />
                      </div>
                    ) : revenueDetails.length === 0 ? (
                      <div className="p-8 text-center">
                        <DollarSign className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-600">No revenue payments found.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice No</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {showUsdView ? 'Amount (USD)' : 'Amount'}
                              </th>
                              {!showUsdView && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</th>}
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {revenueDetails.map((row: any) => (
                              <tr key={String(row.paymentId)} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(row.paymentDate).toLocaleDateString()}</td>
                                <td className="px-6 py-4 text-sm text-gray-900 max-w-[150px] truncate" title={row.clientName || '—'}>{row.clientName || '—'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.invoiceNumber || '—'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                                  {showUsdView ? formatCurrency(row.amountUSD || convertToUsd(row.amount, row.currency), 'USD') : formatCurrency(row.amount, row.currency as SupportedCurrency)}
                                </td>
                                {!showUsdView && <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.currency}</td>}
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.method}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.reference}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {showUsdView && (
                          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-700">Total USD:</span>
                              <span className="text-lg font-bold text-gray-900">
                                {formatCurrency(
                                  revenueDetails.reduce((sum: number, row: any) => sum + (row.amountUSD || convertToUsd(row.amount, row.currency)), 0),
                                  'USD'
                                )}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ), document.body)}

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
            {!ordersByStatusData ? (
              <div className="space-y-4">
                <Skeleton count={5} height={120} />
              </div>
            ) : ordersByStatusData.pendingOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No pending orders</p>
              </div>
            ) : (
              <div className="space-y-4">
                {ordersByStatusData.pendingOrders.map((order) => (
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
                      <div className="min-w-0 flex-1">
                        <p className="text-orange-600 font-medium mb-1">Customer Name</p>
                        <p className="text-orange-800 font-semibold truncate" title={order.clientName}>{order.clientName}</p>
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
            {!ordersByStatusData ? (
              <div className="space-y-4">
                <Skeleton count={5} height={120} />
              </div>
            ) : ordersByStatusData.inProductionOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No orders in production</p>
              </div>
            ) : (
              <div className="space-y-4">
                {ordersByStatusData.inProductionOrders.map((order) => (
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
                      <div className="min-w-0 flex-1">
                        <p className="text-blue-600 font-medium mb-1">Customer Name</p>
                        <p className="text-blue-800 font-semibold truncate" title={order.clientName}>{order.clientName}</p>
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
            {!ordersByStatusData ? (
              <div className="space-y-4">
                <Skeleton count={5} height={120} />
              </div>
            ) : ordersByStatusData.shippedOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No shipped orders</p>
              </div>
            ) : (
              <div className="space-y-4">
                {ordersByStatusData.shippedOrders.map((order) => (
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
                      <div className="min-w-0 flex-1">
                        <p className="text-purple-600 font-medium mb-1">Customer Name</p>
                        <p className="text-purple-800 font-semibold truncate" title={order.clientName}>{order.clientName}</p>
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
            {!ordersByStatusData ? (
              <div className="space-y-4">
                <Skeleton count={5} height={120} />
              </div>
            ) : ordersByStatusData.deliveredOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No delivered orders</p>
              </div>
            ) : (
              <div className="space-y-4">
                {ordersByStatusData.deliveredOrders.map((order) => (
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
                      <div className="min-w-0 flex-1">
                        <p className="text-green-600 font-medium mb-1">Customer Name</p>
                        <p className="text-green-800 font-semibold truncate" title={order.clientName}>{order.clientName}</p>
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

      {/* Order Detail Modal */}
      <OrderDetailModal
        orderId={selectedOrderId}
        isOpen={!!selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
      />
    </div>
  );
}
