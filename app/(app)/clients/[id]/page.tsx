"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft,
  Mail, 
  Phone, 
  MapPin, 
  Globe,
  Building,
  Calendar,
  Package,
  DollarSign,
  FileText,
  Edit,
  UserCheck,
  UserX,
  Plus,
  X
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { Id } from "@/convex/_generated/dataModel";
import CreateOrderModal from "@/app/components/orders/CreateOrderModal";
import OrderDetailModal from "@/app/components/orders/OrderDetailModal";
import ActivityLog from "@/app/components/ActivityLog";
import EditCustomerModal from "@/app/components/clients/EditCustomerModal";
import { formatCurrency, getCurrencyForClientType, type SupportedCurrency } from "@/app/utils/currencyFormat";

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as Id<"clients">;
  
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<Id<"orders"> | null>(null);
  const [isEditClientOpen, setIsEditClientOpen] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [ordersLimit, setOrdersLimit] = useState(10);

  // Fetch client data
  const client = useQuery(api.clients.get, { id: clientId });
  const updateClient = useMutation(api.clients.update);
  
  // Fetch all orders for this client
  const allOrders = useQuery(api.orders.list, { clientId });

  const getClientCurrency = (clientType: string): SupportedCurrency => {
    return getCurrencyForClientType(clientType as 'local' | 'international', 'USD');
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return "🕐";
      case "in_production":
        return "🏭";
      case "shipped":
        return "🚚";
      case "delivered":
        return "📦";
      case "cancelled":
        return "❌";
      default:
        return "❓";
    }
  };

  const handleStatusToggle = async () => {
    if (!client) return;
    
    try {
      await updateClient({
        id: clientId,
        status: client.status === "active" ? "inactive" : "active",
      });
      toast.success(`Client ${client.status === "active" ? "deactivated" : "activated"} successfully`);
    } catch (error) {
      toast.error("Failed to update client status");
    }
  };


  if (!client) {
    return (
      <div>
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <Skeleton width={100} height={40} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Skeleton width={200} height={32} />
              <Skeleton width={150} height={16} className="mt-2" />
            </div>
            <div className="flex gap-3">
              <Skeleton width={120} height={40} />
              <Skeleton width={100} height={40} />
            </div>
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="card p-6">
              <Skeleton width={150} height={24} className="mb-4" />
              <div className="space-y-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i}>
                    <Skeleton width={100} height={16} />
                    <Skeleton width={180} height={20} className="mt-1" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="card p-6">
              <Skeleton width={150} height={24} className="mb-4" />
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} width="100%" height={60} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <Link
            href={`${client.type === 'local' ? '/clients/local' : '/clients/international'}?tab=customers`}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to {client.type === 'local' ? 'Local' : 'International'} Clients
          </Link>
        </div>
        
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            {/* Client Profile Picture */}
            <div className="flex-shrink-0">
              {client.profilePictureId ? (
                <div className="relative">
                  <img
                    src={`/api/files/${client.profilePictureId}`}
                    alt={client.name}
                    className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
                    onError={(e) => {
                      // Hide the image and show fallback
                      const img = e.currentTarget;
                      const fallback = img.nextElementSibling as HTMLElement;
                      img.style.display = 'none';
                      if (fallback) fallback.classList.remove('hidden');
                    }}
                  />
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center hidden border-4 border-white shadow-lg">
                    <Building className="h-8 w-8 text-primary" />
                  </div>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-4 border-white shadow-lg">
                  <Building className="h-8 w-8 text-primary" />
                </div>
              )}
            </div>

            {/* Client Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center min-w-0">
                <span className="truncate" title={client.name}>
                  {client.name}
                </span>
                <span className={`ml-3 flex-shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  client.type === 'local' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-purple-100 text-purple-800'
                }`}>
                  {client.type === 'local' ? <MapPin className="h-3 w-3 mr-1" /> : <Globe className="h-3 w-3 mr-1" />}
                  {client.type}
                </span>
              </h1>
              <p className="mt-1 text-sm text-gray-600 truncate" title={`Contact: ${client.contactPerson}`}>
                Contact: {client.contactPerson}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setIsEditClientOpen(true)}
              className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Client
            </button>
            
            <button
              onClick={handleStatusToggle}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                client.status === 'active'
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {client.status === 'active' ? (
                <>
                  <UserX className="h-4 w-4 mr-2" />
                  Deactivate
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Activate
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Information */}
        <div className="lg:col-span-1">
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Building className="h-5 w-5 mr-2" />
              Client Information
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    client.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {client.status === 'active' ? <UserCheck className="h-3 w-3 mr-1" /> : <UserX className="h-3 w-3 mr-1" />}
                    {client.status}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <div className="mt-1 flex items-center text-sm text-gray-900">
                  <Mail className="h-4 w-4 mr-2 text-gray-400" />
                  <a href={`mailto:${client.email}`} className="hover:text-primary">
                    {client.email}
                  </a>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Phone</label>
                <div className="mt-1 flex items-center text-sm text-gray-900">
                  <Phone className="h-4 w-4 mr-2 text-gray-400" />
                  <a href={`tel:${client.phone}`} className="hover:text-primary">
                    {client.phone}
                  </a>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Address</label>
                <div className="mt-1 text-sm text-gray-900">
                  <div>{client.address}</div>
                  <div>{client.city}, {client.country}</div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Tax ID</label>
                <div className="mt-1 text-sm text-gray-900">{client.taxId}</div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Client Since</label>
                <div className="mt-1 flex items-center text-sm text-gray-900">
                  <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                  {formatDate(client.createdAt)}
                </div>
              </div>
            </div>
          </div>


          {/* Activity Log */}
          <div className="card p-6 mt-6">
            <button
              onClick={() => setIsActivityLogOpen(true)}
              className="w-full flex items-center justify-center px-4 py-3 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <FileText className="h-5 w-5 mr-2" />
              View Client Activity
            </button>
          </div>

        </div>

        {/* All Orders Section */}
        <div className="lg:col-span-2">
          {/* Quick Stats - moved above orders */}
          <div className="card p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h2>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <Package className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                <div className="text-lg font-semibold text-gray-900">{allOrders?.length || 0}</div>
                <div className="text-xs text-gray-600">Total Orders</div>
              </div>
              
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <DollarSign className="h-6 w-6 text-red-600 mx-auto mb-1" />
                <div className="text-xs text-gray-600">Receivables</div>
                {client.type === 'international' && client.outstandingByCurrency ? (
                  <div className="mt-1 space-y-1">
                    {Object.entries(client.outstandingByCurrency)
                      .filter(([_, amount]) => (amount as number) > 0)
                      .map(([currency, amount]) => (
                        <div key={currency} className="text-sm font-semibold text-gray-900">
                          {formatCurrency(amount as number, currency as SupportedCurrency)}
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-lg font-semibold text-gray-900 mt-1">
                    {formatCurrency(client.outstandingAmount || 0, getClientCurrency(client.type))}
                  </div>
                )}
              </div>

              <div className="text-center p-3 bg-green-50 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600 mx-auto mb-1" />
                <div className="text-xs text-gray-600">Total Revenue</div>
                <div className="text-lg font-semibold text-gray-900 mt-1">
                  {allOrders ? formatCurrency(
                    allOrders.reduce((sum, order) => {
                      if (order.invoice) {
                        return sum + (order.invoice.totalPaid || 0);
                      }
                      return sum;
                    }, 0),
                    getClientCurrency(client.type)
                  ) : formatCurrency(0, getClientCurrency(client.type))}
                </div>
              </div>
            </div>
          </div>

          {/* All Orders */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Package className="h-5 w-5 mr-2" />
                All Orders
              </h2>
              <button
                onClick={() => setIsCreateOrderOpen(true)}
                className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Order
              </button>
            </div>
            
            {allOrders && allOrders.length > 0 ? (
              <div>
                <div className="space-y-3">
                  {allOrders.slice(0, ordersLimit).map((order) => (
                    <div 
                      key={order._id} 
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => setSelectedOrderId(order._id)}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{getStatusIcon(order.status)}</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {order.invoiceNumber || order.orderNumber}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(order.factoryDepartureDate || order.orderCreationDate || order.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {formatCurrency(order.totalAmount, order.currency as SupportedCurrency)}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">
                          {order.status.replace("_", " ")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                
                {allOrders.length > ordersLimit && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => setOrdersLimit(ordersLimit + 10)}
                      className="px-4 py-2 text-sm text-primary hover:text-primary-dark border border-primary rounded-lg hover:bg-primary/5 transition-colors"
                    >
                      Load More Orders ({allOrders.length - ordersLimit} remaining)
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No orders yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  This client hasn't placed any orders yet.
                </p>
                <div className="mt-4">
                  <button
                    onClick={() => setIsCreateOrderOpen(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Order
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Order Modal */}
      <CreateOrderModal
        isOpen={isCreateOrderOpen}
        onClose={() => setIsCreateOrderOpen(false)}
        preselectedClientId={clientId}
        onSuccess={() => {
          setIsCreateOrderOpen(false);
          toast.success("Order created successfully");
          // Refresh the page or refetch data
          router.refresh();
        }}
      />

      {/* Order Detail Modal */}
      <OrderDetailModal
        isOpen={selectedOrderId !== null}
        onClose={() => setSelectedOrderId(null)}
        orderId={selectedOrderId}
      />

      {/* Edit Client Modal */}
      <EditCustomerModal
        isOpen={isEditClientOpen}
        onClose={() => setIsEditClientOpen(false)}
        client={client}
      />

      {/* Activity Log Modal */}
      {isActivityLogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Client Activity</h2>
              <button
                onClick={() => setIsActivityLogOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <ActivityLog entityId={String(clientId)} entityTable="clients" title="" limit={50} />
          </div>
        </div>
      )}
    </div>
  );
}
