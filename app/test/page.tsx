"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function TestPage() {
  const clear = useMutation(api.clearData.clearAllData);
  const backfillFiscalYear = useMutation(api.migrations.backfillFiscalYear);
  const seedDeliveries = useMutation(api.migrations.seedDeliveriesFromOrders);
  const [isClearing, setIsClearing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Maintenance</h1>
        <button
          onClick={async () => {
            setIsClearing(true);
            try {
              const res = await clear({});
              alert("Cleared: " + JSON.stringify(res.deletedCounts));
            } catch (e: any) {
              alert("Failed: " + e.message);
            } finally {
              setIsClearing(false);
            }
          }}
          className="btn-primary disabled:opacity-50"
          disabled={isClearing}
        >
          {isClearing ? "Clearing..." : "Clear All Data"}
        </button>
        <div className="flex gap-3 justify-center">
          <button
            onClick={async () => {
              setIsMigrating(true);
              try {
                const res1 = await backfillFiscalYear({});
                const res2 = await seedDeliveries({});
                alert(
                  `Backfill FY: updated ${res1.updated}/${res1.totalMissing}, Deliveries seeded: ${res2.created}/${res2.examined}`
                );
              } catch (e: any) {
                alert("Migration failed: " + e.message);
              } finally {
                setIsMigrating(false);
              }
            }}
            className="btn-primary disabled:opacity-50"
            disabled={isMigrating}
          >
            {isMigrating ? "Running migrations..." : "Run Migrations"}
          </button>
        </div>
      </div>
    </div>
  );
}
