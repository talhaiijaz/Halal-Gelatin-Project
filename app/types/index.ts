// Type definitions for the Halal Gelatin Project

export interface Payment {
  _id: string;
  type: "invoice" | "advance";
  invoiceId?: string;
  clientId: string;
  amount: number;
  currency: string;
  paymentDate: number;
  method: "bank_transfer" | "check" | "cash" | "credit_card" | "other";
  reference: string;
  notes?: string;
  bankAccountId?: string;
  conversionRateToUSD?: number;
  convertedAmountUSD?: number;
  withholdingTax?: number;
  netAmount?: number;
  createdAt: number;
  createdBy: string;
}

export interface OrderItem {
  _id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  lotNumbers?: string[];
}

export interface Order {
  _id: string;
  orderNumber: string;
  invoiceNumber: string;
  clientId: string;
  status: "pending" | "in_production" | "shipped" | "delivered" | "cancelled";
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  orderDate: number;
  expectedDeliveryDate?: number;
  actualDeliveryDate?: number;
  notes?: string;
  shippingAddress?: string;
  shippingCompany?: string;
  shippingOrderNumber?: string;
  trackingNumber?: string;
  invoice?: string;
  createdAt: number;
  createdBy: string;
  fiscalYear: number;
}

export interface Invoice {
  _id: string;
  orderId?: string; // Optional for standalone invoices
  clientId: string;
  amount: number;
  currency: string;
  invoiceDate: number;
  issueDate: number;
  dueDate?: number;
  status: "unpaid" | "partially_paid" | "paid";
  orderItems?: OrderItem[];
  payments: Payment[];
  advancePaid?: number;
  invoicePaid?: number;
  outstandingBalance: number;
  totalPaid: number;
  invoiceNumber?: string;
  notes?: string;
  isStandalone?: boolean;
  source?: string;
  createdAt: number;
  createdBy?: string;
}

export interface Client {
  _id: string;
  name?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  type: "local" | "international";
  status: "active" | "inactive";
  profilePictureId?: string;
  outstandingBalance?: number;
  createdAt: number;
  createdBy?: string;
}

// Order status type for better type safety
export type OrderStatus = Order['status'];

// Payment method type for better type safety
export type PaymentMethod = Payment['method'];

// Payment type for better type safety
export type PaymentType = Payment['type'];
