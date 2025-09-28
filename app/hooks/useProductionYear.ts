import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect } from "react";

export function useProductionYear() {
  // Get current year settings
  const yearSettings = useQuery(api.productionYearSettings.getCurrentYearSettings);
  const availableYears = useQuery(api.productionYearSettings.getAvailableYears);
  const currentYear = useQuery(api.productionYearSettings.getCurrentYear);
  
  // Get fiscal year settings
  const availableFiscalYears = useQuery(api.productionYearSettings.getAvailableFiscalYears);
  const currentFiscalYear = useQuery(api.productionYearSettings.getCurrentFiscalYearSetting);
  
  // Mutations
  const setCurrentYear = useMutation(api.productionYearSettings.setCurrentYear);
  const addNewYear = useMutation(api.productionYearSettings.addNewYear);
  const initializeYearSettings = useMutation(api.productionYearSettings.initializeYearSettings);
  
  // Fiscal year mutations
  const setCurrentFiscalYear = useMutation(api.productionYearSettings.setCurrentFiscalYear);
  const addNewFiscalYear = useMutation(api.productionYearSettings.addNewFiscalYear);

  // Local state for UI
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize year settings if they don't exist
  useEffect(() => {
    if (yearSettings === null && !isLoading) {
      initializeYearSettings().catch((err) => {
        console.error("Failed to initialize year settings:", err);
        setError("Failed to initialize year settings");
      });
    }
  }, [yearSettings, initializeYearSettings, isLoading]);

  const handleSetCurrentYear = async (year: number) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await setCurrentYear({ year });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set current year");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNewYear = async (year: number) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await addNewYear({ year });
      if (result.success) {
        // Automatically set the new year as current
        await setCurrentYear({ year });
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add new year");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetCurrentFiscalYear = async (fiscalYear: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await setCurrentFiscalYear({ fiscalYear });
      if (!result.success) {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set current fiscal year");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNewFiscalYear = async (fiscalYear: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await addNewFiscalYear({ fiscalYear });
      if (result.success) {
        // Automatically set the new fiscal year as current
        await setCurrentFiscalYear({ fiscalYear });
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add new fiscal year");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    // Data (legacy)
    currentYear: currentYear || new Date().getFullYear(),
    availableYears: availableYears || [new Date().getFullYear()],
    yearSettings,
    
    // Fiscal year data
    currentFiscalYear: currentFiscalYear || "2025-26",
    availableFiscalYears: availableFiscalYears || ["2025-26"],
    
    // Actions (legacy)
    setCurrentYear: handleSetCurrentYear,
    addNewYear: handleAddNewYear,
    
    // Fiscal year actions
    setCurrentFiscalYear: handleSetCurrentFiscalYear,
    addNewFiscalYear: handleAddNewFiscalYear,
    
    // State
    isLoading,
    error,
  };
}
