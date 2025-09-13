"use client";

import { useState } from "react";
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

  // Fetch real data from Convex
  const dashboardStats = useQuery(api.dashboard.getStats);
  const recentOrdersData = useQuery(api.dashboard.getRecentOrders, { limit: 5 });
  const recentActivity = useQuery(api.dashboard.getRecentActivity, { limit: 5 });
  const monthlyLimit = useQuery(api.settings.getMonthlyShipmentLimit, {});
  const orders = useQuery(api.orders.list, {});
  const orderItems = useQuery(api.orders.listItems, {});

  console.log("Dashboard data:", { dashboardStats, recentOrdersData, recentActivity });

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

  // Create stats array with real data
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
      name: "Revenue (USD)",
      value: formatCurrency((dashboardStats as any).revenueUSD ?? 0, 'USD'),
      icon: DollarSign,
      color: "text-primary",
      bgColor: "bg-orange-100",
    },
    {
      name: "Revenue (PKR)",
      value: formatCurrency((dashboardStats as any).revenuePKR ?? 0, 'PKR'),
      icon: DollarSign,
      color: "text-primary",
      bgColor: "bg-orange-100",
    },
    {
      name: "Outstanding (USD)",
      value: formatCurrency((dashboardStats as any).outstandingUSD ?? 0, 'USD'),
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      name: "Outstanding (PKR)",
      value: formatCurrency((dashboardStats as any).outstandingPKR ?? 0, 'PKR'),
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
  ] : [];

  // Format recent orders data
  const recentOrders = recentOrdersData ? recentOrdersData.map(order => ({
    id: order.orderNumber,
    client: order.client?.name || "Unknown Client",
    amount: formatCurrency(order.totalAmount, order.currency),
    status: order.status,
    date: new Date(order.createdAt).toLocaleDateString(),
  })) : [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "in_production":
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
      case "shipped":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    return status.split("_").map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ");
  };

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

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Orders */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
            <Link
              href="/orders"
              className="text-sm text-primary hover:text-primary-dark flex items-center"
            >
              View all
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {!recentOrdersData ? (
              // Loading skeletons
              [...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <Skeleton width={16} height={16} />
                    <div className="min-w-0 flex-1">
                      <Skeleton width={100} height={16} />
                      <Skeleton width={80} height={12} className="mt-1" />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <Skeleton width={60} height={16} />
                    <Skeleton width={50} height={12} className="mt-1" />
                  </div>
                </div>
              ))
            ) : recentOrders.length === 0 ? (
              <div className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No recent orders</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Start by creating your first order.
                </p>
              </div>
            ) : (
              recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    {getStatusIcon(order.status)}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {order.id}
                      </p>
                      <p className="text-xs text-gray-500 truncate" title={order.client}>
                        {order.client}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-sm font-medium text-gray-900">
                      {order.amount}
                    </p>
                    <p className="text-xs text-gray-500">
                      {getStatusLabel(order.status)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => {
                setIsAddClientOpen(true);
                // Set client type to local
                setClientType("local");
              }}
              className="btn-primary text-center py-3"
            >
              New Local Client
            </button>
            <button
              onClick={() => {
                setIsAddClientOpen(true);
                // Set client type to international
                setClientType("international");
              }}
              className="btn-primary text-center py-3"
            >
              New International Client
            </button>
            <button
              onClick={() => setIsCreateOrderOpen(true)}
              className="btn-primary text-center py-3"
            >
              New Order
            </button>
            <button
              onClick={() => router.push("/finance")}
              className="btn-secondary text-center py-3"
            >
              Record Payment
            </button>
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="mt-6 card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Recent Activity
        </h2>
        <div className="space-y-3">
          {!recentActivity ? (
            // Loading skeletons
            [...Array(3)].map((_, i) => (
              <div key={i} className="flex items-start space-x-3">
                <Skeleton width={8} height={8} className="mt-1.5 rounded-full" />
                <div className="flex-1">
                  <Skeleton width={200} height={16} />
                  <Skeleton width={80} height={12} className="mt-1" />
                </div>
              </div>
            ))
          ) : recentActivity.length === 0 ? (
            <div className="text-center py-8">
              <TrendingUp className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No recent activity</h3>
              <p className="mt-1 text-sm text-gray-500">
                Activity will appear here as you use the system.
              </p>
            </div>
          ) : (
            recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className={`w-2 h-2 mt-1.5 rounded-full ${activity.color}`}></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">
                    {activity.message}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(activity.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
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