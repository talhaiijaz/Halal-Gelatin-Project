# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gelatin Manufacturing CRM - Internal B2B system for managing clients, orders, and finances with real-time synchronization using Convex.

## Tech Stack
- **Backend**: Convex (real-time database with reactive queries)
- **Frontend**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS (Softr-style design with white cards, #B8621B orange accent)
- **State Management**: Convex subscriptions for real-time sync

## Key Architecture Principles

### Real-Time Data Synchronization
- ALL data operations go through Convex mutations/queries
- Use `useQuery` for reactive data subscriptions
- Use `useMutation` for data modifications with optimistic updates
- Payment updates must sync instantly across all views (order detail, finance page)
- Never cache data locally - let Convex handle reactivity

### Authentication Flow
- Token-based auth using Convex sessions table
- Store token in localStorage/cookie
- Pass token to protected mutations via `withAuth` helper
- Session expiry: 7 days

### Database Schema Structure
- **Core Tables**: users, clients, orders, orderItems, invoices, payments, deliveries
- **Finance Tables**: bankAccounts, transactions
- **Auth Tables**: sessions
- **Key Relationships**:
  - Orders → Clients (many-to-one)
  - OrderItems → Orders (many-to-one)
  - Invoices → Orders (one-to-one)
  - Payments → Invoices (many-to-one)
  - Deliveries → Orders (one-to-one)

### Module Structure

#### 1. Auth Module
- Simple token-based authentication (already implemented in convex/auth.ts)
- Components needed: LoginForm, AuthProvider, useAuth hook

#### 2. Layout Module
- Sidebar navigation: Home, Local Clients, International Clients, Finance
- Persistent layout wrapper with auth protection
- Mobile-responsive sidebar

#### 3. Clients Module
- **Dashboard Tab**: Stats cards (total clients, active orders, total revenue)
- **Orders Tab**: Table with filters (status, date range), sortable columns
- **Customers Tab**: Grid of customer cards with quick actions
- **Detail Views**: Full customer profile with order history

#### 4. Orders Module
- Order creation wizard with client selection
- Order items management (add/edit/remove)
- Automatic total calculation
- Status workflow: pending → confirmed → in_production → shipped → delivered
- Invoice generation trigger

#### 5. Finance Module
- **Dashboard**: Revenue charts, outstanding invoices, payment trends
- **Payments Page**: Record payments against invoices
- **Payment Recording Flow**:
  1. Select invoice
  2. Enter payment amount
  3. Update invoice status (due → partially_paid → paid)
  4. Update outstanding balance
  5. Create transaction record

### Component Patterns

#### Shared Hooks Pattern
```typescript
// hooks/useOrder.ts
export function useOrder(orderId: Id<"orders">) {
  const order = useQuery(api.orders.getOrder, { id: orderId });
  const updateStatus = useMutation(api.orders.updateOrderStatus);
  return { order, updateStatus };
}

// hooks/useClient.ts  
export function useClient(clientId: Id<"clients">) {
  const client = useQuery(api.clients.getClient, { id: clientId });
  const orders = useQuery(api.orders.listOrders, { clientId });
  return { client, orders };
}

// hooks/useInvoice.ts
export function useInvoice(invoiceId: Id<"invoices">) {
  const invoice = useQuery(api.invoices.getInvoice, { id: invoiceId });
  const payments = useQuery(api.payments.getPayments, { invoiceId });
  const recordPayment = useMutation(api.invoices.recordPayment);
  return { invoice, payments, recordPayment };
}
```

#### Auto-Calculation Pattern
- Order totals: Sum of (quantity * unitPrice) for all items
- Invoice balance: amount - totalPaid
- Status updates: Automatic based on payment amounts

### Development Commands

```bash
# Install dependencies
npm install

# Run Convex development server
npx convex dev

# Run Next.js development server
npm run dev

# Initialize Convex project (if not done)
npx convex init

# Deploy Convex functions
npx convex deploy

# Create initial admin user (run once)
npx convex run auth:createInitialAdmin --email admin@example.com --password password123 --name "Admin User"
```

### Implementation Priority

1. **Auth Setup** (Day 1)
   - Login page with form
   - Auth context provider
   - Protected route wrapper

2. **Layout & Navigation** (Day 1)
   - Sidebar component
   - Route structure
   - Mobile responsiveness

3. **Clients Module** (Day 2)
   - List view with filters
   - Customer cards grid
   - Client detail page
   - Create/edit forms

4. **Orders Module** (Day 3)
   - Order list table
   - Order creation flow
   - Order detail with items
   - Status management

5. **Finance Module** (Day 4)
   - Finance dashboard
   - Payment recording
   - Invoice management
   - Transaction history

6. **Real-time Testing** (Day 5)
   - Multi-tab testing
   - Payment sync verification
   - Status update propagation

### Critical Implementation Notes

#### Payment Synchronization
The payment recording system MUST update in real-time across all views:
- When recording from Order Detail → updates Finance dashboard instantly
- When recording from Finance page → updates Order Detail instantly
- Use Convex subscriptions, not polling or manual refresh

#### Status Management
Invoice statuses auto-update based on payments:
```typescript
// In recordPayment mutation
const newTotalPaid = invoice.totalPaid + payment.amount;
const newBalance = invoice.amount - newTotalPaid;
const newStatus = newBalance === 0 ? "paid" : 
                  newTotalPaid > 0 ? "partially_paid" : 
                  invoice.status;
```

#### Error Handling
- All mutations should return success/error states
- Display user-friendly error messages
- Handle network failures gracefully
- Implement optimistic updates for better UX

### UI/UX Guidelines

#### Design System
- **Primary Color**: #B8621B (orange accent)
- **Card Style**: White background with subtle shadow
- **Spacing**: Consistent 4/8/16/24px grid
- **Typography**: Clean, modern sans-serif
- **States**: Hover effects on interactive elements
- **Icons**: Use lucide-react or heroicons

#### Responsive Design
- Mobile-first approach
- Sidebar collapses to hamburger menu on mobile
- Tables become cards on small screens
- Forms stack vertically on mobile

### Testing Checklist
- [ ] Auth flow (login/logout/session persistence)
- [ ] Real-time data sync across tabs
- [ ] Payment recording from multiple entry points
- [ ] Order status workflow
- [ ] Invoice status auto-updates
- [ ] Mobile responsiveness
- [ ] Error state handling
- [ ] Loading states
- [ ] Empty states

### Common Patterns to Follow

1. **Always use Convex queries for data fetching** - no direct API calls
2. **Implement loading states** while queries are pending
3. **Show optimistic updates** for better perceived performance
4. **Use TypeScript** for all components and hooks
5. **Follow Next.js 14 App Router** conventions
6. **Implement proper error boundaries** for fault tolerance
7. **Use Tailwind utility classes** consistently
8. **Keep components small and focused** - single responsibility
9. **Extract repeated logic into custom hooks**
10. **Test real-time sync** by opening multiple browser tabs

### MCP Integration
When implementing, use `mcp-server-nia:search_documentation` to look up:
- Convex real-time subscription patterns
- Optimistic update implementation
- Reactive query best practices
- Convex-React integration patterns