"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { UserButton, useUser, useClerk } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { canAccessRoute, type Role } from "@/app/utils/rolePermissions";
import {
  Home,
  Users,
  DollarSign,
  Menu,
  X,
  ChevronDown,
  Package,
  Settings,
  Activity,
  Truck,
  HelpCircle,
  FileText,
  BarChart3,
  LogOut,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  children?: { name: string; href: string }[];
}

const navigation: NavItem[] = [
  { name: "Home", href: "/home", icon: Home },
  { name: "Dashboard", href: "/dashboard", icon: BarChart3 },
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
  {
    name: "Production",
    href: "#",
    icon: BarChart3,
    children: [
      { name: "Production Detail", href: "/production/detail" },
      { name: "Outsource Detail", href: "/production/outsource" },
      { name: "Blending Sheet", href: "/production/blend" },
      { name: "Blends", href: "/production/blends" },
    ],
  },
  {
    name: "Users",
    href: "/users",
    icon: Users,
  },
];

export default function Sidebar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const pathname = usePathname();
  const { user } = useUser();
  const { signOut } = useClerk();
  const currentUserRole = useQuery(api.users.getCurrentUserRole);

  // Auto-expand parent items when on child pages
  useEffect(() => {
    const shouldExpand: string[] = [];
    filteredNavigation.forEach((item) => {
      if (item.children) {
        const hasActiveChild = item.children.filter(child => hasAccess(child.href)).some((child) => isActive(child.href));
        if (hasActiveChild) {
          shouldExpand.push(item.name);
        }
      }
    });
    setExpandedItems(shouldExpand);
  }, [pathname, currentUserRole]);

  const toggleExpanded = (itemName: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemName)
        ? prev.filter((name) => name !== itemName)
        : [...prev, itemName]
    );
  };

  const isActive = (href: string) => {
    if (href === "#") return false;
    if (href === "/") return pathname === "/";
    if (href === "/home") return pathname === "/home";
    if (href === "/dashboard") return pathname === "/dashboard";

    // For exact matches, use exact comparison
    if (href === "/production") return pathname === "/production";

    // For other paths, use startsWith but ensure it's not a partial match
    return pathname === href || (pathname?.startsWith(href) && pathname?.charAt(href.length) === "/");
  };

  const isParentActive = (item: NavItem) => {
    if (item.children) {
      return item.children.some((child) => isActive(child.href));
    }
    return isActive(item.href);
  };

  // Helper function to check if user has access to a navigation item
  const hasAccess = (route: string) => {
    if (!currentUserRole) return false; // Still loading
    return canAccessRoute(currentUserRole, route);
  };

      // Filter navigation items based on user role using centralized permissions
      const filteredNavigation = navigation.filter(item => {
        // Special handling for Dashboard - only show to admin
        if (item.href === "/dashboard" && currentUserRole !== "admin") {
          return false;
        }

        // Check access for main item (including Home)
        if (item.href !== "#" && !hasAccess(item.href)) return false;

        // For items with children, check if user has access to any child
        if (item.children) {
          return item.children.some(child => hasAccess(child.href));
        }

        return true;
      });

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
        {filteredNavigation.map((item) => {
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
                      {item.children.filter(child => hasAccess(child.href)).map((child) => (
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
              <p className="text-sm font-medium text-gray-900">
                {user?.fullName || user?.firstName || "User"}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {currentUserRole || "Loading..."}
              </p>
            </div>
          </div>
              <div className="space-y-1">
                {currentUserRole !== "production" && (
                  <>
                    <Link
                      href="/logs"
                      className="flex items-center px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Activity className="mr-3 h-4 w-4 text-gray-400" />
                      Logs
                    </Link>
                    <Link
                      href="/settings"
                      className="flex items-center px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Settings className="mr-3 h-4 w-4 text-gray-400" />
                      Settings
                    </Link>
                    <Link
                      href="/help-center"
                      className="flex items-center px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <HelpCircle className="mr-3 h-4 w-4 text-gray-400" />
                      Help Center
                    </Link>
                  </>
                )}
            <div className="flex items-center w-full px-3 py-2">
              {currentUserRole === "production" ? (
                <button
                  onClick={() => signOut({ redirectUrl: "/login" })}
                  className="flex items-center w-full px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <LogOut className="mr-3 h-4 w-4 text-gray-400" />
                  Sign Out
                </button>
              ) : (
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "w-8 h-8",
                      userButtonPopoverCard: "shadow-lg",
                      userButtonPopoverActionButton: "text-gray-700 hover:bg-gray-50"
                    }
                  }}
                  afterSignOutUrl="/login"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
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
            className="p-3 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
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
        <div className="lg:hidden fixed inset-0 z-40 flex" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <NavContent />
            <div className="mt-auto p-3 border-t border-gray-200">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-3 text-sm font-medium rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200 active:bg-gray-300"
              >
                Close Menu
              </button>
            </div>
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