"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { 
  X, 
  Calendar, 
  Package, 
  User, 
  FileText, 
  DollarSign,
  Truck,
  CheckCircle,
  Clock,
  AlertCircle
} from "lucide-react";

interface OrderDetailModalProps {
  orderId: Id<"orders"> | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function OrderDetailModal({ orderId, isOpen, onClose }: OrderDetailModalProps) {
  const order = useQuery(api.orders.get, orderId ? { id: orderId } : "skip");
  const updateStatus = useMutation(api.orders.updateStatus);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen || !orderId) return null;

  const handleStatusUpdate = async (newStatus: any) => {
    setIsUpdating(true);
    try {
      await updateStatus({ orderId, status: newStatus });
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-blue-100 text-blue-800",
      in_production: "bg-purple-100 text-purple-800",
      shipped: "bg-indigo-100 text-indigo-800",
      delivered: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getPaymentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800",
      sent: "bg-blue-100 text-blue-800",
      due: "bg-yellow-100 text-yellow-800",
      partially_paid: "bg-orange-100 text-orange-800",
      paid: "bg-green-100 text-green-800",
      overdue: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Order Details
              </h2>
              <button
                onClick={onClose}
                className="rounded-lg p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {!order ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="mt-2 text-sm text-gray-600">Loading order details...</p>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Order Info Section */}
                <div className="card p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Order Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Order Number</p>
                      <p className="font-medium text-gray-900">{order.orderNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Date</p>
                      <p className="font-medium text-gray-900">
                        {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Expected Delivery</p>
                      <p className="font-medium text-gray-900">
                        {formatDate(order.expectedDeliveryDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <div className="mt-1">
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusUpdate(e.target.value)}
                          disabled={isUpdating}
                          className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)} cursor-pointer`}
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="in_production">In Production</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Customer Details */}
                {order.client && (
                  <div className="card p-4">
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                      <User className="h-4 w-4 mr-2" />
                      Customer Details
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-gray-500">Company</p>
                        <p className="font-medium text-gray-900">{order.client.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Contact Person</p>
                        <p className="font-medium text-gray-900">{order.client.contactPerson}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Location</p>
                        <p className="font-medium text-gray-900">
                          {order.client.city}, {order.client.country}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Type</p>
                        <span className="capitalize px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                          {order.client.type}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Product Details */}
                <div className="card p-4">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                    <Package className="h-4 w-4 mr-2" />
                    Product Details
                  </h3>
                  <div className="space-y-3">
                    {order.items.map((item, index) => (
                      <div key={index} className="border-b border-gray-100 pb-3 last:border-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900">{item.product}</p>
                            {item.notes && (
                              <p className="text-sm text-gray-600 mt-1">{item.notes}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900">
                              {formatCurrency(item.totalPrice, order.currency)}
                            </p>
                            <p className="text-sm text-gray-500">
                              {item.quantityKg} kg × {formatCurrency(item.unitPrice, order.currency)}/kg
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <p className="font-semibold text-gray-900">Total Amount</p>
                        <p className="font-semibold text-lg text-gray-900">
                          {formatCurrency(order.totalAmount, order.currency)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Invoice & Payment Status */}
                {order.invoice && (
                  <div className="card p-4">
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                      <FileText className="h-4 w-4 mr-2" />
                      Invoice & Payment
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm text-gray-500">Invoice Number</p>
                          <p className="font-medium text-gray-900">
                            {order.invoice.invoiceNumber}
                          </p>
                        </div>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${getPaymentStatusColor(order.invoice.status)}`}>
                          {order.invoice.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Total Paid</p>
                          <p className="font-medium text-green-600">
                            {formatCurrency(order.invoice.totalPaid, order.currency)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Outstanding</p>
                          <p className="font-medium text-red-600">
                            {formatCurrency(order.invoice.outstandingBalance, order.currency)}
                          </p>
                        </div>
                      </div>
                      {order.invoice.outstandingBalance > 0 && (
                        <button className="w-full btn-primary text-sm">
                          Record Payment
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Delivery Info */}
                {order.delivery && (
                  <div className="card p-4">
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                      <Truck className="h-4 w-4 mr-2" />
                      Delivery Information
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-gray-500">Status</p>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(order.delivery.status)}`}>
                          {order.delivery.status.replace("_", " ")}
                        </span>
                      </div>
                      {order.delivery.carrier && (
                        <div>
                          <p className="text-sm text-gray-500">Carrier</p>
                          <p className="font-medium text-gray-900">{order.delivery.carrier}</p>
                        </div>
                      )}
                      {order.delivery.trackingNumber && (
                        <div>
                          <p className="text-sm text-gray-500">Tracking Number</p>
                          <p className="font-medium text-gray-900">{order.delivery.trackingNumber}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {order.notes && (
                  <div className="card p-4">
                    <h3 className="font-medium text-gray-900 mb-3">Notes</h3>
                    <p className="text-sm text-gray-600">{order.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}