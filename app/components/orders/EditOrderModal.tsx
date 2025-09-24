"use client";

import { useState, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Search, Plus } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import DocumentUpload from "./DocumentUpload";
import { getCurrentFiscalYear, getFiscalYearOptions, getFiscalYearLabel, isDateInFiscalYear, getFiscalYearRange } from "@/app/utils/fiscalYear";
import { ALL_BLOOM_OPTIONS } from "@/app/utils/bloomRanges";
import { dateStringToTimestamp, timestampToDateString } from "@/app/utils/dateUtils";
import { formatCurrencyPrecise, type SupportedCurrency } from "@/app/utils/currencyFormat";
import toast from "react-hot-toast";
import { useModalManager } from "@/app/hooks/useModalManager";

// Validation function for bloom format
const isValidBloomFormat = (bloom: string): boolean => {
  if (!bloom || bloom.trim() === "") return true; // Empty is valid
  
  const trimmedBloom = bloom.trim();
  
  // Check for single 3-digit number
  const singleNumberPattern = /^\d{3}$/;
  if (singleNumberPattern.test(trimmedBloom)) {
    return true;
  }
  
  // Check for range format (3-digit-3-digit)
  const rangePattern = /^\d{3}-\d{3}$/;
  if (rangePattern.test(trimmedBloom)) {
    const [start, end] = trimmedBloom.split('-').map(Number);
    return start <= end; // Ensure start is not greater than end
  }
  
  return false;
};

interface OrderItem {
  product: string;
  quantityKg: number;
  unitPrice: number; // Rate per kg
  exclusiveValue: number; // Quantity × Rate (before GST)
  gstRate: number; // GST percentage (default 0%)
  gstAmount: number; // GST amount calculated
  inclusiveTotal: number; // Total including GST
  // Discount fields
  discountType?: "amount" | "percentage";
  discountValue?: number;
  discountAmount?: number;
  // New fields
  bloom?: string;
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
  const [currentStep, setCurrentStep] = useState(2);
  const [selectedClientId, setSelectedClientId] = useState<Id<"clients"> | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([{
    product: "",
    quantityKg: 0,
    unitPrice: 0,
    exclusiveValue: 0,
    gstRate: 0, // Default 0% GST
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
  }]);
  // Keep separate input strings for each item
  const [lotNumbersInputs, setLotNumbersInputs] = useState<string[]>([""]);
  const [gstRateInputs, setGstRateInputs] = useState<string[]>(["0"]); // Track GST rate input as string for each item
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(getCurrentFiscalYear()); // Default to current fiscal year
  // Timeline fields
  const [orderCreationDate, setOrderCreationDate] = useState("");
  const [factoryDepartureDate, setFactoryDepartureDate] = useState("");
  const [factoryDepartureDateError, setFactoryDepartureDateError] = useState("");
  const [estimatedDepartureDate, setEstimatedDepartureDate] = useState("");
  const [estimatedArrivalDate, setEstimatedArrivalDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [timelineNotes, setTimelineNotes] = useState("");
  // Shipment information
  const [shipmentMethod, setShipmentMethod] = useState<"air" | "sea" | "road" | "train" | "">("");
  const [shippingCompany, setShippingCompany] = useState("");
  const [shippingOrderNumber, setShippingOrderNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [freightCost, setFreightCost] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<Id<"bankAccounts"> | null>(null);
  const [dateValidationError, setDateValidationError] = useState("");

  const order = useQuery(api.orders.get, orderId ? { id: orderId } : "skip");
  const clients = useQuery(api.clients.list, {});
  const bankAccounts = useQuery(api.banks.list);
  const updateOrder = useMutation(api.orders.update);

  // Generate unique modal ID and manage modal state
  const modalId = useId();
  useModalManager(modalId, isOpen);

  // Date validation helper
  const validateOrderCreationDate = (date: string, fiscalYear: number): boolean => {
    if (!date) return true; // Empty date is valid (will use current date)
    const dateTimestamp = dateStringToTimestamp(date);
    return isDateInFiscalYear(dateTimestamp, fiscalYear);
  };

  // Update order creation date when fiscal year changes
  const handleFiscalYearChange = (newFiscalYear: number) => {
    setSelectedFiscalYear(newFiscalYear);
    
    // If order creation date is set and outside the new fiscal year, reset it
    if (orderCreationDate && !validateOrderCreationDate(orderCreationDate, newFiscalYear)) {
      const fiscalYearRange = getFiscalYearRange(newFiscalYear);
      const startDate = timestampToDateString(fiscalYearRange.startDate);
      setOrderCreationDate(startDate);
      setDateValidationError("");
    }
  };

  // Handle order creation date change with validation
  const handleOrderCreationDateChange = (newDate: string) => {
    setOrderCreationDate(newDate);
    
    // Validate the date against the selected fiscal year
    if (newDate && !validateOrderCreationDate(newDate, selectedFiscalYear)) {
      const fiscalYearRange = getFiscalYearRange(selectedFiscalYear);
      const startDate = new Date(fiscalYearRange.startDate);
      const endDate = new Date(fiscalYearRange.endDate);
      setDateValidationError(
        `Order creation date must be within ${getFiscalYearLabel(selectedFiscalYear)} (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`
      );
    } else {
      setDateValidationError("");
    }
  };

  // Populate form with existing order data
  useEffect(() => {
    if (order && order.items && order.items.length > 0) {
      setSelectedClientId(order.clientId);
      
      // Populate all order items
      const populatedItems = order.items.map((item: any) => ({
        product: item.product,
        quantityKg: item.quantityKg,
        unitPrice: item.unitPrice,
        exclusiveValue: item.exclusiveValue || 0,
        gstRate: item.gstRate ?? 0,
        gstAmount: item.gstAmount || 0,
        inclusiveTotal: item.inclusiveTotal || 0,
        // Discount fields
        discountType: item.discountType,
        discountValue: item.discountValue,
        discountAmount: item.discountAmount || 0,
        // New
        bloom: item.bloom,
        mesh: item.mesh,
        lotNumbers: item.lotNumbers || [],
      }));
      
      setOrderItems(populatedItems);
      
      // Set lot numbers inputs for each item
      const lotInputs = order.items.map((item: any) => 
        (item.lotNumbers || []).join(", ")
      );
      setLotNumbersInputs(lotInputs);
      
      // Set GST rate inputs for each item
      const gstInputs = order.items.map((item: any) => 
        String(item.gstRate ?? 0)
      );
      setGstRateInputs(gstInputs);
      
      setOrderCreationDate(order.orderCreationDate ? timestampToDateString(order.orderCreationDate) : "");
      setFactoryDepartureDate(order.factoryDepartureDate ? timestampToDateString(order.factoryDepartureDate) : "");
      setEstimatedDepartureDate(order.estimatedDepartureDate ? timestampToDateString(order.estimatedDepartureDate) : "");
      setEstimatedArrivalDate(order.estimatedArrivalDate ? timestampToDateString(order.estimatedArrivalDate) : "");
      setDeliveryDate(order.deliveryDate ? timestampToDateString(order.deliveryDate) : "");
      setTimelineNotes(order.timelineNotes || "");
      setShipmentMethod(order.shipmentMethod || "");
      setShippingCompany(order.shippingCompany || "");
      setShippingOrderNumber(order.shippingOrderNumber || "");
      setNotes(order.notes || "");
      setFreightCost(order.freightCost || 0);
      setSelectedBankAccountId(order.bankAccountId || null);
    }
  }, [order]);

  // Calculate order total from all items
  const orderTotal = orderItems.reduce((sum, item) => sum + (item.inclusiveTotal || 0), 0) + freightCost;

  const updateOrderItem = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...orderItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate totals for this item
    const item = newItems[index];
    const exclusiveValue = item.quantityKg * item.unitPrice;
    const gstAmount = (exclusiveValue * item.gstRate) / 100;
    
    // Calculate discount
    let discountAmount = 0;
    if (item.discountType && item.discountValue) {
      const totalBeforeDiscount = exclusiveValue + gstAmount;
      if (item.discountType === "amount") {
        discountAmount = item.discountValue;
      } else if (item.discountType === "percentage") {
        discountAmount = (totalBeforeDiscount * item.discountValue) / 100;
      }
    }
    
    const inclusiveTotal = exclusiveValue + gstAmount - discountAmount;
    
    newItems[index] = {
      ...newItems[index],
      exclusiveValue,
      gstAmount,
      discountAmount,
      inclusiveTotal,
    };
    
    setOrderItems(newItems);
  };

  // Helper function to handle lot numbers input for a specific item
  const handleLotNumbersChange = (index: number, value: string) => {
    const newInputs = [...lotNumbersInputs];
    newInputs[index] = value;
    setLotNumbersInputs(newInputs);
    
    const tokens = value.split(",").map(v => v.trim()).filter(v => v.length > 0);
    updateOrderItem(index, "lotNumbers", tokens);
  };

  // Helper function to handle GST rate input for a specific item
  const handleGstRateChange = (index: number, value: string) => {
    const newInputs = [...gstRateInputs];
    newInputs[index] = value;
    setGstRateInputs(newInputs);
    
    // If the value is empty or just a decimal point, set to 0
    if (value === "" || value === ".") {
      updateOrderItem(index, "gstRate", 0);
    } else {
      const numValue = parseFloat(value);
      // Allow any valid number (including over 100) for input, but validate later
      if (!isNaN(numValue) && numValue >= 0) {
        updateOrderItem(index, "gstRate", numValue);
      }
    }
  };

  const addNewProduct = () => {
    setOrderItems([...orderItems, {
      product: "",
      quantityKg: 0,
      unitPrice: 0,
      exclusiveValue: 0,
      gstRate: 0,
      gstAmount: 0,
      inclusiveTotal: 0,
      discountType: undefined,
      discountValue: undefined,
      discountAmount: 0,
      bloom: undefined,
      mesh: undefined,
      lotNumbers: [],
    }]);
    setLotNumbersInputs([...lotNumbersInputs, ""]);
    setGstRateInputs([...gstRateInputs, "0"]);
  };

  const removeProduct = (index: number) => {
    if (orderItems.length > 1) {
      const newItems = orderItems.filter((_, i) => i !== index);
      const newLotInputs = lotNumbersInputs.filter((_, i) => i !== index);
      const newGstInputs = gstRateInputs.filter((_, i) => i !== index);
      setOrderItems(newItems);
      setLotNumbersInputs(newLotInputs);
      setGstRateInputs(newGstInputs);
    }
  };

  const handleNext = async () => {
    if (isUpdating) return; // Prevent multiple calls while updating
    
    if (currentStep === 2) {
      // Validate all order items
      for (let i = 0; i < orderItems.length; i++) {
        const item = orderItems[i];
        
        // Check for missing product name
        if (!item.product || !item.product.trim()) {
          toast.error(`Product ${i + 1}: Please enter a product name.`);
          return;
        }
        
        // Check for invalid quantity
        if (!item.quantityKg || item.quantityKg <= 0) {
          toast.error(`Product ${i + 1}: Please enter a valid quantity (must be greater than 0).`);
          return;
        }
        
        // Check for invalid unit price
        if (!item.unitPrice || item.unitPrice <= 0) {
          toast.error(`Product ${i + 1}: Please enter a valid unit price (must be greater than 0).`);
          return;
        }
        
        // Check for negative GST rate
        if (item.gstRate < 0) {
          toast.error(`Product ${i + 1}: GST rate cannot be negative. Please enter a value between 0 and 100.`);
          return;
        }
        
        // Check for GST rate over 100%
        if (item.gstRate > 100) {
          toast.error(`Product ${i + 1}: GST rate cannot exceed 100%. Please enter a value between 0 and 100.`);
          return;
        }
      }
      
      // Validate freight cost
      if (freightCost < 0) {
        toast.error("Freight cost cannot be negative. Please enter a valid amount.");
        return;
      }

      // Validate that bank account is selected
      if (!selectedBankAccountId) {
        toast.error("Please select a bank account for payment processing.");
        return;
      }
    }
    if (currentStep === 3) {
      // Validate timeline dates if provided
      if (factoryDepartureDate && estimatedDepartureDate) {
        const factoryDate = new Date(factoryDepartureDate);
        const estimatedDate = new Date(estimatedDepartureDate);
        
        if (factoryDate > estimatedDate) {
          toast.error("Factory departure date cannot be later than estimated departure date.");
          return;
        }
      }
      
      if (estimatedDepartureDate && estimatedArrivalDate) {
        const departureDate = new Date(estimatedDepartureDate);
        const arrivalDate = new Date(estimatedArrivalDate);
        
        if (departureDate > arrivalDate) {
          toast.error("Estimated departure date cannot be later than estimated arrival date.");
          return;
        }
      }

    }
    
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else if (currentStep === 4) {
      await handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 2) {
      setCurrentStep(currentStep - 1);
    }
  };

  const resetForm = () => {
    setCurrentStep(2);
    setSelectedClientId(null);
    setOrderItems([{
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
    }]);
    setLotNumbersInputs([""]);
    setGstRateInputs(["18"]);
    setOrderCreationDate("");
    setFactoryDepartureDate("");
    setEstimatedDepartureDate("");
    setEstimatedArrivalDate("");
    setDeliveryDate("");
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
    if (!selectedClientId || !orderId || isUpdating || dateValidationError) return;

    // Validate that factory departure date is provided
    if (!factoryDepartureDate) {
      setFactoryDepartureDateError("Factory departure date is required!");
      toast.error("❌ Factory departure date not added! Please provide a factory departure date for this order.", {
        duration: 5000,
        style: {
          background: '#fee2e2',
          color: '#dc2626',
          border: '1px solid #fca5a5',
          fontSize: '14px',
          fontWeight: '500'
        }
      });
      return;
    } else {
      setFactoryDepartureDateError(""); // Clear error if date is provided
    }

    console.log('Updating order...', { orderId, currentStep });
    setIsUpdating(true);
    try {
      await updateOrder({
        orderId,
        clientId: selectedClientId,
        bankAccountId: selectedBankAccountId || undefined,
        notes,
        freightCost: freightCost || 0,
        // Timeline fields
        orderCreationDate: orderCreationDate ? dateStringToTimestamp(orderCreationDate) : undefined,
        factoryDepartureDate: dateStringToTimestamp(factoryDepartureDate),
        estimatedDepartureDate: estimatedDepartureDate ? dateStringToTimestamp(estimatedDepartureDate) : undefined,
        estimatedArrivalDate: estimatedArrivalDate ? dateStringToTimestamp(estimatedArrivalDate) : undefined,
        deliveryDate: deliveryDate ? dateStringToTimestamp(deliveryDate) : undefined,
        timelineNotes,
        // Shipment information
        shipmentMethod: shipmentMethod || undefined,
        shippingCompany: shippingCompany || undefined,
        shippingOrderNumber: shippingOrderNumber || undefined,
        items: orderItems.map(item => ({
          product: item.product,
          bloom: item.bloom,
          mesh: item.mesh,
          lotNumbers: item.lotNumbers && item.lotNumbers.length ? item.lotNumbers : undefined,
          quantityKg: item.quantityKg,
          unitPrice: item.unitPrice,
          exclusiveValue: item.exclusiveValue,
          gstRate: item.gstRate,
          gstAmount: item.gstAmount,
          inclusiveTotal: item.inclusiveTotal,
          // Discount fields
          discountType: item.discountType,
          discountValue: item.discountValue,
          discountAmount: item.discountAmount,
        })),
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
        } else if (errorStr.includes("order creation date must be within fiscal year")) {
          errorMessage = error.message; // Use the specific error message from the server
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
      
      toast.error(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  // Filter and sort clients
  const filteredAndSortedClients = clients
    ? (Array.isArray(clients) ? clients : clients?.page || [])
        .filter(client => 
          client.name?.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
          client.contactPerson?.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
          client.city?.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
          client.country?.toLowerCase().includes(clientSearchQuery.toLowerCase())
        )
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    : [];

  const selectedClient = (Array.isArray(clients) ? clients : clients?.page || []).find(c => c._id === selectedClientId);

  if (!isOpen || !orderId) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[10000] overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />

        <div className="relative bg-white rounded-lg w-full max-w-2xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Edit Order</h2>
              {order && (
                <p className="mt-1 text-sm text-gray-600">
                  Invoice #{order.invoiceNumber}
                </p>
              )}
              <p className="mt-1 text-sm text-gray-600">
                Step {currentStep - 1} of 3
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
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`flex-1 h-2 mx-1 rounded ${
                    step <= (currentStep - 1) ? "bg-primary" : "bg-gray-200"
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
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

                {/* Bank Account Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bank Account <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedBankAccountId || ""}
                    onChange={(e) => setSelectedBankAccountId(e.target.value as Id<"bankAccounts">)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                    required
                  >
                    <option value="">Select a bank account</option>
                    {bankAccounts?.map((bank) => (
                      <option key={bank._id} value={bank._id}>
                        {bank.currency} - {bank.bankName} - {bank.accountName}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select the bank account where payments for this order will be received. Currency conversion may be required if the bank currency differs from the order currency.
                  </p>
                </div>
                
                {/* Products Section */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-medium text-gray-900">Products</h4>
                    <button
                      type="button"
                      onClick={addNewProduct}
                      className="flex items-center px-3 py-2 bg-primary text-white rounded-md hover:bg-primary-dark text-sm"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Product
                    </button>
                  </div>

                  {orderItems.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4 mb-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="font-medium text-gray-900">Product {index + 1}</h5>
                        {orderItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeProduct(index)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      {/* Product Name */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Product Name
                        </label>
                        <input
                          type="text"
                          value={item.product}
                          onChange={(e) => updateOrderItem(index, "product", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                          placeholder="Enter product name"
                        />
                      </div>
                      {/* Product specs: Bloom, Mesh */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Bloom</label>
                          <input
                            type="text"
                            value={item.bloom ?? ""}
                            onChange={(e) => updateOrderItem(index, "bloom", e.target.value)}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-primary focus:border-primary ${
                              item.bloom && !isValidBloomFormat(item.bloom) 
                                ? 'border-red-500 bg-red-50' 
                                : item.bloom && isValidBloomFormat(item.bloom)
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-300'
                            }`}
                            placeholder="e.g., 180 or 180-200"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Format: 3-digit number (e.g., 180) or range (e.g., 180-200)
                          </p>
                          {item.bloom && !isValidBloomFormat(item.bloom) && (
                            <p className="text-xs text-red-500 mt-1">
                              Invalid format. Use 3-digit number (180) or range (180-200)
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Mesh</label>
                          <select
                            value={item.mesh ?? ""}
                            onChange={(e) => updateOrderItem(index, "mesh", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                          >
                            <option value="">Select Mesh Value</option>
                            <option value="8">8</option>
                            <option value="20">20</option>
                            <option value="25">25</option>
                            <option value="30">30</option>
                            <option value="40">40</option>
                          </select>
                        </div>
                      </div>
                      {/* Lot numbers */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Lot Numbers (comma-separated)</label>
                        <input
                          type="text"
                          value={lotNumbersInputs[index] || ""}
                          onChange={(e) => handleLotNumbersChange(index, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                          placeholder="e.g., 12345, 67890"
                        />
                      </div>

                      {/* Quantity and Rate */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Quantity (kg)
                          </label>
                          <input
                            type="number"
                            value={item.quantityKg || ""}
                            onChange={(e) => updateOrderItem(index, "quantityKg", parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Rate ({order?.currency || 'USD'} per kg)
                          </label>
                          <input
                            type="number"
                            value={item.unitPrice || ""}
                            onChange={(e) => updateOrderItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>

                      {/* Calculations */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Ex. Value (Before GST)
                          </label>
                          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm font-medium text-gray-900">
                            {formatCurrencyPrecise(item.exclusiveValue, order?.currency as SupportedCurrency)}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            GST Rate (%)
                          </label>
                          <input
                            type="number"
                            value={gstRateInputs[index] || ""}
                            onChange={(e) => handleGstRateChange(index, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                            placeholder="0"
                            min="0"
                            step="0.1"
                          />
                        </div>
                      </div>

                      {/* Discount Section */}
                      <div className="border-t pt-4 mt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Discount (Optional)</h4>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Discount Type
                            </label>
                            <select
                              value={item.discountType || ""}
                              onChange={(e) => updateOrderItem(index, "discountType", e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                            >
                              <option value="">No discount</option>
                              <option value="amount">Fixed Amount</option>
                              <option value="percentage">Percentage</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {item.discountType === "amount" ? `Discount Amount (${order?.currency || 'USD'})` : 
                               item.discountType === "percentage" ? "Discount Percentage (%)" : 
                               "Discount Value"}
                            </label>
                            <input
                              type="number"
                              value={item.discountValue || ""}
                              onChange={(e) => updateOrderItem(index, "discountValue", parseFloat(e.target.value) || undefined)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                              placeholder={item.discountType === "amount" ? "0.00" : 
                                          item.discountType === "percentage" ? "0" : ""}
                              min="0"
                              step={(item.discountType === "amount" ? "0.01" : "0.1") as any}
                              disabled={!item.discountType}
                            />
                          </div>
                        </div>

                        {item.discountType && item.discountValue && (
                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Total Before Discount
                            </label>
                            <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-sm font-medium text-blue-700">
                              {formatCurrencyPrecise(item.exclusiveValue + item.gstAmount, order?.currency as SupportedCurrency)}
                            </div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 mt-2">
                              Calculated Discount Amount
                            </label>
                            <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-md text-sm font-medium text-green-700">
                              {formatCurrencyPrecise(item.discountAmount || 0, order?.currency as SupportedCurrency)}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* GST Amount and Total */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            GST Amount
                          </label>
                          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm font-medium text-gray-900">
                            {formatCurrencyPrecise(item.gstAmount, order?.currency as SupportedCurrency)}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Product Total
                          </label>
                          <div className="px-3 py-2 bg-primary/5 border border-primary/20 rounded-md text-sm font-bold text-primary">
                            {formatCurrencyPrecise(item.inclusiveTotal, order?.currency as SupportedCurrency)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Freight Cost */}
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Freight Cost</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Freight Cost ({order?.currency || 'USD'})
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
                        {formatCurrencyPrecise(orderItems.reduce((sum, item) => sum + (item.inclusiveTotal || 0), 0), order?.currency as SupportedCurrency)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Product Total:</span>
                      <span>{formatCurrencyPrecise(orderItems.reduce((sum, item) => sum + (item.inclusiveTotal || 0), 0), order?.currency as SupportedCurrency)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Freight Cost:</span>
                      <span>{formatCurrencyPrecise(freightCost, order?.currency as SupportedCurrency)}</span>
                    </div>
                    <div className="flex items-center justify-between text-lg font-medium border-t pt-2">
                      <span>Order Total:</span>
                      <span className="text-primary">{formatCurrencyPrecise(orderTotal, order?.currency as SupportedCurrency)}</span>
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
                      onChange={(e) => handleOrderCreationDateChange(e.target.value)}
                      min={(() => {
                        const fiscalYearRange = getFiscalYearRange(selectedFiscalYear);
                        return timestampToDateString(fiscalYearRange.startDate);
                      })()}
                      max={(() => {
                        const fiscalYearRange = getFiscalYearRange(selectedFiscalYear);
                        return timestampToDateString(fiscalYearRange.endDate);
                      })()}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-primary focus:border-primary ${
                        dateValidationError ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Must be within {getFiscalYearLabel(selectedFiscalYear)} ({new Date(getFiscalYearRange(selectedFiscalYear).startDate).toLocaleDateString()} - {new Date(getFiscalYearRange(selectedFiscalYear).endDate).toLocaleDateString()})
                    </p>
                    {dateValidationError && (
                      <p className="text-xs text-red-500 mt-1">
                        {dateValidationError}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Factory Departure Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={factoryDepartureDate}
                      onChange={(e) => {
                        setFactoryDepartureDate(e.target.value);
                        if (e.target.value) {
                          setFactoryDepartureDateError(""); // Clear error when user selects a date
                        }
                      }}
                      required
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-primary focus:border-primary ${
                        factoryDepartureDateError ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                    <p className="text-xs text-red-600 mt-1">
                      Factory departure date is required for all orders
                    </p>
                    {factoryDepartureDateError && (
                      <p className="text-xs text-red-500 mt-1 font-medium">
                        {factoryDepartureDateError}
                      </p>
                    )}
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delivery Date
                    </label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
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
                          {orderItems.map((item, index) => (
                            <tr key={index}>
                              <td className="px-2 py-2 text-xs">{item.product}</td>
                              <td className="px-2 py-2 text-xs text-right">{item.quantityKg} kg</td>
                              <td className="px-2 py-2 text-xs text-right">{formatCurrencyPrecise(item.unitPrice, order?.currency as SupportedCurrency)}</td>
                              <td className="px-2 py-2 text-xs text-right">{formatCurrencyPrecise(item.exclusiveValue, order?.currency as SupportedCurrency)}</td>
                              <td className="px-2 py-2 text-xs text-right">{item.gstRate}%</td>
                              <td className="px-2 py-2 text-xs text-right">{formatCurrencyPrecise(item.gstAmount, order?.currency as SupportedCurrency)}</td>
                              <td className="px-2 py-2 text-xs text-right font-medium">{formatCurrencyPrecise(item.inclusiveTotal, order?.currency as SupportedCurrency)}</td>
                            </tr>
                          ))}
                          <tr className="bg-gray-100 font-medium">
                            <td colSpan={6} className="px-2 py-2 text-xs text-right">Grand Total:</td>
                            <td className="px-2 py-2 text-xs text-right text-primary font-bold">{formatCurrencyPrecise(orderTotal, order?.currency as SupportedCurrency)}</td>
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
                      {deliveryDate && (
                        <p className="text-sm">
                          <span className="font-medium">Delivery Date:</span>{" "}
                          {new Date(deliveryDate).toLocaleDateString()}
                        </p>
                      )}
                      {!orderCreationDate && !factoryDepartureDate && !estimatedDepartureDate && !estimatedArrivalDate && !deliveryDate && (
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
              onClick={currentStep === 2 ? onClose : handleBack}
              className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {currentStep === 2 ? "Cancel" : "Back"}
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
                disabled={isUpdating || !!dateValidationError}
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

  // Use portal to render modal directly to document.body
  return createPortal(modalContent, document.body);
}
