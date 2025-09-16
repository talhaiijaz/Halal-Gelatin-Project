"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { X, Camera, Building } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import toast from "react-hot-toast";

interface Client {
  _id: Id<"clients">;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  taxId: string;
  type: "local" | "international";
  status: "active" | "inactive";
  profilePictureId?: Id<"_storage">;
}

interface EditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
}

export default function EditCustomerModal({ isOpen, onClose, client }: EditCustomerModalProps) {
  const updateClient = useMutation(api.clients.update);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    taxId: "",
    status: "active" as "active" | "inactive",
  });

  // Update form data when client changes
  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || "",
        contactPerson: client.contactPerson || "",
        email: client.email || "",
        phone: client.phone || "",
        address: client.address || "",
        city: client.city || "",
        country: client.country || "",
        taxId: client.taxId || "",
        status: client.status || "active",
      });
    }
  }, [client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

    setIsSubmitting(true);
    try {
      // Upload profile picture if selected
      let profilePictureId = client.profilePictureId;
      if (profilePicture) {
        const uploadedId = await uploadProfilePicture();
        if (uploadedId) {
          profilePictureId = uploadedId;
        }
      }

      const updateData: any = {
        id: client._id,
        ...formData,
      };
      
      // Only include profilePictureId if it's not null/undefined
      if (profilePictureId !== null && profilePictureId !== undefined) {
        updateData.profilePictureId = profilePictureId;
      }
      
      // Remove any empty string values to avoid validation issues
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === '') {
          delete updateData[key];
        }
      });
      
      await updateClient(updateData);
      
      toast.success("Client updated successfully");
      onClose();
    } catch (error) {
      console.error("Failed to update client:", error);
      
      // Show the actual error message for debugging
      let errorMessage = "Failed to update client. Please try again.";
      
      if (error instanceof Error) {
        // For now, show the actual error message to help debug
        const cleanMessage = error.message.replace(/^Error: /, '').replace(/^ConvexError: /, '');
        errorMessage = `Error: ${cleanMessage}`;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
      }

      setProfilePicture(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfilePicturePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadProfilePicture = async (): Promise<Id<"_storage"> | null> => {
    if (!profilePicture) return null;

    setIsUploadingPicture(true);
    try {
      // Get upload URL
      const uploadUrl = await generateUploadUrl();

      // Upload file to Convex storage
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": profilePicture.type },
        body: profilePicture,
      });

      const { storageId } = await result.json();
      return storageId;
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload profile picture');
      return null;
    } finally {
      setIsUploadingPicture(false);
    }
  };

  if (!isOpen || !client) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Edit {client.type === "local" ? "Local" : "International"} Customer
              </h2>
              <button
                onClick={onClose}
                className="rounded-lg p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-4">
              {/* Profile Picture Section */}
              <div className="flex items-center space-x-4 mb-6">
                <div className="flex-shrink-0">
                  {profilePicturePreview ? (
                    <img
                      src={profilePicturePreview}
                      alt="Profile preview"
                      className="w-16 h-16 rounded-full object-cover border-2 border-gray-300"
                    />
                  ) : client.profilePictureId ? (
                    <img
                      src={`/api/files/${client.profilePictureId}`}
                      alt={client.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-gray-300"
                      onError={(e) => {
                        const img = e.currentTarget;
                        const fallback = img.nextElementSibling as HTMLElement;
                        img.style.display = 'none';
                        if (fallback) fallback.classList.remove('hidden');
                      }}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-300">
                      <Building className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  {client.profilePictureId && !profilePicturePreview && (
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-300 hidden">
                      <Building className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="profile-picture-upload"
                  />
                  <label
                    htmlFor="profile-picture-upload"
                    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    {profilePicture ? 'Change Picture' : 'Upload Picture'}
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    JPG, PNG or GIF (max 5MB)
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter company name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Person
                </label>
                <input
                  type="text"
                  name="contactPerson"
                  value={formData.contactPerson}
                  onChange={handleChange}
                  placeholder="Enter contact person name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Enter email address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Enter phone number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Enter street address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="Enter city name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  {client.type === "local" ? (
                    <input
                      type="text"
                      name="country"
                      value="Pakistan"
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                    />
                  ) : (
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      placeholder="Enter country name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tax ID
                  </label>
                  <input
                    type="text"
                    name="taxId"
                    value={formData.taxId}
                    onChange={handleChange}
                    placeholder="Enter tax identification number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
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
                disabled={isSubmitting || isUploadingPicture}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (isUploadingPicture ? "Uploading Picture..." : "Updating...") : "Update Customer"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
