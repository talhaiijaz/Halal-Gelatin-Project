"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { dateStringToTimestamp, timestampToDateString } from "@/app/utils/dateUtils";
import { formatCurrency, getCurrencyForClientType, type SupportedCurrency } from "@/app/utils/currencyFormat";
import { getSuggestedExchangeRate } from "@/app/utils/currencyConversion";
import { parseError, displayError, validateRequiredFields, formatValidationError } from "@/app/utils/errorHandling";
import Modal from "@/app/components/ui/Modal";

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedInvoiceId?: Id<"invoices">;
  preselectedClientId?: Id<"clients">;
}

export default function RecordPaymentModal({ 
  isOpen, 
  onClose, 
  preselectedInvoiceId,
  preselectedClientId 
}: RecordPaymentModalProps) {
  const recordPayment = useMutation(api.payments.recordPayment);
  const clients = useQuery(api.clients.list, { status: "active" });
  const bankAccounts = useQuery(api.banks.list);
  const [selectedClientId, setSelectedClientId] = useState<string>(preselectedClientId || "");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(preselectedInvoiceId || "");
  const [isAdvancePayment, setIsAdvancePayment] = useState<boolean>(false);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("");
  const [originalBankAccountId, setOriginalBankAccountId] = useState<string>("");
  const [showBankWarning, setShowBankWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Get unpaid invoices for selected client
  const unpaidInvoices = useQuery(
    api.payments.getUnpaidInvoices,
    selectedClientId ? { clientId: selectedClientId as Id<"clients"> } : {}
  );

  const [formData, setFormData] = useState({
    amount: "",
    method: "bank_transfer" as const,
    reference: "",
    paymentDate: timestampToDateString(Date.now()),
    notes: "",
    applyWithholding: false,
    withholdingRate: "",
    conversionRateToUSD: "",
  });

  useEffect(() => {
    if (preselectedClientId) {
      setSelectedClientId(preselectedClientId);
    }
    if (preselectedInvoiceId) {
      setSelectedInvoiceId(preselectedInvoiceId);
    }
  }, [preselectedClientId, preselectedInvoiceId]);

  // Auto-fill amount and bank account when invoice is selected
  useEffect(() => {
    if (selectedInvoiceId && unpaidInvoices) {
      const invoice = unpaidInvoices.find(inv => inv._id === selectedInvoiceId);
      if (invoice) {
        // Auto-fill with remaining amount (Total - Paid)
        const remainingAmount = invoice.amount - invoice.totalPaid;
        setFormData(prev => ({
          ...prev,
          amount: remainingAmount.toString(),
          conversionRateToUSD: "",
        }));

        // Auto-select bank account from order if available
        if (invoice.bankAccount?._id) {
          setOriginalBankAccountId(invoice.bankAccount._id);
          setSelectedBankAccountId(invoice.bankAccount._id);
          setShowBankWarning(false);
        } else {
          setOriginalBankAccountId("");
          setSelectedBankAccountId("");
          setShowBankWarning(false);
        }
      }
    }
  }, [selectedInvoiceId, unpaidInvoices]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    const validation = validateRequiredFields(
      {
        selectedClientId,
        selectedInvoiceId,
        amount: formData.amount,
        reference: formData.reference,
        paymentDate: formData.paymentDate,
        bankAccountId: formData.method === "bank_transfer" ? selectedBankAccountId : undefined
      },
      [
        'selectedClientId',
        'selectedInvoiceId', 
        'amount',
        'reference',
        'paymentDate',
        ...(formData.method === "bank_transfer" ? ['bankAccountId'] : [])
      ]
    );
    
    if (!validation.isValid) {
      const errorMessage = formatValidationError(validation.missingFields);
      displayError(new Error(errorMessage), 'alert');
      return;
    }
    
    // Additional validation for amount
    if (parseFloat(formData.amount) <= 0) {
      displayError(new Error('Payment amount must be greater than 0'), 'alert');
      return;
    }

    setIsSubmitting(true);
    try {
      // Calculate withholding rate
      const selectedClient = (Array.isArray(clients) ? clients : clients?.page || []).find(c => c._id === (selectedClientId as any));
      const isLocalClient = selectedClient?.type === "local";
      const isInternationalClient = selectedClient?.type === "international";
      
      // Check if withholding applies (local clients OR international clients using local bank accounts)
      let rate = 0;
      if (formData.applyWithholding) {
        if (isLocalClient) {
          rate = Math.max(0, parseFloat(formData.withholdingRate || "0"));
        } else if (isInternationalClient && selectedBankAccountId && bankAccounts) {
          const selectedBank = bankAccounts.find(bank => bank._id === selectedBankAccountId);
          if (selectedBank?.currency === "PKR") {
            rate = Math.max(0, parseFloat(formData.withholdingRate || "0"));
          }
        }
      }

      await recordPayment({
        type: isAdvancePayment ? "advance" : "invoice",
        invoiceId: selectedInvoiceId as Id<"invoices">,
        clientId: selectedClientId as Id<"clients">,
        amount: parseFloat(formData.amount),
        method: formData.method,
        reference: formData.reference,
        paymentDate: dateStringToTimestamp(formData.paymentDate),
        notes: formData.notes || undefined,
        bankAccountId: formData.method === "bank_transfer" && selectedBankAccountId ? (selectedBankAccountId as Id<"bankAccounts">) : undefined,
        withheldTaxRate: rate > 0 ? rate : undefined,
        conversionRateToUSD: formData.conversionRateToUSD ? parseFloat(formData.conversionRateToUSD) : undefined,
      });
      
      // Reset form
      setFormData({
        amount: "",
        method: "bank_transfer",
        reference: "",
        paymentDate: timestampToDateString(Date.now()),
        notes: "",
        applyWithholding: false,
        withholdingRate: "",
        conversionRateToUSD: "",
      });
      setSelectedClientId("");
      setSelectedInvoiceId("");
      setIsAdvancePayment(false);
      onClose();
    } catch (error: unknown) {
      console.error("Failed to record payment:", error);
      displayError(error, 'alert');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleBankAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newBankAccountId = e.target.value;
    setSelectedBankAccountId(newBankAccountId);
    
    // Show warning if user changes from original bank account
    if (originalBankAccountId && newBankAccountId !== originalBankAccountId) {
      setShowBankWarning(true);
    } else {
      setShowBankWarning(false);
    }
  };

  const getCurrencyForDisplay = (currency?: string): SupportedCurrency => {
    const invoice = unpaidInvoices?.find(inv => inv._id === selectedInvoiceId);
    return (currency || invoice?.currency || getCurrencyForClientType(selectedClient?.type as 'local' | 'international', 'USD')) as SupportedCurrency;
  };
  
  const selectedClient = (Array.isArray(clients) ? clients : clients?.page || []).find(c => c._id === (selectedClientId as any));
  const isLocalClient = selectedClient?.type === "local";
  const isInternationalClient = selectedClient?.type === "international";
  const gross = parseFloat(formData.amount || "0") || 0;
  
  // Check if withholding applies (local clients OR international clients using local bank accounts)
  let rate = 0;
  if (formData.applyWithholding) {
    if (isLocalClient) {
      rate = Math.max(0, parseFloat(formData.withholdingRate || "0"));
    } else if (isInternationalClient && selectedBankAccountId && bankAccounts) {
      const selectedBank = bankAccounts.find(bank => bank._id === selectedBankAccountId);
      if (selectedBank?.currency === "PKR") {
        rate = Math.max(0, parseFloat(formData.withholdingRate || "0"));
      }
    }
  }
  
  // Calculate withholding - for international payments to local banks, withhold after conversion
  let withheld = 0;
  let netCash = gross;
  
  if (rate > 0) {
    if (selectedClient?.type === 'international' && selectedBankAccountId && bankAccounts) {
      const selectedBank = bankAccounts.find(bank => bank._id === selectedBankAccountId);
      if (selectedBank?.currency === 'PKR' && formData.conversionRateToUSD) {
        // For international payments to PKR bank accounts: convert first, then withhold
        const convertedAmount = gross * parseFloat(formData.conversionRateToUSD);
        withheld = Math.round((convertedAmount * rate) / 100);
        netCash = Math.max(0, convertedAmount - withheld);
      } else {
        // For local payments or same currency: withhold on original amount
        withheld = Math.round((gross * rate) / 100);
        netCash = Math.max(0, gross - withheld);
      }
    } else {
      // For local payments: withhold on original amount
      withheld = Math.round((gross * rate) / 100);
      netCash = Math.max(0, gross - withheld);
    }
  }

  // Check if withholding should be shown (local clients OR international clients using local bank accounts)
  let isInternationalUsingLocalBank = false;
  if (selectedClient?.type === 'international' && selectedBankAccountId && bankAccounts) {
    const selectedBank = bankAccounts.find(bank => bank._id === selectedBankAccountId);
    isInternationalUsingLocalBank = selectedBank?.currency === 'PKR';
  }
  const shouldShowWithholding = isLocalClient || isInternationalUsingLocalBank;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Payment"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-4">
              {/* Payment Type moved below invoice selection per request */}

              {/* Customer Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer *
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => {
                    setSelectedClientId(e.target.value);
                    setSelectedInvoiceId("");
                  }}
                  required
                  disabled={!!preselectedClientId}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary disabled:bg-gray-50"
                >
                  <option value="">Select a customer</option>
                  {(Array.isArray(clients) ? clients : clients?.page || []).map(client => (
                    <option key={client._id} value={client._id}>
                      {client.name} ({client.type === "international" ? "International" : "Local"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Invoice Selector */}
              {selectedClientId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Invoice *
                  </label>
                  <select
                    value={selectedInvoiceId}
                    onChange={(e) => setSelectedInvoiceId(e.target.value)}
                    required
                    disabled={!!preselectedInvoiceId}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary disabled:bg-gray-50"
                  >
                    <option value="">Select an invoice</option>
                    {unpaidInvoices?.map(invoice => (
                      <option key={invoice._id} value={invoice._id}>
                        {invoice.invoiceNumber && invoice.invoiceNumber.trim() !== ""
                          ? invoice.invoiceNumber
                          : "Invoice #" + invoice._id.slice(-8)
                        } - {(() => {
                          // Show remaining amount (Total - Paid)
                          const remainingAmount = invoice.amount - invoice.totalPaid;
                          return formatCurrency(remainingAmount, invoice.currency as SupportedCurrency);
                        })()} remaining
                      </option>
                    ))}
                  </select>
                  {unpaidInvoices?.length === 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      No unpaid invoices for this customer
                    </p>
                  )}
                </div>
              )}

              {/* Selected Invoice Details */}
              {selectedInvoiceId && unpaidInvoices && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm text-gray-600 mb-2">
                    Invoice Details:
                  </p>
                  {(() => {
                    const invoice = unpaidInvoices.find(inv => inv._id === selectedInvoiceId);
                    if (!invoice) return null;
                    
                    const remainingAmount = invoice.amount - invoice.totalPaid;
                    const shouldShowOutstanding = invoice.order?.status === "shipped" || invoice.order?.status === "delivered";
                    const receivablesAmount = shouldShowOutstanding ? invoice.outstandingBalance : 0;
                    
                    return (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">Total Amount:</span>
                          <div className="font-semibold text-gray-900">
                            {formatCurrency(invoice.amount, invoice.currency as SupportedCurrency)}
                          </div>
                        </div>
                        
                        <div>
                          <span className="font-medium text-gray-700">Paid:</span>
                          <div className="font-semibold text-green-600">
                            {formatCurrency(invoice.totalPaid, invoice.currency as SupportedCurrency)}
                            {invoice.advancePaid > 0 && (
                              <div className="text-xs text-blue-600">
                                ({formatCurrency(invoice.advancePaid, invoice.currency as SupportedCurrency)} advance)
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <span className="font-medium text-gray-700">Remaining:</span>
                          <div className="font-semibold text-orange-600">
                            {formatCurrency(remainingAmount, invoice.currency as SupportedCurrency)}
                          </div>
                        </div>
                        
                        <div>
                          <span className="font-medium text-gray-700">Receivables:</span>
                          <div className="font-semibold text-primary">
                            {formatCurrency(receivablesAmount, invoice.currency as SupportedCurrency)}
                            {!shouldShowOutstanding && (
                              <div className="text-xs text-gray-500">
                                (Order not shipped yet)
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Payment Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Amount *
                </label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  required
                  min="0.01"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                />
              </div>

              {/* Payment Method intentionally removed — only Bank Transfer is supported */}


              {/* Conversion Rate - Only when invoice currency differs from bank account currency */}
              {selectedClient?.type === 'international' && selectedInvoiceId && selectedBankAccountId && unpaidInvoices && bankAccounts && (() => {
                const invoice = unpaidInvoices.find(inv => inv._id === selectedInvoiceId);
                const selectedBank = bankAccounts.find(bank => bank._id === selectedBankAccountId);
                
                // Only show conversion rate if currencies don't match
                if (!invoice || !selectedBank || invoice.currency === selectedBank.currency) return null;
                
                return (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Conversion Rate *
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={formData.conversionRateToUSD}
                        onChange={(e) => setFormData(prev => ({ ...prev, conversionRateToUSD: e.target.value }))}
                        min="0"
                        step="0.0001"
                        placeholder={(() => {
                          const suggested = getSuggestedExchangeRate(invoice.currency, selectedBank.currency);
                          return suggested ? `e.g. ${suggested}` : "Enter rate";
                        })()}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                        required
                      />
                      <div className="text-xs text-gray-500">
                        1 {invoice.currency} = ? {selectedBank.currency}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Required when paying {invoice.currency} invoice with {selectedBank.currency} bank account.
                    </p>
                    
                    {/* Conversion and Withholding Breakdown */}
                    {formData.conversionRateToUSD && formData.amount && (
                      <div className="mt-2 bg-blue-50 rounded-md p-3 text-sm">
                        <div className="text-gray-600 mb-2 font-medium">Conversion & Withholding Breakdown:</div>
                        
                        {/* Step 1: Original Amount */}
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-gray-600">1. Original Amount:</span>
                          <span className="font-medium">{formatCurrency(parseFloat(formData.amount), invoice.currency as SupportedCurrency)}</span>
                        </div>
                        
                        {/* Step 2: Converted Amount */}
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-gray-600">2. Converted to {selectedBank.currency}:</span>
                          <span className="font-medium text-blue-800">
                            {formatCurrency(parseFloat(formData.amount) * parseFloat(formData.conversionRateToUSD), selectedBank.currency as SupportedCurrency)}
                          </span>
                        </div>
                        
                        {/* Step 3: Tax Withheld (if applicable) */}
                        {formData.applyWithholding && rate > 0 && (
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-gray-600">3. Tax Withheld ({rate}%):</span>
                            <span className="font-medium text-orange-600">
                              -{formatCurrency(Math.round((parseFloat(formData.amount) * parseFloat(formData.conversionRateToUSD) * rate) / 100), selectedBank.currency as SupportedCurrency)}
                            </span>
                          </div>
                        )}
                        
                        {/* Step 4: Net Amount */}
                        <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                          <span className="text-gray-700 font-medium">4. Net Amount Deposited:</span>
                          <span className="font-bold text-green-700">
                            {formatCurrency(
                              Math.max(0, 
                                parseFloat(formData.amount) * parseFloat(formData.conversionRateToUSD) - 
                                (formData.applyWithholding && rate > 0 ? Math.round((parseFloat(formData.amount) * parseFloat(formData.conversionRateToUSD) * rate) / 100) : 0)
                              ), 
                              selectedBank.currency as SupportedCurrency
                            )}
                          </span>
                        </div>
                        
                        {/* Conversion Formula */}
                        <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-blue-200">
                          Conversion: {formData.amount} {invoice.currency} × {formData.conversionRateToUSD} = {formatCurrency(parseFloat(formData.amount) * parseFloat(formData.conversionRateToUSD), selectedBank.currency as SupportedCurrency)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Withholding (local clients OR international clients using local bank accounts) */}
              {shouldShowWithholding && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {isLocalClient ? 'Income Tax Withheld?' : 'Tax Withheld?'}
                    </label>
                    <input
                      type="checkbox"
                      checked={formData.applyWithholding}
                      onChange={(e) => setFormData(prev => ({ ...prev, applyWithholding: e.target.checked }))}
                    />
                  </div>
                  {formData.applyWithholding && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-700">Rate (%)</label>
                      <input
                        type="number"
                        value={formData.withholdingRate}
                        onChange={(e) => setFormData(prev => ({ ...prev, withholdingRate: e.target.value }))}
                        min="0"
                        step="0.01"
                        placeholder="e.g. 4 or 5"
                        className="w-28 px-2 py-1 border rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                      />
                      <div className="text-xs text-gray-500">Custom rate allowed</div>
                    </div>
                  )}
                  
                  {/* Preview - Show gross amount in both currencies for international payments */}
                  {formData.applyWithholding && (
                    <div className="bg-gray-50 rounded-md p-3 text-sm grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-gray-600">Gross Amount</div>
                        <div className="font-semibold">{formatCurrency(gross, getCurrencyForDisplay())}</div>
                        {/* Show PKR equivalent for international payments */}
                        {selectedClient?.type === 'international' && selectedBankAccountId && bankAccounts && formData.conversionRateToUSD && (() => {
                          const selectedBank = bankAccounts.find(bank => bank._id === selectedBankAccountId);
                          if (selectedBank?.currency === 'PKR') {
                            return (
                              <div className="text-xs text-gray-500 mt-1">
                                = {formatCurrency(gross * parseFloat(formData.conversionRateToUSD), selectedBank.currency as any)}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <div>
                        <div className="text-gray-600">Withheld ({rate || 0}%)</div>
                        <div className="font-semibold">
                          {(() => {
                            if (selectedClient?.type === 'international' && selectedBankAccountId && bankAccounts) {
                              const selectedBank = bankAccounts.find(bank => bank._id === selectedBankAccountId);
                              if (selectedBank?.currency === 'PKR' && formData.conversionRateToUSD) {
                                return formatCurrency(withheld, selectedBank.currency as any);
                              }
                            }
                            return formatCurrency(withheld, getCurrencyForDisplay());
                          })()}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-gray-600">Net Cash to Deposit</div>
                        <div className="font-semibold">
                          {(() => {
                            if (selectedClient?.type === 'international' && selectedBankAccountId && bankAccounts) {
                              const selectedBank = bankAccounts.find(bank => bank._id === selectedBankAccountId);
                              if (selectedBank?.currency === 'PKR' && formData.conversionRateToUSD) {
                                return formatCurrency(netCash, selectedBank.currency as any);
                              }
                            }
                            return formatCurrency(netCash, getCurrencyForDisplay());
                          })()}
                        </div>
                      </div>
                      {selectedInvoiceId && unpaidInvoices && (() => {
                        const inv = unpaidInvoices.find(i => i._id === selectedInvoiceId);
                        if (!inv) return null;
                        // Only calculate outstanding for shipped/delivered orders
                        const shouldShowOutstanding = inv.order?.status === "shipped" || inv.order?.status === "delivered";
                        const currentOutstanding = shouldShowOutstanding ? inv.outstandingBalance : 0;
                        const newOutstanding = Math.max(0, currentOutstanding - gross);
                        return (
                          <div className="col-span-2">
                            <div className="text-gray-600">Receivables after this payment</div>
                            <div className="font-semibold text-primary">{formatCurrency(newOutstanding, getCurrencyForDisplay())}</div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Bank Account Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bank Account *
                </label>
                <select
                  value={selectedBankAccountId}
                  onChange={handleBankAccountChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                >
                  <option value="">Select a bank account</option>
                  {bankAccounts?.filter(account => {
                    // For local payments, use PKR bank accounts
                    // For international payments, allow USD, EUR, AED, and PKR bank accounts
                    if (selectedClient?.type === 'local') {
                      return account.status === 'active' && account.currency === 'PKR';
                    } else {
                      return account.status === 'active' && ['USD', 'EUR', 'AED', 'PKR'].includes(account.currency);
                    }
                  }).map(account => (
                    <option key={account._id} value={account._id}>
                      {account.accountName} - {account.bankName} ({account.currency})
                    </option>
                  ))}
                </select>
                
                {/* Warning message when bank account is changed from original */}
                {showBankWarning && originalBankAccountId && unpaidInvoices && bankAccounts && (() => {
                  const invoice = unpaidInvoices.find(inv => inv._id === selectedInvoiceId);
                  const originalBank = bankAccounts.find(bank => bank._id === originalBankAccountId);
                  return (
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-yellow-800">
                            Bank Account Changed
                          </h3>
                          <div className="mt-1 text-sm text-yellow-700">
                            <p>
                              You're recording this payment in a different bank account than specified in the original order.
                            </p>
                            {originalBank && (
                              <p className="mt-1 font-medium">
                                Original order was set for: <span className="font-semibold">{originalBank.accountName} - {originalBank.bankName} ({originalBank.currency})</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Advance toggle placed after bank account */}
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-700">Is this an advance payment?</span>
                <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
                  <button
                    type="button"
                    className={`px-3 py-1 text-sm ${!isAdvancePayment ? "bg-primary text-white" : "bg-white text-gray-700"}`}
                    onClick={() => setIsAdvancePayment(false)}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 text-sm ${isAdvancePayment ? "bg-primary text-white" : "bg-white text-gray-700"}`}
                    onClick={() => setIsAdvancePayment(true)}
                  >
                    Yes
                  </button>
                </div>
              </div>

              {/* Reference */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference Number *
                </label>
                <input
                  type="text"
                  name="reference"
                  value={formData.reference}
                  onChange={handleChange}
                  required
                  placeholder="Transaction ID, Check number, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                />
              </div>

              {/* Payment Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Date *
                </label>
                <input
                  type="date"
                  name="paymentDate"
                  value={formData.paymentDate}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                  placeholder="Additional notes about this payment..."
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !selectedClientId || !selectedInvoiceId}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Recording..." : "Record Payment"}
              </button>
            </div>
          </form>
    </Modal>
  );
}
