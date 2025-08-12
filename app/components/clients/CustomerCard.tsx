"use client";

import { MapPin, Building2, Phone, Mail } from "lucide-react";
import Link from "next/link";

interface CustomerCardProps {
  customer: {
    _id: string;
    name: string;
    city: string;
    country: string;
    contactPerson: string;
    email: string;
    phone: string;
    type: "local" | "international";
    status: "active" | "inactive";
  };
}

export default function CustomerCard({ customer }: CustomerCardProps) {
  return (
    <div className="card-hover p-6 flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Building2 className="h-5 w-5 text-gray-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 line-clamp-1">
              {customer.name}
            </h3>
            <p className="text-sm text-gray-600 mt-1">{customer.contactPerson}</p>
          </div>
        </div>
        <span
          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
            customer.status === "active"
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {customer.status}
        </span>
      </div>

      <div className="space-y-2 flex-1">
        <div className="flex items-center text-sm text-gray-600">
          <MapPin className="h-4 w-4 mr-2 text-gray-400" />
          <span>
            {customer.city}, {customer.country}
          </span>
        </div>
        <div className="flex items-center text-sm text-gray-600">
          <Mail className="h-4 w-4 mr-2 text-gray-400" />
          <span className="truncate">{customer.email}</span>
        </div>
        <div className="flex items-center text-sm text-gray-600">
          <Phone className="h-4 w-4 mr-2 text-gray-400" />
          <span>{customer.phone}</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <Link
          href={`/clients/${customer._id}`}
          className="w-full btn-primary text-center text-sm"
        >
          Open
        </Link>
      </div>
    </div>
  );
}