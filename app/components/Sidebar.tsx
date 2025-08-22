"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Home,
  Users,
  Globe,
  MapPin,
  DollarSign,
  Menu,
  X,
  ChevronDown,
  Package,
  FileText,
  TrendingUp,
  Settings,
  LogOut,
  Activity,
  Truck,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  children?: { name: string; href: string }[];
}

const navigation: NavItem[] = [
  { name: "Home", href: "/dashboard", icon: Home },
  {
    name: "Clients",
    href: "#",
    icon: Users,
    children: [
      { name: "Local", href: "/clients/local" },
      { name: "International", href: "/clients/international" },
    ],
  },
  {
    name: "Orders",
    href: "/orders",
    icon: Package,
  },
  {
    name: "Finance",
    href: "/finance",
    icon: DollarSign,
  },
  {
    name: "Shipments",
    href: "/shipments",
    icon: Truck,
  },
];

export default function Sidebar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const pathname = usePathname();

  const toggleExpanded = (itemName: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemName)
        ? prev.filter((name) => name !== itemName)
        : [...prev, itemName]
    );
  };

  const isActive = (href: string) => {
    if (href === "#") return false;
    if (href === "/dashboard") return pathname === "/" || pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const isParentActive = (item: NavItem) => {
    if (item.children) {
      return item.children.some((child) => isActive(child.href));
    }
    return isActive(item.href);
  };

  const NavContent = () => (
    <>
      {/* Logo Section */}
      <div className="flex h-16 items-center px-6 border-b border-gray-200">
        <div className="flex items-center">
          <img
            src="/images/Logo-Final-Vector-22.png"
            alt="Halal Gelatin"
            className="h-10 w-auto"
          />
          <span className="ml-3 text-base font-semibold text-gray-900">Halal Gelatin</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isItemActive = isParentActive(item);
          const isExpanded = expandedItems.includes(item.name);

          return (
            <div key={item.name}>
              {item.children ? (
                <>
                  <button
                    onClick={() => toggleExpanded(item.name)}
                    className={`w-full group flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                      isItemActive
                        ? "bg-orange-50 text-primary"
                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <div className="flex items-center">
                      <Icon
                        className={`mr-3 h-5 w-5 ${
                          isItemActive ? "text-primary" : "text-gray-400"
                        }`}
                      />
                      {item.name}
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isExpanded && (
                    <div className="ml-9 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`block px-3 py-2 text-sm rounded-lg transition-colors ${
                            isActive(child.href)
                              ? "bg-orange-50 text-primary font-medium"
                              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          }`}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href={item.href}
                  className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    isItemActive
                      ? "bg-orange-50 text-primary"
                      : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon
                    className={`mr-3 h-5 w-5 ${
                      isItemActive ? "text-primary" : "text-gray-400"
                    }`}
                  />
                  {item.name}
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="border-t border-gray-200 p-4">
        <div className="space-y-3">
          <div className="flex items-center px-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Admin User</p>
              <p className="text-xs text-gray-500 capitalize">Administrator</p>
            </div>
          </div>
          <div className="space-y-1">
            <Link
              href="/settings"
              className="flex items-center px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Settings className="mr-3 h-4 w-4 text-gray-400" />
              Settings
            </Link>
            <Link
              href="/logs"
              className="flex items-center px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Activity className="mr-3 h-4 w-4 text-gray-400" />
              Logs
            </Link>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center">
            <img
              src="/images/Logo-Final-Vector-22.png"
              alt="Halal Gelatin"
              className="h-8 w-auto"
            />
            <span className="ml-2 text-sm font-semibold text-gray-900">Halal Gelatin</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile sidebar */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
            <NavContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-gray-200">
        <NavContent />
      </div>
    </>
  );
}