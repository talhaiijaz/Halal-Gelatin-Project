"use client";

import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import DocumentUpload from "./DocumentUpload";
import { getCurrentFiscalYear, getFiscalYearOptions, getFiscalYearLabel } from "@/app/utils/fiscalYear";

interface OrderItem {
  product: string;
  quantityKg: number;
  unitPrice: number; // Rate per kg
  exclusiveValue: number; // Quantity × Rate (before GST)
  gstRate: number; // GST percentage (default 18%)
  gstAmount: number; // GST amount calculated
  inclusiveTotal: number; // Total including GST
  // Discount fields
  discountType?: "amount" | "percentage";
  discountValue?: number;
  discountAmount?: number;
  // New fields
  bloom?: number;
  mesh?: number;
  lotNumbers?: string[];
}

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  orderId: Id<"orders"> | null;
}

export default function EditOrderModal({
  isOpen,
  onClose,
  onSuccess,
  orderId,
}: EditOrderModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedClientId, setSelectedClientId] = useState<Id<"clients"> | null>(null);
  const [orderItem, setOrderItem] = useState<OrderItem>({
    product: "",
    quantityKg: 0,
    unitPrice: 0,
    exclusiveValue: 0,
    gstRate: 18, // Default 18% GST
    gstAmount: 0,
    inclusiveTotal: 0,
    // Discount fields
    discountType: undefined,
    discountValue: undefined,
    discountAmount: 0,
    // New
    bloom: undefined,
    mesh: undefined,
    lotNumbers: [],
  });
  const [gstRateInput, setGstRateInput] = useState("18"); // Track GST rate input as string
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(getCurrentFiscalYear()); // Default to current fiscal year
  // Timeline fields
  const [orderCreationDate, setOrderCreationDate] = useState("");
  const [factoryDepartureDate, setFactoryDepartureDate] = useState("");
  const [estimatedDepartureDate, setEstimatedDepartureDate] = useState("");
  const [estimatedArrivalDate, setEstimatedArrivalDate] = useState("");
  const [timelineNotes, setTimelineNotes] = useState("");
  // Shipment information
  const [shipmentMethod, setShipmentMethod] = useState<"air" | "sea" | "road" | "train" | "">("");
  const [shippingCompany, setShippingCompany] = useState("");
  const [shippingOrderNumber, setShippingOrderNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [freightCost, setFreightCost] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [lotNumbersInput, setLotNumbersInput] = useState("");

  const order = useQuery(api.orders.get, orderId ? { id: orderId } : "skip");
  const clients = useQuery(api.clients.list, {});
  const bankAccounts = useQuery(api.banks.list);
  const updateOrder = useMutation(api.orders.update);

  // Populate form with existing order data
  useEffect(() => {
    if (order && order.items && order.items.length > 0) {
      const item = order.items[0]; // Assuming single item for now
      setSelectedClientId(order.clientId);
      setOrderItem({
        product: item.product,
        quantityKg: item.quantityKg,
        unitPrice: item.unitPrice,
        exclusiveValue: item.exclusiveValue || 0,
        gstRate: item.gstRate || 18,
        gstAmount: item.gstAmount || 0,
        inclusiveTotal: item.inclusiveTotal || 0,
        // Discount fields
        discountType: item.discountType,
        discountValue: item.discountValue,
        discountAmount: item.discountAmount || 0,
        // New
        bloom: (item as any).bloom,
        mesh: (item as any).mesh,
        lotNumbers: (item as any).lotNumbers || [],
      });
      setOrderCreationDate(order.orderCreationDate ? new Date(order.orderCreationDate).toISOString().split('T')[0] : "");
      setFactoryDepartureDate(order.factoryDepartureDate ? new Date(order.factoryDepartureDate).toISOString().split('T')[0] : "");
      setEstimatedDepartureDate(order.estimatedDepartureDate ? new Date(order.estimatedDepartureDate).toISOString().split('T')[0] : "");
      setEstimatedArrivalDate(order.estimatedArrivalDate ? new Date(order.estimatedArrivalDate).toISOString().split('T')[0] : "");
      setTimelineNotes(order.timelineNotes || "");
      setShipmentMethod(order.shipmentMethod || "");
      setShippingCompany(order.shippingCompany || "");
      setShippingOrderNumber(order.shippingOrderNumber || "");
      setNotes(order.notes || "");
      setFreightCost(order.freightCost || 0);
      // Seed lot numbers input for editing
      const ln = ((order.items[0] as any).lotNumbers || []).join(", ");
      setLotNumbersInput(ln);
    }
  }, [order]);

  // Calculate order total
  const orderTotal = (orderItem.inclusiveTotal || 0) + freightCost;

  const handleUpdateItem = (field: keyof OrderItem, value: string | number) => {
    const updatedItem = { ...orderItem };
    
    if (field === "product") {
      updatedItem.product = value as string;
    } else if (field === "bloom") {
      updatedItem.bloom = typeof value === "string" ? (value === "" ? undefined : parseFloat(value)) : (value as number);
      setOrderItem(updatedItem);
      return;
    } else if (field === "mesh") {
      updatedItem.mesh = typeof value === "string" ? (value === "" ? undefined : parseFloat(value)) : (value as number);
      setOrderItem(updatedItem);
      return;
    } else {
      const numValue = typeof value === "string" ? parseFloat(value) || 0 : value;
      
      // Update the specific field
      if (field === "quantityKg") {
        updatedItem.quantityKg = numValue;
      } else if (field === "unitPrice") {
        updatedItem.unitPrice = numValue;
      } else if (field === "gstRate") {
        updatedItem.gstRate = numValue;
      } else if (field === "discountType") {
        updatedItem.discountType = value === "" ? undefined : (value as "amount" | "percentage");
      } else if (field === "discountValue") {
        updatedItem.discountValue = numValue;
      }
      
      // Recalculate all values
      updatedItem.exclusiveValue = updatedItem.quantityKg * updatedItem.unitPrice;
      updatedItem.gstAmount = (updatedItem.exclusiveValue * updatedItem.gstRate) / 100;
      const totalBeforeDiscount = updatedItem.exclusiveValue + updatedItem.gstAmount;
      
      // Calculate discount on total (after GST)
      let discountAmount = 0;
      if (updatedItem.discountType && updatedItem.discountValue) {
        if (updatedItem.discountType === "amount") {
          discountAmount = updatedItem.discountValue;
        } else if (updatedItem.discountType === "percentage") {
          discountAmount = (totalBeforeDiscount * updatedItem.discountValue) / 100;
        }
      }
      updatedItem.discountAmount = discountAmount;
      
      // Apply discount to total
      updatedItem.inclusiveTotal = totalBeforeDiscount - discountAmount;
    }
    
    setOrderItem(updatedItem);
  };

  const handleNext = async () => {
    if (isUpdating) return; // Prevent multiple calls while updating
    
    if (currentStep === 1 && !selectedClientId) {
      alert("Please select a client");
      return;
    }
    
    if (currentStep === 2 && (!orderItem.product || orderItem.quantityKg <= 0 || orderItem.unitPrice <= 0)) {
      alert("Please fill in all required fields");
      return;
    }
    if (currentStep === 3) {
      // Timeline step - no validation needed
    }
    
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else if (currentStep === 4) {
      await handleSubmit();
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const resetForm = () => {
    setCurrentStep(1);
    setSelectedClientId(null);
    setOrderItem({
      product: "",
      quantityKg: 0,
      unitPrice: 0,
      exclusiveValue: 0,
      gstRate: 18,
      gstAmount: 0,
      inclusiveTotal: 0,
      // Discount fields
      discountType: undefined,
      discountValue: undefined,
      discountAmount: 0,
      // New
      bloom: undefined,
      mesh: undefined,
      lotNumbers: [],
    });
    setOrderCreationDate("");
    setFactoryDepartureDate("");
    setEstimatedDepartureDate("");
    setEstimatedArrivalDate("");
    setTimelineNotes("");
    // Shipment information
    setShipmentMethod("");
    setShippingCompany("");
    setShippingOrderNumber("");
    setNotes("");
    setFreightCost(0);
    setClientSearchQuery("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedClientId || !orderId || isUpdating) return;

    console.log('Updating order...', { orderId, currentStep });
    setIsUpdating(true);
    try {
      await updateOrder({
        orderId,
        clientId: selectedClientId,
        notes,
        freightCost: freightCost || 0,
        // Timeline fields
        orderCreationDate: orderCreationDate ? new Date(orderCreationDate).getTime() : undefined,
        factoryDepartureDate: factoryDepartureDate ? new Date(factoryDepartureDate).getTime() : undefined,
        estimatedDepartureDate: estimatedDepartureDate ? new Date(estimatedDepartureDate).getTime() : undefined,
        estimatedArrivalDate: estimatedArrivalDate ? new Date(estimatedArrivalDate).getTime() : undefined,
        timelineNotes,
        // Shipment information
        shipmentMethod: shipmentMethod || undefined,
        shippingCompany: shippingCompany || undefined,
        shippingOrderNumber: shippingOrderNumber || undefined,
        items: [{
          product: orderItem.product,
          quantityKg: orderItem.quantityKg,
          unitPrice: orderItem.unitPrice,
          exclusiveValue: orderItem.exclusiveValue,
          gstRate: orderItem.gstRate,
          gstAmount: orderItem.gstAmount,
          inclusiveTotal: orderItem.inclusiveTotal,
          // Discount fields
          discountType: orderItem.discountType,
          discountValue: orderItem.discountValue,
          discountAmount: orderItem.discountAmount,
          // New
          bloom: orderItem.bloom,
          mesh: orderItem.mesh,
          lotNumbers: orderItem.lotNumbers && orderItem.lotNumbers.length ? orderItem.lotNumbers : undefined,
        }],
      });

      console.log('Order updated successfully');

      onSuccess?.();
      resetForm();
      onClose();
    } catch (error) {
      console.error("Failed to update order:", error);
      
      // Provide more specific error messages based on the error type
      let errorMessage = "Failed to update order. Please try again.";
      
      if (error instanceof Error) {
        const errorStr = error.message.toLowerCase();
        
        if (errorStr.includes("validation") || errorStr.includes("invalid")) {
          errorMessage = "Invalid order data. Please check all required fields and try again.";
        } else if (errorStr.includes("client") || errorStr.includes("customer")) {
          errorMessage = "Client information is invalid or missing. Please select a valid client.";
        } else if (errorStr.includes("product") || errorStr.includes("item")) {
          errorMessage = "Product information is invalid. Please check product details and try again.";
        } else if (errorStr.includes("price") || errorStr.includes("amount")) {
          errorMessage = "Price or amount information is invalid. Please check pricing details.";
        } else if (errorStr.includes("network") || errorStr.includes("connection")) {
          errorMessage = "Network connection error. Please check your internet connection and try again.";
        } else if (errorStr.includes("permission") || errorStr.includes("unauthorized")) {
          errorMessage = "You don't have permission to update orders. Please contact your administrator.";
        } else if (errorStr.includes("not found") || errorStr.includes("doesn't exist")) {
          errorMessage = "Order not found. The order may have been deleted or you don't have access to it.";
        } else if (errorStr.includes("fiscal year") || errorStr.includes("year")) {
          errorMessage = "Fiscal year information is invalid. Please select a valid fiscal year.";
        } else {
          // For other errors, show the actual error message if it's not too technical
          const cleanMessage = error.message.replace(/^Error: /, '').replace(/^ConvexError: /, '');
          if (cleanMessage.length < 100 && !cleanMessage.includes('internal') && !cleanMessage.includes('server')) {
            errorMessage = `Error: ${cleanMessage}`;
          }
        }
      }
      
      alert(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  // Filter and sort clients
  const filteredAndSortedClients = clients
    ? clients
        .filter(client => 
          client.name?.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
          client.contactPerson?.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
          client.city?.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
          client.country?.toLowerCase().includes(clientSearchQuery.toLowerCase())
        )
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    : [];

  const selectedClient = clients?.find(c => c._id === selectedClientId);

  if (!isOpen || !orderId) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-25" onClick={onClose} />

        <div className="relative bg-white rounded-lg w-full max-w-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Edit Order</h2>
                              <p className="mt-1 text-sm text-gray-600">
                  Step {currentStep} of 4
                </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="px-6 py-3 border-b">
            <div className="flex items-center justify-between">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`flex-1 h-2 mx-1 rounded ${
                    step <= currentStep ? "bg-primary" : "bg-gray-200"
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>Client</span>
              <span>Order Details</span>
              <span>Timeline</span>
              <span>Review</span>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Step 1: Client Selection */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium mb-4">Select Client</h3>
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search clients..."
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2">
                  {filteredAndSortedClients.map((client) => (
                    <button
                      key={client._id}
                      onClick={() => setSelectedClientId(client._id)}
                      className={`w-full text-left p-3 rounded-md border transition-colors ${
                        selectedClientId === client._id
                          ? "border-primary bg-primary/5"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="font-medium">{client.name}</div>
                      <div className="text-sm text-gray-600">
                        {client.contactPerson} • {client.city}, {client.country}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Order Details */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium mb-4">Order Details</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      value={orderItem.product}
                      onChange={(e) => handleUpdateItem("product", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                      placeholder="Enter product name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bloom</label>
                    <input
                      type="number"
                      value={orderItem.bloom ?? ""}
                      onChange={(e) => handleUpdateItem("bloom", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                      placeholder="e.g., 250"
                      min={0}
                      step={1}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mesh</label>
                    <input
                      type="number"
                      value={orderItem.mesh ?? ""}
                      onChange={(e) => handleUpdateItem("mesh", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                      placeholder="e.g., 80"
                      min={0}
                      step={1}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity (kg) *
                    </label>
                    <input
                      type="number"
                      value={orderItem.quantityKg}
                      onChange={(e) => handleUpdateItem("quantityKg", parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                      placeholder="0"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit Price (per kg) *
                    </label>
                    <input
                      type="number"
                      value={orderItem.unitPrice}
                      onChange={(e) => handleUpdateItem("unitPrice", parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                      placeholder="0"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      GST Rate (%)
                    </label>
                    <input
                      type="number"
                      value={gstRateInput}
                      onChange={(e) => {
                        setGstRateInput(e.target.value);
                        const numValue = parseFloat(e.target.value) || 0;
                        if (numValue >= 0) {
                          handleUpdateItem("gstRate", numValue);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                      placeholder="18"
                      min="0"
                      step="0.01"
                    />
                  </div>


                </div>

                {/* Lot Numbers */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lot Numbers (comma-separated)</label>
                  <input
                    type="text"
                    value={lotNumbersInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLotNumbersInput(val);
                      const tokens = val.split(",").map(v => v.trim()).filter(Boolean);
                      setOrderItem({ ...orderItem, lotNumbers: tokens });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                    placeholder="e.g., 12345, 67890"
                  />
                </div>

                {/* Discount Section */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Discount (Optional)</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Discount Type
                      </label>
                      <select
                        value={orderItem.discountType || ""}
                        onChange={(e) => handleUpdateItem("discountType", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                      >
                        <option value="">No discount</option>
                        <option value="amount">Fixed Amount</option>
                        <option value="percentage">Percentage</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {orderItem.discountType === "amount" ? "Discount Amount ($)" : 
                         orderItem.discountType === "percentage" ? "Discount Percentage (%)" : 
                         "Discount Value"}
                      </label>
                      <input
                        type="number"
                        value={orderItem.discountValue || ""}
                        onChange={(e) => handleUpdateItem("discountValue", parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                        placeholder={orderItem.discountType === "amount" ? "0.00" : 
                                    orderItem.discountType === "percentage" ? "0" : ""}
                        min="0"
                        step={orderItem.discountType === "amount" ? "0.01" : "0.1"}
                        disabled={!orderItem.discountType}
                      />
                    </div>
                  </div>

                  {orderItem.discountType && orderItem.discountValue && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Total Before Discount
                      </label>
                      <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-sm font-medium text-blue-700">
                        ${(orderItem.exclusiveValue + orderItem.gstAmount).toFixed(2)}
                      </div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 mt-2">
                        Calculated Discount Amount
                      </label>
                      <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-md text-sm font-medium text-green-700">
                        ${orderItem.discountAmount?.toFixed(2) || "0.00"}
                      </div>
                    </div>
                  )}
                </div>

                {/* Calculation Summary */}
                <div className="bg-gray-50 p-4 rounded-md">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Calculation Summary</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Exclusive Value:</span>
                      <div className="font-medium">${orderItem.exclusiveValue.toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">GST Amount:</span>
                      <div className="font-medium">${orderItem.gstAmount.toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">GST Rate:</span>
                      <div className="font-medium">{orderItem.gstRate}%</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Total:</span>
                      <div className="font-medium text-primary">${orderItem.inclusiveTotal.toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                {/* Freight Cost */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Freight Cost</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Freight Cost ($)
                      </label>
                      <input
                        type="number"
                        value={freightCost || ""}
                        onChange={(e) => setFreightCost(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Product Total
                      </label>
                      <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm font-medium text-gray-900">
                        ${orderItem.inclusiveTotal.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Total Summary */}
                <div className="bg-primary/5 p-4 rounded-md border border-primary/20">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Order Total</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Product Total:</span>
                      <span>${orderItem.inclusiveTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Freight Cost:</span>
                      <span>${freightCost.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-lg font-medium border-t pt-2">
                      <span>Order Total:</span>
                      <span className="text-primary">${orderTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Timeline */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium mb-4">Order Timeline (Optional)</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Add important dates for tracking the order progress. All fields are optional.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Order Creation Date
                    </label>
                    <input
                      type="date"
                      value={orderCreationDate}
                      onChange={(e) => setOrderCreationDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Factory Departure Date
                    </label>
                    <input
                      type="date"
                      value={factoryDepartureDate}
                      onChange={(e) => setFactoryDepartureDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estimated Departure Date
                    </label>
                    <input
                      type="date"
                      value={estimatedDepartureDate}
                      onChange={(e) => setEstimatedDepartureDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estimated Arrival Date
                    </label>
                    <input
                      type="date"
                      value={estimatedArrivalDate}
                      onChange={(e) => setEstimatedArrivalDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Timeline Notes (Optional)
                  </label>
                  <textarea
                    value={timelineNotes}
                    onChange={(e) => setTimelineNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                    placeholder="Add any timeline-specific notes or instructions..."
                  />
                </div>



                {/* Shipment Information */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Shipment Information (Optional)</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Shipment Method
                      </label>
                      <select
                        value={shipmentMethod}
                        onChange={(e) => setShipmentMethod(e.target.value as "air" | "sea" | "road" | "train" | "")}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                      >
                        <option value="">Select shipment method</option>
                        <option value="air">By Air</option>
                        <option value="sea">By Sea</option>
                        <option value="road">By Road</option>
                        <option value="train">By Train</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Shipping Company
                      </label>
                      <input
                        type="text"
                        value={shippingCompany}
                        onChange={(e) => setShippingCompany(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                        placeholder="Enter shipping company name"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Shipping Order Number
                    </label>
                    <input
                      type="text"
                      value={shippingOrderNumber}
                      onChange={(e) => setShippingOrderNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                      placeholder="Enter shipping company's order number"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    General Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                    placeholder="Add any general order notes or special instructions..."
                  />
                </div>
              </div>
            )}

            {/* Step 4: Review & Confirm */}
            {currentStep === 4 && (
              <div>
                <h3 className="text-lg font-medium mb-4">Review Order Changes</h3>

                <div className="space-y-4">
                  {/* Client Info */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Client</h4>
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p className="font-medium break-words" title={selectedClient?.name}>{selectedClient?.name}</p>
                      <p className="text-sm text-gray-600 break-words" title={`${selectedClient?.city}, ${selectedClient?.country}`}>
                        {selectedClient?.city}, {selectedClient?.country}
                      </p>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Order Items</h4>
                    <div className="bg-gray-50 rounded-md overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-2 py-2 text-left text-xs font-medium text-gray-700">Product</th>
                            <th className="px-2 py-2 text-right text-xs font-medium text-gray-700">Qty</th>
                            <th className="px-2 py-2 text-right text-xs font-medium text-gray-700">Rate</th>
                            <th className="px-2 py-2 text-right text-xs font-medium text-gray-700">Ex. Value</th>
                            <th className="px-2 py-2 text-right text-xs font-medium text-gray-700">GST</th>
                            <th className="px-2 py-2 text-right text-xs font-medium text-gray-700">GST Amt</th>
                            <th className="px-2 py-2 text-right text-xs font-medium text-gray-700">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          <tr>
                            <td className="px-2 py-2 text-xs">{orderItem.product}</td>
                            <td className="px-2 py-2 text-xs text-right">{orderItem.quantityKg} kg</td>
                            <td className="px-2 py-2 text-xs text-right">${orderItem.unitPrice.toFixed(2)}</td>
                            <td className="px-2 py-2 text-xs text-right">${orderItem.exclusiveValue.toFixed(2)}</td>
                            <td className="px-2 py-2 text-xs text-right">{orderItem.gstRate}%</td>
                            <td className="px-2 py-2 text-xs text-right">${orderItem.gstAmount.toFixed(2)}</td>
                            <td className="px-2 py-2 text-xs text-right font-medium">${orderItem.inclusiveTotal.toFixed(2)}</td>
                          </tr>
                          <tr className="bg-gray-100 font-medium">
                            <td colSpan={6} className="px-2 py-2 text-xs text-right">Grand Total:</td>
                            <td className="px-2 py-2 text-xs text-right text-primary font-bold">${orderTotal.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Timeline Info */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Timeline</h4>
                    <div className="bg-gray-50 p-3 rounded-md space-y-2">
                      {orderCreationDate && (
                        <p className="text-sm">
                          <span className="font-medium">Order Creation:</span>{" "}
                          {new Date(orderCreationDate).toLocaleDateString()}
                        </p>
                      )}
                      {factoryDepartureDate && (
                        <p className="text-sm">
                          <span className="font-medium">Factory Departure:</span>{" "}
                          {new Date(factoryDepartureDate).toLocaleDateString()}
                        </p>
                      )}
                      {estimatedDepartureDate && (
                        <p className="text-sm">
                          <span className="font-medium">Estimated Departure:</span>{" "}
                          {new Date(estimatedDepartureDate).toLocaleDateString()}
                        </p>
                      )}
                      {estimatedArrivalDate && (
                        <p className="text-sm">
                          <span className="font-medium">Estimated Arrival:</span>{" "}
                          {new Date(estimatedArrivalDate).toLocaleDateString()}
                        </p>
                      )}
                      {!orderCreationDate && !factoryDepartureDate && !estimatedDepartureDate && !estimatedArrivalDate && (
                        <p className="text-sm text-gray-500">No timeline dates set</p>
                      )}
                      {timelineNotes && (
                        <p className="text-sm mt-2">
                          <span className="font-medium">Timeline Notes:</span> {timelineNotes}
                        </p>
                      )}
                      {notes && (
                        <p className="text-sm mt-2">
                          <span className="font-medium">General Notes:</span> {notes}
                        </p>
                      )}
                    </div>
                  </div>



                  {/* Shipment Info */}
                  {(shipmentMethod || shippingCompany || shippingOrderNumber) && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Shipment Information</h4>
                      <div className="bg-gray-50 p-3 rounded-md space-y-2">
                        {shipmentMethod && (
                          <p className="text-sm">
                            <span className="font-medium">Shipment Method:</span>{" "}
                            {shipmentMethod === "air" ? "By Air" : 
                             shipmentMethod === "sea" ? "By Sea" : 
                             shipmentMethod === "road" ? "By Road" : 
                             shipmentMethod === "train" ? "By Train" : shipmentMethod}
                          </p>
                        )}
                        {shippingCompany && (
                          <p className="text-sm">
                            <span className="font-medium">Shipping Company:</span>{" "}
                            {shippingCompany}
                          </p>
                        )}
                        {shippingOrderNumber && (
                          <p className="text-sm">
                            <span className="font-medium">Shipping Order Number:</span>{" "}
                            {shippingOrderNumber}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}


          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t bg-gray-50">
            <button
              onClick={currentStep === 1 ? onClose : handleBack}
              className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {currentStep === 1 ? "Cancel" : "Back"}
            </button>

            {currentStep < 4 ? (
              <button
                onClick={handleNext}
                className="flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isUpdating}
                className="flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? "Updating..." : "Update Order"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
