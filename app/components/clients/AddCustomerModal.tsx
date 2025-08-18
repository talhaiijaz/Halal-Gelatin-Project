"use client";

import { useState, useEffect } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { X, Search, Loader2 } from "lucide-react";

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "local" | "international";
}

export default function AddCustomerModal({ isOpen, onClose, type }: AddCustomerModalProps) {
  const createClient = useMutation(api.clients.create);
  const getCitiesByCountry = useAction(api.cities.getCitiesByCountry);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [citySearchTerm, setCitySearchTerm] = useState("");
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: type === "local" ? "Pakistan" : "",
    taxId: "",
  });

  // Predefined countries list
  const countries = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
    "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
    "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic",
    "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic",
    "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
    "Fiji", "Finland", "France",
    "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
    "Haiti", "Honduras", "Hungary",
    "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast",
    "Jamaica", "Japan", "Jordan",
    "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan",
    "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
    "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
    "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
    "Oman",
    "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
    "Qatar",
    "Romania", "Russia", "Rwanda",
    "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
    "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
    "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan",
    "Vanuatu", "Vatican City", "Venezuela", "Vietnam",
    "Yemen",
    "Zambia", "Zimbabwe"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createClient({
        ...formData,
        type,
        status: "active",
      });
      onClose();
      // Reset form
      setFormData({
        name: "",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        country: type === "local" ? "Pakistan" : "",
        taxId: "",
      });
      setCitySearchTerm("");
      setShowCityDropdown(false);

    } catch (error) {
      console.error("Failed to create client:", error);
      
      // Provide more specific error messages based on the error type
      let errorMessage = "Failed to create client. Please try again.";
      
      if (error instanceof Error) {
        const errorStr = error.message.toLowerCase();
        
        if (errorStr.includes("validation") || errorStr.includes("invalid")) {
          errorMessage = "Invalid client data. Please check all required fields and try again.";
        } else if (errorStr.includes("duplicate") || errorStr.includes("already exists")) {
          errorMessage = "A client with this name or contact information already exists. Please use a different name or contact details.";
        } else if (errorStr.includes("name") || errorStr.includes("company")) {
          errorMessage = "Company name is invalid or missing. Please provide a valid company name.";
        } else if (errorStr.includes("email") || errorStr.includes("contact")) {
          errorMessage = "Contact information is invalid. Please check email and phone number format.";
        } else if (errorStr.includes("network") || errorStr.includes("connection")) {
          errorMessage = "Network connection error. Please check your internet connection and try again.";
        } else if (errorStr.includes("permission") || errorStr.includes("unauthorized")) {
          errorMessage = "You don't have permission to create clients. Please contact your administrator.";
        } else {
          // For other errors, show the actual error message if it's not too technical
          const cleanMessage = error.message.replace(/^Error: /, '').replace(/^ConvexError: /, '');
          if (cleanMessage.length < 100 && !cleanMessage.includes('internal') && !cleanMessage.includes('server')) {
            errorMessage = `Error: ${cleanMessage}`;
          }
        }
      }
      
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));

    // If country changed, load cities for that country
    if (e.target.name === "country" && e.target.value) {
      loadCitiesForCountry(e.target.value);
    }
  };

  const loadCitiesForCountry = async (country: string) => {
    setIsLoadingCities(true);
    try {
      const cityList = await getCitiesByCountry({ country });
      setCities(cityList);
    } catch (error) {
      console.error("Failed to load cities:", error);
      // Don't show alert for city loading errors as they're not critical
    } finally {
      setIsLoadingCities(false);
    }
  };

  // Load cities when component mounts for local clients
  useEffect(() => {
    if (type === "local") {
      loadCitiesForCountry("Pakistan");
    }
  }, [type]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.city-dropdown-container')) {
        setShowCityDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter cities based on search term
  const filteredCities = cities.filter(city =>
    city.toLowerCase().includes(citySearchTerm.toLowerCase())
  );

  const handleCitySelect = (city: string) => {
    setFormData(prev => ({ ...prev, city }));
    setCitySearchTerm(city);
    setShowCityDropdown(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Add New {type === "local" ? "Local" : "International"} Customer
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

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <div className="relative city-dropdown-container">
                    <div className="flex items-center border border-gray-300 rounded-md focus-within:ring-primary focus-within:border-primary">
                      <input
                        type="text"
                        value={citySearchTerm}
                        onChange={(e) => {
                          setCitySearchTerm(e.target.value);
                          setShowCityDropdown(true);
                          setFormData(prev => ({ ...prev, city: e.target.value }));
                        }}
                        onFocus={() => setShowCityDropdown(true)}
                        placeholder={isLoadingCities ? "Loading cities..." : "Type to search cities"}
                        className="flex-1 px-3 py-2 focus:outline-none"
                        disabled={isLoadingCities}
                      />
                      {isLoadingCities ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin text-gray-400" />
                      ) : (
                        <Search className="h-4 w-4 mr-2 text-gray-400" />
                      )}
                    </div>
                    
                    {/* City Dropdown */}
                    {showCityDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {filteredCities.length > 0 ? (
                          filteredCities.map((city) => (
                            <button
                              key={city}
                              type="button"
                              onClick={() => handleCitySelect(city)}
                              className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                            >
                              {city}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-gray-500">
                            {citySearchTerm ? "No cities found" : "Select a country first"}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  {type === "local" ? (
                    <input
                      type="text"
                      name="country"
                      value="Pakistan"
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                    />
                  ) : (
                    <select
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary text-sm"
                      style={{ minWidth: '200px' }}
                    >
                      <option value="">Select a country</option>
                      {countries.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

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
                disabled={isSubmitting}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Adding..." : "Add Customer"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}