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
  AlertCircle,
  Upload,
  Edit,
  Trash2
} from "lucide-react";
import DocumentUpload from "./DocumentUpload";
import EditOrderModal from "./EditOrderModal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import RecordPaymentModal from "@/app/components/finance/RecordPaymentModal";
import ActivityLog from "../ActivityLog";
import DatePickerModal from "../DatePickerModal";
import { useQuery as useConvexQuery } from "convex/react";
import { api as convexApi } from "@/convex/_generated/api";
import { formatCurrency, formatCurrencyPrecise, type SupportedCurrency } from "@/app/utils/currencyFormat";
import { displayError } from "@/app/utils/errorHandling";
import { type OrderStatus, type Payment } from "@/app/types";

interface OrderDetailModalProps {
  orderId: Id<"orders"> | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function OrderDetailModal({ orderId, isOpen, onClose }: OrderDetailModalProps) {
  const order = useQuery(api.orders.get, orderId ? { id: orderId } : "skip");
  const logs = useConvexQuery(convexApi.dashboard.listEntityLogs, orderId ? { entityTable: "orders", entityId: String(orderId) } : "skip");
  const updateStatus = useMutation(api.orders.updateStatus);
  const updateInvoiceNumber = useMutation(api.orders.updateInvoiceNumber);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isEditingInvoiceNumber, setIsEditingInvoiceNumber] = useState(false);
  const [newInvoiceNumber, setNewInvoiceNumber] = useState("");
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<"pending" | "in_production" | "shipped" | "delivered" | "cancelled" | null>(null);

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

  const handleStatusUpdate = async (newStatus: OrderStatus) => {
    // Check if changing to delivered without delivery date
    if (newStatus === "delivered" && !order?.deliveryDate) {
      setPendingStatusUpdate(newStatus);
      setShowDatePicker(true);
      return;
    }
    
    setIsUpdating(true);
    try {
      await updateStatus({ orderId, status: newStatus });
    } catch (error: unknown) {
      console.error("Failed to update status:", error);
      displayError(error, 'alert');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDatePickerConfirm = async (date: Date) => {
    setShowDatePicker(false);
    
    if (!pendingStatusUpdate) return;
    
    setIsUpdating(true);
    try {
      await updateStatus({ 
        orderId, 
        status: pendingStatusUpdate,
        deliveryDate: date.getTime()
      });
    } catch (error: unknown) {
      console.error("Failed to update status:", error);
      displayError(error, 'alert');
    } finally {
      setIsUpdating(false);
      setPendingStatusUpdate(null);
    }
  };

  const handleDatePickerClose = () => {
    setShowDatePicker(false);
    setPendingStatusUpdate(null);
  };



  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-gray-100 text-gray-800",
      in_production: "bg-blue-100 text-blue-800",
      shipped: "bg-orange-100 text-orange-800",
      delivered: "bg-green-500 text-white font-semibold shadow-sm",
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

  // Note: formatCurrency is now imported from utils/currencyFormat

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Order Details
                </h2>
                {order && (
                  <p className="mt-1 text-sm text-gray-600">
                    Invoice #{order.invoiceNumber}
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowEditModal(true)}
                  className="flex items-center px-3 py-1.5 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center px-3 py-1.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </button>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1 hover:bg-gray-100"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
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
                      <p className="text-sm text-gray-500">Invoice Number</p>
                      <p className="font-medium text-gray-900">{order.invoiceNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Factory Departure Date</p>
                      <p className="font-medium text-gray-900">
                        {formatDate(order.factoryDepartureDate || order.orderCreationDate || order.createdAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Delivery Date</p>
                      <p className="font-medium text-gray-900">
                        {order.deliveryDate ? formatDate(order.deliveryDate) : 'Not set'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <div className="mt-1">
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusUpdate(e.target.value as OrderStatus)}
                          disabled={isUpdating}
                          className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)} cursor-pointer`}
                        >
                          <option value="pending">Pending</option>
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
                        <p className="font-medium text-gray-900 break-words" title={order.client.name}>{order.client.name}</p>
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
                  <div className="space-y-4">
                    {order.items.map((item, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="mb-3">
                          <p className="font-medium text-gray-900 text-lg">{item.product}</p>
                          {item.notes && (
                            <p className="text-sm text-gray-600 mt-1">{item.notes}</p>
                          )}
                        </div>
                        
                        {/* Product Breakdown Table */}
                        <div className="bg-gray-50 rounded-md overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Description</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">Value</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {item.bloom !== undefined && (
                                <tr>
                                  <td className="px-3 py-2 text-xs text-gray-600">Bloom</td>
                                  <td className="px-3 py-2 text-xs text-right font-medium">{item.bloom}</td>
                                </tr>
                              )}
                              {item.mesh !== undefined && (
                                <tr>
                                  <td className="px-3 py-2 text-xs text-gray-600">Mesh</td>
                                  <td className="px-3 py-2 text-xs text-right font-medium">{item.mesh}</td>
                                </tr>
                              )}
                              {item.lotNumbers && item.lotNumbers.length > 0 && (
                                <tr>
                                  <td className="px-3 py-2 text-xs text-gray-600">Lot Numbers</td>
                                  <td className="px-3 py-2 text-xs text-right font-medium">{item.lotNumbers.join(", ")}</td>
                                </tr>
                              )}
                              <tr>
                                <td className="px-3 py-2 text-xs text-gray-600">Quantity</td>
                                <td className="px-3 py-2 text-xs text-right font-medium">{item.quantityKg} kg</td>
                              </tr>
                              <tr>
                                <td className="px-3 py-2 text-xs text-gray-600">Unit Price</td>
                                <td className="px-3 py-2 text-xs text-right font-medium">{formatCurrencyPrecise(item.unitPrice, order.currency as SupportedCurrency)}/kg</td>
                              </tr>
                              <tr className="bg-gray-100">
                                <td className="px-3 py-2 text-xs font-medium text-gray-700">Exclusive Value (Before GST)</td>
                                <td className="px-3 py-2 text-xs text-right font-medium">{formatCurrency(item.exclusiveValue || (item.quantityKg * item.unitPrice), order.currency as SupportedCurrency)}</td>
                              </tr>
                              {item.discountType && item.discountValue && (
                                <>
                                  <tr className="bg-green-50">
                                    <td className="px-3 py-2 text-xs font-medium text-green-700">Total Before Discount</td>
                                    <td className="px-3 py-2 text-xs text-right font-medium text-green-700">{formatCurrency((item.exclusiveValue || (item.quantityKg * item.unitPrice)) + (item.gstAmount || 0), order.currency as SupportedCurrency)}</td>
                                  </tr>
                                  <tr className="bg-green-50">
                                    <td className="px-3 py-2 text-xs font-medium text-green-700">Discount ({item.discountType === "amount" ? "Fixed Amount" : "Percentage"})</td>
                                    <td className="px-3 py-2 text-xs text-right font-medium text-green-700">
                                      {item.discountType === "amount" 
                                        ? formatCurrency(item.discountValue, order.currency as SupportedCurrency)
                                        : `${item.discountValue}%`}
                                    </td>
                                  </tr>
                                  <tr className="bg-green-50">
                                    <td className="px-3 py-2 text-xs font-medium text-green-700">Discount Amount</td>
                                    <td className="px-3 py-2 text-xs text-right font-medium text-green-700">-{formatCurrency(item.discountAmount || 0, order.currency as SupportedCurrency)}</td>
                                  </tr>
                                </>
                              )}
                              <tr>
                                <td className="px-3 py-2 text-xs text-gray-600">GST Rate</td>
                                <td className="px-3 py-2 text-xs text-right font-medium">{(item.gstRate ?? 0)}%</td>
                              </tr>
                              <tr>
                                <td className="px-3 py-2 text-xs text-gray-600">GST Amount</td>
                                <td className="px-3 py-2 text-xs text-right font-medium">{formatCurrency(item.gstAmount || 0, order.currency as SupportedCurrency)}</td>
                              </tr>
                              <tr className="bg-primary/5 border-t-2 border-primary/20">
                                <td className="px-3 py-2 text-xs font-bold text-primary">Inclusive Total (Including GST)</td>
                                <td className="px-3 py-2 text-xs text-right font-bold text-primary">{formatCurrency(item.inclusiveTotal || item.totalPrice, order.currency as SupportedCurrency)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                    
                    {/* Order Total */}
                    <div className="pt-4 border-t-2 border-gray-200">
                      <div className="space-y-2">
                        {/* Calculate product total from items */}
                        {(() => {
                          const productTotal = order.items.reduce((sum, item) => sum + (item.inclusiveTotal || item.totalPrice), 0);
                          return (
                            <>
                              <div className="flex justify-between items-center text-sm text-gray-600">
                                <span>Product Total:</span>
                                <span>{formatCurrencyPrecise(productTotal, order.currency as SupportedCurrency)}</span>
                              </div>
                              {order.freightCost && order.freightCost > 0 && (
                                <div className="flex justify-between items-center text-sm text-gray-600">
                                  <span>Freight Cost:</span>
                                  <span>{formatCurrencyPrecise(order.freightCost, order.currency as SupportedCurrency)}</span>
                                </div>
                              )}
                            </>
                          );
                        })()}
                        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                          <p className="text-lg font-bold text-gray-900">Order Total</p>
                          <p className="text-xl font-bold text-primary">
                            {formatCurrencyPrecise(order.totalAmount, order.currency as SupportedCurrency)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline Information */}
                <div className="card p-4">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    Timeline
                  </h3>
                  <div className="space-y-3">
                    {order.orderCreationDate && (
                      <div>
                        <p className="text-sm text-gray-500">Order Creation Date</p>
                        <p className="font-medium text-gray-900">
                          {formatDate(order.orderCreationDate)}
                        </p>
                      </div>
                    )}
                    {order.factoryDepartureDate && (
                      <div>
                        <p className="text-sm text-gray-500">Factory Departure Date</p>
                        <p className="font-medium text-gray-900">
                          {formatDate(order.factoryDepartureDate)}
                        </p>
                      </div>
                    )}
                    {order.estimatedDepartureDate && (
                      <div>
                        <p className="text-sm text-gray-500">Estimated Departure Date</p>
                        <p className="font-medium text-gray-900">
                          {formatDate(order.estimatedDepartureDate)}
                        </p>
                      </div>
                    )}
                    {order.estimatedArrivalDate && (
                      <div>
                        <p className="text-sm text-gray-500">Estimated Arrival Date</p>
                        <p className="font-medium text-gray-900">
                          {formatDate(order.estimatedArrivalDate)}
                        </p>
                      </div>
                    )}
                    {order.deliveryDate && (
                      <div>
                        <p className="text-sm text-gray-500">Delivery Date</p>
                        <p className="font-medium text-gray-900">
                          {formatDate(order.deliveryDate)}
                        </p>
                      </div>
                    )}
                    {!order.orderCreationDate && !order.factoryDepartureDate && !order.estimatedDepartureDate && !order.estimatedArrivalDate && !order.deliveryDate && (
                      <p className="text-sm text-gray-500">No timeline dates set</p>
                    )}
                    {order.timelineNotes && (
                      <div>
                        <p className="text-sm text-gray-500">Timeline Notes</p>
                        <p className="font-medium text-gray-900">{order.timelineNotes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Shipment Information */}
                {(order.shipmentMethod || order.shippingCompany || order.shippingOrderNumber) && (
                  <div className="card p-4">
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                      <Truck className="h-4 w-4 mr-2" />
                      Shipment Information
                    </h3>
                    <div className="space-y-3">
                      {order.shipmentMethod && (
                        <div>
                          <p className="text-sm text-gray-500">Shipment Method</p>
                          <p className="font-medium text-gray-900">
                            {order.shipmentMethod === "air" ? "By Air" : 
                             order.shipmentMethod === "sea" ? "By Sea" : 
                             order.shipmentMethod === "road" ? "By Road" : 
                             order.shipmentMethod === "train" ? "By Train" : order.shipmentMethod}
                          </p>
                        </div>
                      )}
                      {order.shippingCompany && (
                        <div>
                          <p className="text-sm text-gray-500">Shipping Company</p>
                          <p className="font-medium text-gray-900">{order.shippingCompany}</p>
                        </div>
                      )}
                      {order.shippingOrderNumber && (
                        <div>
                          <p className="text-sm text-gray-500">Shipping Order Number</p>
                          <p className="font-medium text-gray-900">{order.shippingOrderNumber}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Invoice & Payment Status */}
                {order.invoice && (
                  <div className="card p-4">
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                      <FileText className="h-4 w-4 mr-2" />
                      Invoice & Payment
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <p className="text-sm text-gray-500">Invoice Number</p>
                          {isEditingInvoiceNumber ? (
                            <div className="flex items-center space-x-2 mt-1">
                              <input
                                type="text"
                                value={newInvoiceNumber}
                                onChange={(e) => setNewInvoiceNumber(e.target.value)}
                                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-primary focus:border-primary"
                                placeholder="Enter new invoice number"
                              />
                              <button
                                onClick={async () => {
                                  // Validate invoice number
                                  if (!newInvoiceNumber.trim()) {
                                    displayError(new Error("Please enter an invoice number"), 'alert');
                                    return;
                                  }
                                  
                                  // Validate invoice number format (basic validation)
                                  const invoiceRegex = /^[A-Z0-9][A-Z0-9-]{2,19}$/;
                                  if (!invoiceRegex.test(newInvoiceNumber.trim())) {
                                    displayError(new Error("Invoice number must be 3-20 characters long, start with a letter or number, and contain only letters, numbers, and hyphens"), 'alert');
                                    return;
                                  }
                                  
                                  try {
                                    await updateInvoiceNumber({
                                      orderId: order._id,
                                      invoiceNumber: newInvoiceNumber.trim(),
                                    });
                                    setIsEditingInvoiceNumber(false);
                                    setNewInvoiceNumber("");
                                  } catch (error: unknown) {
                                    console.error("Failed to update invoice number:", error);
                                    displayError(error, 'alert');
                                  }
                                }}
                                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setIsEditingInvoiceNumber(false);
                                  setNewInvoiceNumber("");
                                }}
                                className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <p className="font-medium text-gray-900">
                                {order.invoiceNumber || "Not set"}
                              </p>
                              <button
                                onClick={() => {
                                  setIsEditingInvoiceNumber(true);
                                  setNewInvoiceNumber(order.invoiceNumber || "");
                                }}
                                className="text-blue-600 hover:text-blue-800"
                                title="Edit invoice number"
                              >
                                <Edit className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${getPaymentStatusColor(order.invoice.status)}`}>
                          {order.invoice.status.replace("_", " ")}
                        </span>
                      </div>
                      {(() => {
                        const payments = (order as any).payments || [];
                        const advancePaid = payments
                          .filter((p: Payment) => p.type === "advance")
                          .reduce((s: number, p: Payment) => s + (p.amount || 0), 0);
                        const invoicePaid = payments
                          .filter((p: Payment) => p.type !== "advance")
                          .reduce((s: number, p: Payment) => s + (p.amount || 0), 0);
                        const totalPaid = advancePaid + invoicePaid;
                        
                        // Outstanding balance should only be calculated for shipped/delivered orders
                        // For in_production orders, outstanding should be 0 until they are shipped
                        const outstanding = (order.status === "shipped" || order.status === "delivered") 
                          ? Math.max(0, order.invoice.amount - totalPaid)
                          : 0;
                        
                        return (
                          <div className="space-y-4">
                            {/* Main financial summary */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="rounded-lg border border-gray-200 bg-white p-3">
                                <p className="text-xs text-gray-500">Order Value</p>
                                <p className="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(order.invoice.amount, order.currency as SupportedCurrency)}</p>
                              </div>
                              <div className="rounded-lg border border-gray-200 bg-white p-3">
                                <p className="text-xs text-gray-500">Total Paid</p>
                                <p className="mt-1 text-lg font-semibold text-green-600">{formatCurrency(totalPaid, order.currency as SupportedCurrency)}</p>
                              </div>
                              {(order.status !== "shipped" && order.status !== "delivered") && (
                                <div className="rounded-lg border border-gray-200 bg-white p-3">
                                  <p className="text-xs text-gray-500">Advance Payments</p>
                                  <p className="mt-1 text-lg font-semibold text-blue-600">{formatCurrency(advancePaid, order.currency as SupportedCurrency)}</p>
                                </div>
                              )}
                              <div className="rounded-lg border border-gray-200 bg-white p-3">
                                <p className="text-xs text-gray-500">Receivables</p>
                                <p className="mt-1 text-lg font-semibold text-orange-600">
                                  {outstanding > 0 ? formatCurrency(outstanding, order.currency as SupportedCurrency) : 
                                   order.status === "shipped" || order.status === "delivered" ? formatCurrency(0, order.currency as SupportedCurrency) : 
                                   "Not yet due"}
                                </p>
                                {(order.status !== "shipped" && order.status !== "delivered") && (
                                  <p className="text-xs text-gray-400 mt-1">Receivables balance applies after shipment</p>
                                )}
                              </div>
                            </div>
                            
                            {/* Payment breakdown */}
                              {(advancePaid > 0 || invoicePaid > 0) && (
                                <div className="bg-gray-50 rounded-lg p-3">
                                  <h4 className="text-sm font-medium text-gray-700 mb-2">Payment Breakdown</h4>
                                  <div className="space-y-1 text-sm">
                                  {(advancePaid > 0 && (order.status !== "shipped" && order.status !== "delivered")) && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Advance Payments:</span>
                                      <span className="font-medium text-blue-600">{formatCurrency(advancePaid, order.currency as SupportedCurrency)}</span>
                                    </div>
                                  )}
                                  {invoicePaid > 0 && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Invoice Payments:</span>
                                      <span className="font-medium text-green-600">{formatCurrency(invoicePaid, order.currency as SupportedCurrency)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between pt-1 border-t border-gray-200">
                                    <span className="font-medium text-gray-700">Total Paid:</span>
                                    <span className="font-medium text-green-600">{formatCurrency(totalPaid, order.currency as SupportedCurrency)}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Conversion Details for International Payments */}
                      {(() => {
                        const payments = (order as any).payments || [];
                        // Only show when an actual conversion happened: conversion fields present AND bank account currency differs
                        const internationalPayments = payments.filter((p: any) => {
                          const hasConversion = !!p?.conversionRateToUSD && !!p?.convertedAmountUSD;
                          const bank = p?.bankAccount;
                          const currencyMismatch = bank ? bank.currency !== p.currency : false;
                          return hasConversion && currencyMismatch;
                        });
                        if (internationalPayments.length === 0) return null;
                        return (
                          <div className="mt-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Currency Conversion Details</h4>
                            <div className="space-y-2">
                              {internationalPayments.map((payment: any, index: number) => (
                                <div key={index} className="bg-blue-50 rounded-md p-3 text-sm">
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Original Payment:</span>
                                    <span className="font-medium">{formatCurrency(payment.amount, payment.currency as SupportedCurrency)}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Conversion Rate:</span>
                                    <span className="font-medium">1 {payment.currency} = {payment.conversionRateToUSD} USD</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Converted to USD:</span>
                                    <span className="font-medium text-blue-800">{formatCurrency(payment.convertedAmountUSD || 0, 'USD')}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      <button
                        className="w-full btn-primary text-sm"
                        onClick={() => setIsRecordPaymentOpen(true)}
                      >
                        Record Payment
                      </button>
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

                {/* Documents */}
                <div className="card p-4">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                    <Upload className="h-5 w-5 mr-2" />
                    Order Documents
                  </h3>
                  <div className="space-y-4">
                    <DocumentUpload
                      orderId={orderId}
                      documentType="packingList"
                      currentFileId={order.packingListId}
                      onUploadComplete={() => {
                        // Refresh order data
                      }}
                    />
                    
                    <DocumentUpload
                      orderId={orderId}
                      documentType="proformaInvoice"
                      currentFileId={order.proformaInvoiceId}
                      onUploadComplete={() => {
                        // Refresh order data
                      }}
                    />
                    
                    <DocumentUpload
                      orderId={orderId}
                      documentType="commercialInvoice"
                      currentFileId={order.commercialInvoiceId}
                      onUploadComplete={() => {
                        // Refresh order data
                      }}
                    />
                  </div>
                </div>

                {/* Activity Log */}
                <ActivityLog entityId={String(orderId)} entityTable="orders" title="Order Activity" limit={5} collapsible={true} defaultExpanded={false} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Order Modal */}
      <EditOrderModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={() => {
          setShowEditModal(false);
          // The order data will be automatically refreshed due to Convex reactivity
        }}
        orderId={orderId}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onSuccess={() => {
          setShowDeleteModal(false);
          onClose(); // Close the detail modal after successful deletion
        }}
        orderId={orderId}
        invoiceNumber={order?.invoiceNumber}
      />

      {/* Record Payment Modal with preselected invoice and client */}
      {order && (
        <RecordPaymentModal
          isOpen={isRecordPaymentOpen}
          onClose={() => setIsRecordPaymentOpen(false)}
          preselectedInvoiceId={order.invoice?._id as unknown as Id<"invoices">}
          preselectedClientId={order.clientId as unknown as Id<"clients">}
        />
      )}

      {/* Date Picker Modal for Delivery Date */}
      <DatePickerModal
        isOpen={showDatePicker}
        onClose={handleDatePickerClose}
        onConfirm={handleDatePickerConfirm}
        title="Select Delivery Date"
      />

    </div>
  );
}
