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
import { getCurrentFiscalYear, getFiscalYearForDate } from "@/app/utils/fiscalYear";

export default function DashboardPage() {
  console.log("DashboardPage rendering...");
  const router = useRouter();
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
  const [clientType, setClientType] = useState<"local" | "international">("local");
  const [monthlyLimit, setMonthlyLimit] = useState<number>(150000);

  // Fetch real data from Convex
  const dashboardStats = useQuery(api.dashboard.getStats);
  const orders = useQuery(api.orders.list, {});
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
        if (order.orderCreationDate) {
          const orderDate = new Date(order.orderCreationDate);
          const orderFiscalYear = getFiscalYearForDate(orderDate);
          const orderMonth = orderDate.getMonth();
          const orderFiscalMonthIndex = orderMonth >= 6 ? orderMonth - 6 : orderMonth + 6;
          const orderFiscalMonth = fiscalMonths[orderFiscalMonthIndex];
          
          if (orderFiscalYear === fiscalYear && orderFiscalMonth === fiscalMonth) {
            const items = orderItems.filter(item => item.orderId === order._id);
            items.forEach(item => {
              totalQuantity += item.quantityKg;
            });
          }
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

  // Format currency
  const formatCurrency = (amount: number, currency: string = 'USD') => {
    // Use appropriate locale based on currency
    const locale = currency === 'USD' ? 'en-US' : 
                   currency === 'PKR' ? 'en-PK' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Create stats array with real data and improved financial metrics
  const stats = dashboardStats ? [
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
      subtitle: `Total Orders: ${dashboardStats.totalOrders?.value?.toString() || "0"}`,
    },
    {
      name: "Order Value (USD)",
      value: formatCurrency((dashboardStats as any).totalOrderValueUSD ?? 0, 'USD'),
      icon: Package,
      color: "text-gray-600",
      bgColor: "bg-gray-100",
      subtitle: "Total value of all orders",
    },
    {
      name: "Order Value (PKR)",
      value: formatCurrency((dashboardStats as any).totalOrderValuePKR ?? 0, 'PKR'),
      icon: Package,
      color: "text-gray-600",
      bgColor: "bg-gray-100",
      subtitle: "Total value of all orders",
    },
    {
      name: "Revenue (USD)",
      value: formatCurrency((dashboardStats as any).revenueUSD ?? 0, 'USD'),
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-100",
      subtitle: "Total payments received",
    },
    {
      name: "Revenue (PKR)",
      value: formatCurrency((dashboardStats as any).revenuePKR ?? 0, 'PKR'),
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-100",
      subtitle: "Total payments received",
    },
    {
      name: "Advance Payments (USD)",
      value: formatCurrency((dashboardStats as any).advancePaymentsUSD ?? 0, 'USD'),
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      subtitle: "Pre-shipment payments",
    },
    {
      name: "Advance Payments (PKR)",
      value: formatCurrency((dashboardStats as any).advancePaymentsPKR ?? 0, 'PKR'),
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      subtitle: "Pre-shipment payments",
    },
    {
      name: "Outstanding (USD)",
      value: formatCurrency((dashboardStats as any).outstandingUSD ?? 0, 'USD'),
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-100",
      subtitle: "Shipped orders awaiting payment",
    },
    {
      name: "Outstanding (PKR)",
      value: formatCurrency((dashboardStats as any).outstandingPKR ?? 0, 'PKR'),
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-100",
      subtitle: "Shipped orders awaiting payment",
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

      {/* International & Local Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {/* International */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">International</h3>
          {!dashboardStats ? (
            <Skeleton height={120} />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <p className="text-sm text-gray-500">Clients</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{dashboardStats.internationalClients}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Active Orders</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{dashboardStats.internationalOrders}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Revenue (USD)</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{formatCurrency((dashboardStats as any).revenueUSD ?? 0, 'USD')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Outstanding</p>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  {(dashboardStats as any).outstandingByCurrency ? 
                    Object.entries((dashboardStats as any).outstandingByCurrency)
                      .filter(([currency, amount]) => (amount as number) > 0 && currency !== 'PKR')
                      .map(([currency, amount]) => (
                        <div key={currency} className="text-lg">
                          {formatCurrency(amount as number, currency)}
                        </div>
                      ))
                    : formatCurrency((dashboardStats as any).outstandingUSD ?? 0, 'USD')
                  }
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Local */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Local</h3>
          {!dashboardStats ? (
            <Skeleton height={120} />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <p className="text-sm text-gray-500">Clients</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{dashboardStats.localClients}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Active Orders</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{dashboardStats.localOrders}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Revenue (PKR)</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{formatCurrency((dashboardStats as any).revenuePKR ?? 0, 'PKR')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Outstanding</p>
                <div className="text-2xl font-bold text-gray-900 mt-1">
                  {(dashboardStats as any).outstandingByCurrency ? 
                    Object.entries((dashboardStats as any).outstandingByCurrency)
                      .filter(([currency, amount]) => (amount as number) > 0 && currency === 'PKR')
                      .map(([currency, amount]) => (
                        <div key={currency} className="text-lg">
                          {formatCurrency(amount as number, currency)}
                        </div>
                      ))
                    : formatCurrency((dashboardStats as any).outstandingPKR ?? 0, 'PKR')
                  }
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modern Financial Overview */}
      <div className="space-y-8">
        {/* Financial Performance Summary */}
        <div className="card p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Financial Performance</h2>
            <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">Current Fiscal Year</div>
          </div>
          
          {/* Key Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Order Value */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-200 rounded-lg">
                  <Package className="h-6 w-6 text-blue-700" />
                </div>
                <div className="text-right">
                  <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Pipeline</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-blue-700 mb-1">Total Order Value</p>
                <p className="text-2xl font-bold text-blue-900">
                  {dashboardStats ? formatCurrency(((dashboardStats as any).totalOrderValueUSD || 0) + ((dashboardStats as any).totalOrderValuePKR || 0), 'USD') : <Skeleton width={100} height={32} />}
                </p>
                <p className="text-xs text-blue-600 mt-1">All orders in pipeline</p>
              </div>
            </div>

            {/* Revenue */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200 shadow-sm">
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
                  {dashboardStats ? formatCurrency(((dashboardStats as any).revenueUSD || 0) + ((dashboardStats as any).revenuePKR || 0), 'USD') : <Skeleton width={100} height={32} />}
                </p>
                <p className="text-xs text-green-600 mt-1">All payments received</p>
              </div>
            </div>

            {/* Advance Payments */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200 shadow-sm">
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
                  {dashboardStats ? formatCurrency(((dashboardStats as any).advancePaymentsUSD || 0) + ((dashboardStats as any).advancePaymentsPKR || 0), 'USD') : <Skeleton width={100} height={32} />}
                </p>
                <p className="text-xs text-purple-600 mt-1">Pre-shipment payments</p>
              </div>
            </div>

            {/* Outstanding */}
            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-red-200 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-red-700" />
                </div>
                <div className="text-right">
                  <p className="text-xs text-red-600 font-medium uppercase tracking-wide">Pending</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-red-700 mb-1">Outstanding</p>
                <p className="text-2xl font-bold text-red-900">
                  {dashboardStats ? formatCurrency(((dashboardStats as any).outstandingUSD || 0) + ((dashboardStats as any).outstandingPKR || 0), 'USD') : <Skeleton width={100} height={32} />}
                </p>
                <p className="text-xs text-red-600 mt-1">Shipped awaiting payment</p>
              </div>
            </div>
          </div>
        </div>

        {/* Business Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Status Distribution */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Order Status</h3>
              <Package className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              {dashboardStats ? (
                <>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Active Orders</span>
                    <span className="text-lg font-bold text-blue-600">{(dashboardStats as any).activeOrders?.value || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Total Orders</span>
                    <span className="text-lg font-bold text-gray-900">{(dashboardStats as any).totalOrders?.value || 0}</span>
                  </div>
                </>
              ) : (
                <Skeleton count={2} height={48} />
              )}
            </div>
          </div>

          {/* Client Overview */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Client Base</h3>
              <Users className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              {dashboardStats ? (
                <>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium text-blue-700">Local Clients</span>
                    <span className="text-lg font-bold text-blue-600">{(dashboardStats as any).localClients || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="text-sm font-medium text-green-700">International</span>
                    <span className="text-lg font-bold text-green-600">{(dashboardStats as any).internationalClients || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Active Total</span>
                    <span className="text-lg font-bold text-gray-900">{(dashboardStats as any).activeClients || 0}</span>
                  </div>
                </>
              ) : (
                <Skeleton count={3} height={48} />
              )}
            </div>
          </div>

          {/* Payment Health */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Payment Health</h3>
              <CheckCircle className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              {dashboardStats ? (
                <>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="text-sm font-medium text-green-700">Collection Rate</span>
                    <span className="text-lg font-bold text-green-600">
                      {((dashboardStats as any).totalPaid / Math.max((dashboardStats as any).totalRevenue, 1) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <span className="text-sm font-medium text-red-700">Outstanding Ratio</span>
                    <span className="text-lg font-bold text-red-600">
                      {(((dashboardStats as any).outstandingUSD + (dashboardStats as any).outstandingPKR) / Math.max((dashboardStats as any).totalRevenue, 1) * 100).toFixed(1)}%
                    </span>
                  </div>
                </>
              ) : (
                <Skeleton count={2} height={48} />
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