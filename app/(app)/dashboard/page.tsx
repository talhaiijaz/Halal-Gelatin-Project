"use client";

import { useState } from "react";
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

export default function DashboardPage() {
  const router = useRouter();
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);

  const stats = [
    {
      name: "Total Clients",
      value: "48",
      change: "+12%",
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      name: "Active Orders",
      value: "23",
      change: "+5%",
      icon: Package,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      name: "Revenue (Month)",
      value: "$124,500",
      change: "+18%",
      icon: DollarSign,
      color: "text-primary",
      bgColor: "bg-orange-100",
    },
    {
      name: "Outstanding",
      value: "$45,200",
      change: "-8%",
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
  ];

  const recentOrders = [
    {
      id: "ORD-2024-001",
      client: "Al Safi Foods",
      amount: "$12,500",
      status: "in_production",
      date: "2024-01-15",
    },
    {
      id: "ORD-2024-002",
      client: "Noor Enterprises",
      amount: "$8,300",
      status: "shipped",
      date: "2024-01-14",
    },
    {
      id: "ORD-2024-003",
      client: "Halal Co Ltd",
      amount: "$15,750",
      status: "pending",
      date: "2024-01-13",
    },
  ];

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
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back!
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Here's what's happening with your business today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <span className={`text-sm font-medium ${
                  stat.change.startsWith("+") ? "text-green-600" : "text-red-600"
                }`}>
                  {stat.change}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
              <p className="text-sm text-gray-600 mt-1">{stat.name}</p>
            </div>
          );
        })}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {getStatusIcon(order.status)}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {order.id}
                    </p>
                    <p className="text-xs text-gray-500">{order.client}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {order.amount}
                  </p>
                  <p className="text-xs text-gray-500">
                    {getStatusLabel(order.status)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setIsAddClientOpen(true)}
              className="btn-primary text-center py-3"
            >
              New Client
            </button>
            <button
              onClick={() => setIsCreateOrderOpen(true)}
              className="btn-primary text-center py-3"
            >
              New Order
            </button>
            <button
              onClick={() => router.push("/finance/invoices")}
              className="btn-secondary text-center py-3"
            >
              Record Payment
            </button>
            <Link
              href="/finance/reports"
              className="btn-secondary text-center py-3"
            >
              View Reports
            </Link>
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="mt-6 card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Recent Activity
        </h2>
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 mt-1.5 rounded-full bg-green-500"></div>
            <div className="flex-1">
              <p className="text-sm text-gray-900">
                Payment received from <span className="font-medium">Al Safi Foods</span>
              </p>
              <p className="text-xs text-gray-500">2 hours ago</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500"></div>
            <div className="flex-1">
              <p className="text-sm text-gray-900">
                Order <span className="font-medium">#ORD-2024-004</span> moved to production
              </p>
              <p className="text-xs text-gray-500">5 hours ago</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 mt-1.5 rounded-full bg-purple-500"></div>
            <div className="flex-1">
              <p className="text-sm text-gray-900">
                New client <span className="font-medium">Global Halal Inc</span> added
              </p>
              <p className="text-xs text-gray-500">Yesterday</p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Client Modal */}
      <AddCustomerModal
        isOpen={isAddClientOpen}
        onClose={() => setIsAddClientOpen(false)}
        type="local"
        onSuccess={() => {
          setIsAddClientOpen(false);
          toast.success("Client added successfully");
          router.push("/clients");
        }}
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