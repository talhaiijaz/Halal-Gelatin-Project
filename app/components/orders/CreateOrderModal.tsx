"use client";

import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface OrderItem {
  product: string;
  quantityKg: number;
  unitPrice: number;
  totalPrice: number;
}

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateOrderModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateOrderModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedClientId, setSelectedClientId] = useState<Id<"clients"> | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const clients = useQuery(api.clients.list, {});
  const createOrder = useMutation(api.orders.create);

  // Calculate order total
  const orderTotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);

  const handleAddItem = () => {
    setOrderItems([
      ...orderItems,
      {
        product: "",
        quantityKg: 0,
        unitPrice: 0,
        totalPrice: 0,
      },
    ]);
  };

  const handleUpdateItem = (index: number, field: keyof OrderItem, value: string | number) => {
    const newItems = [...orderItems];
    const item = newItems[index];
    
    if (field === "product") {
      item.product = value as string;
    } else {
      const numValue = typeof value === "string" ? parseFloat(value) || 0 : value;
      if (field === "quantityKg") {
        item.quantityKg = numValue;
      } else if (field === "unitPrice") {
        item.unitPrice = numValue;
      }
      // Auto-calculate total price
      item.totalPrice = item.quantityKg * item.unitPrice;
    }
    
    setOrderItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleNext = () => {
    if (currentStep === 1 && !selectedClientId) {
      alert("Please select a client");
      return;
    }
    if (currentStep === 2 && orderItems.length === 0) {
      alert("Please add at least one order item");
      return;
    }
    if (currentStep === 2 && orderItems.some(item => !item.product || item.quantityKg <= 0 || item.unitPrice <= 0)) {
      alert("Please fill in all item details with valid values");
      return;
    }
    if (currentStep === 3 && !deliveryDate) {
      alert("Please set an expected delivery date");
      return;
    }
    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!selectedClientId) return;

    setIsCreating(true);
    try {
      await createOrder({
        clientId: selectedClientId,
        expectedDeliveryDate: new Date(deliveryDate).getTime(),
        currency: "USD",
        notes,
        items: orderItems.map(item => ({
          product: item.product,
          quantityKg: item.quantityKg,
          unitPrice: item.unitPrice,
        })),
      });

      onSuccess?.();
      onClose();
      
      // Reset form
      setCurrentStep(1);
      setSelectedClientId(null);
      setOrderItems([]);
      setDeliveryDate("");
      setNotes("");
    } catch (error) {
      console.error("Failed to create order:", error);
      alert("Failed to create order. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const selectedClient = clients?.find(c => c._id === selectedClientId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-25" onClick={onClose} />

        <div className="relative bg-white rounded-lg w-full max-w-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Create New Order</h2>
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
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-600">Select Client</span>
              <span className="text-xs text-gray-600">Add Items</span>
              <span className="text-xs text-gray-600">Delivery</span>
              <span className="text-xs text-gray-600">Review</span>
            </div>
          </div>

          {/* Content */}
          <div className="p-6" style={{ minHeight: "400px" }}>
            {/* Step 1: Select Client */}
            {currentStep === 1 && (
              <div>
                <h3 className="text-lg font-medium mb-4">Select Client</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {clients?.map((client) => (
                    <label
                      key={client._id}
                      className={`flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                        selectedClientId === client._id
                          ? "border-primary bg-orange-50"
                          : "border-gray-200"
                      }`}
                    >
                      <input
                        type="radio"
                        name="client"
                        value={client._id}
                        checked={selectedClientId === client._id}
                        onChange={() => setSelectedClientId(client._id)}
                        className="mr-3 text-primary focus:ring-primary"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{client.name}</p>
                        <p className="text-sm text-gray-600">
                          {client.city}, {client.country} • {client.type}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Add Order Items */}
            {currentStep === 2 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">Order Items</h3>
                  <button
                    onClick={handleAddItem}
                    className="flex items-center px-3 py-1.5 text-sm bg-primary text-white rounded-md hover:bg-primary-dark"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </button>
                </div>

                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {orderItems.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Product
                          </label>
                          <input
                            type="text"
                            value={item.product}
                            onChange={(e) => handleUpdateItem(index, "product", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                            placeholder="Product name"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Quantity (kg)
                          </label>
                          <input
                            type="number"
                            value={item.quantityKg || ""}
                            onChange={(e) => handleUpdateItem(index, "quantityKg", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                            placeholder="0"
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Unit Price ($)
                          </label>
                          <input
                            type="number"
                            value={item.unitPrice || ""}
                            onChange={(e) => handleUpdateItem(index, "unitPrice", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="col-span-2 flex items-end">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Total
                            </label>
                            <p className="px-3 py-2 bg-gray-100 rounded-md font-medium">
                              ${item.totalPrice.toFixed(2)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveItem(index)}
                            className="ml-2 p-2 text-red-500 hover:bg-red-50 rounded-md"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {orderItems.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No items added yet. Click "Add Item" to start.
                    </div>
                  )}
                </div>

                {orderItems.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between text-lg font-medium">
                      <span>Order Total:</span>
                      <span className="text-primary">${orderTotal.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Delivery & Notes */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium mb-4">Delivery Information</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                    placeholder="Add any special instructions or notes..."
                  />
                </div>
              </div>
            )}

            {/* Step 4: Review & Confirm */}
            {currentStep === 4 && (
              <div>
                <h3 className="text-lg font-medium mb-4">Review Order</h3>

                <div className="space-y-4">
                  {/* Client Info */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Client</h4>
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p className="font-medium">{selectedClient?.name}</p>
                      <p className="text-sm text-gray-600">
                        {selectedClient?.city}, {selectedClient?.country}
                      </p>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Order Items</h4>
                    <div className="bg-gray-50 rounded-md overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-3 py-2 text-left text-sm font-medium text-gray-700">Product</th>
                            <th className="px-3 py-2 text-right text-sm font-medium text-gray-700">Qty (kg)</th>
                            <th className="px-3 py-2 text-right text-sm font-medium text-gray-700">Unit Price</th>
                            <th className="px-3 py-2 text-right text-sm font-medium text-gray-700">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {orderItems.map((item, index) => (
                            <tr key={index}>
                              <td className="px-3 py-2 text-sm">{item.product}</td>
                              <td className="px-3 py-2 text-sm text-right">{item.quantityKg}</td>
                              <td className="px-3 py-2 text-sm text-right">${item.unitPrice.toFixed(2)}</td>
                              <td className="px-3 py-2 text-sm text-right font-medium">${item.totalPrice.toFixed(2)}</td>
                            </tr>
                          ))}
                          <tr className="bg-gray-100 font-medium">
                            <td colSpan={3} className="px-3 py-2 text-sm text-right">Total:</td>
                            <td className="px-3 py-2 text-sm text-right text-primary">${orderTotal.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Delivery Info */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Delivery</h4>
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p className="text-sm">
                        <span className="font-medium">Expected Date:</span>{" "}
                        {new Date(deliveryDate).toLocaleDateString()}
                      </p>
                      {notes && (
                        <p className="text-sm mt-2">
                          <span className="font-medium">Notes:</span> {notes}
                        </p>
                      )}
                    </div>
                  </div>
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
                disabled={isCreating}
                className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? "Creating..." : "Create Order"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}