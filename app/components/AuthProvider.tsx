"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { IdleWarning } from "./IdleWarning";

interface AuthContextType {
  isAuthenticated: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CREDENTIALS = {
  username: "local",
  password: "local"
};

// 15 minutes in milliseconds
const IDLE_TIMEOUT = 15 * 60 * 1000;
// Warning shows 1 minute before logout
const WARNING_TIMEOUT = 14 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const router = useRouter();
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isPageVisibleRef = useRef<boolean>(true);

  // Function to reset the idle timer
  const resetIdleTimer = () => {
    // Only reset if page is visible
    if (!isPageVisibleRef.current) {
      return;
    }
    
    lastActivityRef.current = Date.now();
    
    // Clear existing timers
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
    }
    
    // Hide warning if it's showing
    setShowWarning(false);
    
    if (isAuthenticated) {
      // Set warning timer (14 minutes)
      warningTimerRef.current = setTimeout(() => {
        setShowWarning(true);
      }, WARNING_TIMEOUT);
      
      // Set logout timer (15 minutes)
      idleTimerRef.current = setTimeout(() => {
        handleIdleLogout();
      }, IDLE_TIMEOUT);
    }
  };

  // Function to handle idle logout
  const handleIdleLogout = () => {
    toast.error("Session expired due to inactivity. Please log in again.");
    logout();
  };

  // Function to extend session
  const extendSession = () => {
    setShowWarning(false);
    resetIdleTimer();
    toast.success("Session extended!");
  };

  // Function to track user activity
  const trackActivity = () => {
    resetIdleTimer();
  };

  // Function to handle page visibility changes
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Page is hidden (laptop closed, tab minimized, etc.)
      isPageVisibleRef.current = false;
      // Don't reset timers when page becomes hidden
    } else {
      // Page is visible again
      isPageVisibleRef.current = true;
      // Check if enough time has passed since last activity
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      if (timeSinceLastActivity >= IDLE_TIMEOUT) {
        // User has been away for more than 15 minutes, logout immediately
        handleIdleLogout();
      } else {
        // Reset the timer with remaining time
        resetIdleTimer();
      }
    }
  };

  useEffect(() => {
    // Check if user is authenticated on mount
    const authStatus = localStorage.getItem("halal-gelatin-auth");
    if (authStatus === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  // Set up activity tracking when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Reset timer on mount
      resetIdleTimer();

      // Add event listeners for user activity
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'keydown'];
      
      events.forEach(event => {
        document.addEventListener(event, trackActivity, true);
      });

      // Add window focus/blur listeners
      const handleBlur = () => {
        // When window loses focus, don't reset timer but track the time
        lastActivityRef.current = Date.now();
      };
      
      window.addEventListener('focus', trackActivity);
      window.addEventListener('blur', handleBlur);

      // Add page visibility change listener
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Cleanup function
      return () => {
        events.forEach(event => {
          document.removeEventListener(event, trackActivity, true);
        });
        
        window.removeEventListener('focus', trackActivity);
        window.removeEventListener('blur', handleBlur);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        
        if (idleTimerRef.current) {
          clearTimeout(idleTimerRef.current);
        }
        if (warningTimerRef.current) {
          clearTimeout(warningTimerRef.current);
        }
      };
    }
  }, [isAuthenticated]);

  const login = (username: string, password: string): boolean => {
    if (username === CREDENTIALS.username && password === CREDENTIALS.password) {
      setIsAuthenticated(true);
      localStorage.setItem("halal-gelatin-auth", "true");
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setShowWarning(false);
    localStorage.removeItem("halal-gelatin-auth");
    
    // Clear all timers
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
    }
    
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
      {isAuthenticated && (
        <IdleWarning
          isActive={showWarning}
          onExtendSession={extendSession}
          onLogout={logout}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
