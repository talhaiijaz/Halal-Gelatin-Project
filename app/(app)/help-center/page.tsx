"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import toast from "react-hot-toast";
import {
  MessageSquare,
  Bug,
  Lightbulb,
  Settings,
  Ticket,
  Send,
  Trash2,
  Calendar,
  Eye,
} from "lucide-react";
import Modal from "../../components/ui/Modal";

const categoryIcons = {
  bug_report: Bug,
  feature_request: Lightbulb,
  improvement: Settings,
  general_feedback: MessageSquare,
};

const categoryLabels = {
  bug_report: "Bug Report",
  feature_request: "Feature Request",
  improvement: "Improvement",
  general_feedback: "General Feedback",
};

export default function HelpCenterPage() {
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "general_feedback" as "general_feedback" | "bug_report" | "feature_request",
  });

  // Modal state
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Convex mutations and queries
  const submitFeedback = useMutation(api.feedback.submitFeedback);
  const deleteFeedback = useMutation(api.feedback.deleteFeedback);
  const allTickets = useQuery(api.feedback.getAllFeedback, {});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await submitFeedback({
        title: formData.title,
        description: formData.description,
        category: formData.category,
        submittedBy: "Admin User", // In a real app, this would come from auth context
      });

      toast.success("Ticket created successfully!");
      setFormData({
        title: "",
        description: "",
        category: "general_feedback",
      });
    } catch (error) {
      toast.error("Failed to create ticket");
      console.error(error);
    }
  };

  const handleDelete = async (ticketId: string) => {
    if (!confirm("Are you sure you want to delete this ticket?")) return;

    try {
      await deleteFeedback({ feedbackId: ticketId as Id<"feedback"> });
      toast.success("Ticket deleted successfully!");
    } catch (error) {
      toast.error("Failed to delete ticket");
      console.error(error);
    }
  };

  const handleViewTicket = (ticket: any) => {
    setSelectedTicket(ticket);
    setIsDetailModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsDetailModalOpen(false);
    setSelectedTicket(null);
  };

  // TicketDetailModal component
  const TicketDetailModal = () => {
    if (!selectedTicket) return null;

    const CategoryIcon = categoryIcons[selectedTicket.category as keyof typeof categoryIcons];

    return (
      <Modal
        isOpen={isDetailModalOpen}
        onClose={handleCloseModal}
        title="Ticket Details"
        maxWidth="lg"
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <CategoryIcon className="h-6 w-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {selectedTicket.title}
              </h3>
              <div className="flex items-center space-x-3">
                <span className="px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-600">
                  {categoryLabels[selectedTicket.category as keyof typeof categoryLabels]}
                </span>
                <div className="flex items-center space-x-1 text-sm text-gray-500">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(selectedTicket.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
            <p className="text-gray-900 whitespace-pre-wrap">{selectedTicket.description}</p>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Submitted By</h4>
              <p className="text-gray-900">{selectedTicket.submittedBy}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Created</h4>
              <p className="text-gray-900">{new Date(selectedTicket.createdAt).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </Modal>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Ticket className="h-8 w-8 text-orange-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Help Center</h1>
              <p className="mt-1 text-gray-600">
                Create support tickets and track your requests
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create Ticket Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center space-x-2 mb-6">
                <Send className="h-5 w-5 text-orange-600" />
                <h2 className="text-xl font-semibold text-gray-900">Create New Ticket</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Brief description of your request"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as "general_feedback" | "bug_report" | "feature_request" })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="general_feedback">General Feedback</option>
                    <option value="bug_report">Bug Report</option>
                    <option value="feature_request">Feature Request</option>
                    <option value="improvement">Improvement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Please provide detailed information about your request..."
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-orange-600 text-white py-3 px-4 rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors font-medium"
                >
                  <Send className="inline h-4 w-4 mr-2" />
                  Create Ticket
                </button>
              </form>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Ticket Overview</h3>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600 mb-2">
                  {allTickets?.length || 0}
                </div>
                <p className="text-sm text-gray-600">Total Tickets</p>
              </div>
            </div>

            {/* Recent Tickets Preview */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Tickets</h3>
              <div className="space-y-2">
                {allTickets?.slice(0, 3).map((ticket) => {
                  const CategoryIcon = categoryIcons[ticket.category as keyof typeof categoryIcons];
                  
                  return (
                    <div key={ticket._id} className="flex items-center space-x-2 text-sm">
                      <CategoryIcon className="h-4 w-4 text-gray-400" />
                      <span className="flex-1 truncate">{ticket.title}</span>
                    </div>
                  );
                })}
                
                {(!allTickets || allTickets.length === 0) && (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    No tickets yet. Create your first ticket!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* All Tickets Section */}
        <div className="mt-8 bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">All Tickets</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {allTickets?.map((ticket) => {
                const CategoryIcon = categoryIcons[ticket.category as keyof typeof categoryIcons];
                
                return (
                  <div key={ticket._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <CategoryIcon className="h-5 w-5 text-gray-400" />
                          <h4 className="text-lg font-medium text-gray-900">
                            {ticket.title}
                          </h4>
                          <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                            {categoryLabels[ticket.category as keyof typeof categoryLabels]}
                          </span>
                        </div>
                        
                        <p className="text-gray-600 mb-3 line-clamp-2">{ticket.description}</p>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4" />
                            <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                          </div>
                          <span>by {ticket.submittedBy}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleViewTicket(ticket)}
                          className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View full ticket details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(ticket._id)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete ticket"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {(!allTickets || allTickets.length === 0) && (
                <div className="text-center py-12">
                  <Ticket className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No tickets yet</h3>
                  <p className="text-gray-600">Create your first support ticket to get started.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ticket Detail Modal */}
      <TicketDetailModal />
    </div>
  );
}
