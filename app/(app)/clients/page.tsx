"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { 
  Plus, 
  Search, 
  MapPin, 
  Globe, 
  Mail, 
  Phone, 
  Building,
  Download,
  Edit,
  UserCheck,
  UserX
} from "lucide-react";
import AddCustomerModal from "@/app/components/clients/AddCustomerModal";
import toast from "react-hot-toast";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function AllClientsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "local" | "international">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const clients = useQuery(api.clients.list, {
    type: typeFilter === "all" ? undefined : typeFilter,
    status: statusFilter === "all" ? undefined : statusFilter,
    search: searchTerm || undefined,
  });

  const updateClient = useMutation(api.clients.update);

  const handleStatusToggle = async (clientId: any, currentStatus: string) => {
    try {
      await updateClient({
        id: clientId,
        status: currentStatus === "active" ? "inactive" : "active",
      });
      toast.success(`Client ${currentStatus === "active" ? "deactivated" : "activated"} successfully`);
    } catch (error) {
      toast.error("Failed to update client status");
    }
  };

  const exportToCSV = () => {
    if (!clients) return;

    const csvContent = [
      ["Name", "Type", "Contact Person", "Email", "Phone", "City", "Country", "Status"],
      ...clients.map(client => [
        client.name,
        client.type,
        client.contactPerson,
        client.email,
        client.phone,
        client.city,
        client.country,
        client.status
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clients-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success("Clients exported successfully");
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Clients</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your complete client database
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Client
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="all">All Types</option>
          <option value="local">Local</option>
          <option value="international">International</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <div className="flex items-center text-sm text-gray-600">
          {clients ? `${clients.length} clients found` : <Skeleton width={100} />}
        </div>
      </div>

      {/* Clients Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {!clients ? (
                // Loading skeletons
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><Skeleton height={40} /></td>
                    <td className="px-6 py-4"><Skeleton width={80} /></td>
                    <td className="px-6 py-4"><Skeleton height={40} /></td>
                    <td className="px-6 py-4"><Skeleton width={150} /></td>
                    <td className="px-6 py-4"><Skeleton width={60} /></td>
                    <td className="px-6 py-4"><Skeleton width={80} /></td>
                  </tr>
                ))
              ) : clients.length === 0 ? (
                // Empty state
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Building className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No clients found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Get started by adding a new client to your database.
                    </p>
                    <div className="mt-6">
                      <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark"
                      >
                        <Plus className="h-5 w-5 mr-2" />
                        Add Client
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                // Client rows
                clients.map((client) => (
                  <tr key={client._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{client.name}</div>
                        <div className="text-sm text-gray-500">{client.contactPerson}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        client.type === 'local' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {client.type === 'local' ? <MapPin className="h-3 w-3 mr-1" /> : <Globe className="h-3 w-3 mr-1" />}
                        {client.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <div className="flex items-center">
                          <Mail className="h-3 w-3 mr-1 text-gray-400" />
                          {client.email}
                        </div>
                        <div className="flex items-center mt-1">
                          <Phone className="h-3 w-3 mr-1 text-gray-400" />
                          {client.phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {client.city}, {client.country}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        client.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {client.status === 'active' ? <UserCheck className="h-3 w-3 mr-1" /> : <UserX className="h-3 w-3 mr-1" />}
                        {client.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleStatusToggle(client._id, client.status)}
                        className="text-primary hover:text-primary-dark mr-3"
                      >
                        {client.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button className="text-gray-600 hover:text-gray-900">
                        <Edit className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Client Modal */}
      <AddCustomerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        type="local"
        onSuccess={() => {
          setIsAddModalOpen(false);
          toast.success("Client added successfully");
        }}
      />
    </div>
  );
}