import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

// Get all blends with pagination
export const getAllBlends = query({
  args: {
    paginationOpts: paginationOptsValidator,
    fiscalYear: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.fiscalYear) {
      return await ctx.db
        .query("blends")
        .withIndex("by_fiscal_year", (q) => q.eq("fiscalYear", args.fiscalYear))
        .order("desc")
        .paginate(args.paginationOpts);
    } else {
      return await ctx.db
        .query("blends")
        .order("desc")
        .paginate(args.paginationOpts);
    }
  },
});

// Get a specific blend by ID
export const getBlendById = query({
  args: { blendId: v.id("blends") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.blendId);
  },
});

// Get available batches for blending (not used)
export const getAvailableBatches = query({
  args: {
    fiscalYear: v.optional(v.string()),
    targetBloomMin: v.optional(v.number()),
    targetBloomMax: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let batches;
    
    if (args.fiscalYear) {
      batches = await ctx.db
        .query("productionBatches")
        .withIndex("by_fiscal_year_and_active", (q) => 
          q.eq("fiscalYear", args.fiscalYear).eq("isActive", true)
        )
        .filter((q) => q.eq(q.field("isUsed"), false))
        .collect();
    } else {
      batches = await ctx.db
        .query("productionBatches")
        .filter((q) => q.eq(q.field("isUsed"), false))
        .collect();
    }
    // Do not filter by bloom range here; optimizer will decide combinations
    return batches;
  },
});

// Optimize batch selection for target bloom
export const optimizeBatchSelection = query({
  args: {
    targetBloomMin: v.number(),
    targetBloomMax: v.number(),
    targetMeanBloom: v.optional(v.number()), // Preferred mean bloom
    targetBags: v.optional(v.number()), // Desired number of bags (must be multiple of 10)
    fiscalYear: v.optional(v.string()),
    additionalTargets: v.optional(v.object({
      viscosity: v.optional(v.number()),
      percentage: v.optional(v.number()),
      ph: v.optional(v.number()),
      conductivity: v.optional(v.number()),
      moisture: v.optional(v.number()),
      h2o2: v.optional(v.number()),
      so2: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    // Get available batches (no bloom filtering)
    const availableBatches = await ctx.runQuery(api.blends.getAvailableBatches, {
      fiscalYear: args.fiscalYear,
    });

    if (availableBatches.length === 0) {
      return { selectedBatches: [], message: "No available batches found for the target bloom range" };
    }

    // Normalize target bags to nearest multiple of 10 with minimum of 10
    const targetBagsInput = args.targetBags ?? 10;
    const targetBags = Math.max(10, Math.round(targetBagsInput / 10) * 10);
    const batchesNeeded = Math.ceil(targetBags / 10);
    // Determine target bloom (prefer mean, fallback to range logic)
    let targetBloom: number;
    if (args.targetMeanBloom !== undefined) {
      // If mean is outside range, clamp to nearest bound
      if (args.targetMeanBloom < args.targetBloomMin) {
        targetBloom = args.targetBloomMin;
      } else if (args.targetMeanBloom > args.targetBloomMax) {
        targetBloom = args.targetBloomMax;
      } else {
        targetBloom = args.targetMeanBloom;
      }
    } else {
      // No mean specified, use upper bound as before
      targetBloom = args.targetBloomMax;
    }
    
    const batchesWithBloom = availableBatches.filter((b: any) => b.bloom !== undefined);
    
    // Greedy selection towards target bloom average
    const selected: any[] = [];
    const remaining: any[] = [...batchesWithBloom];
    let sum = 0; // sum of bloom values times bags (bags are always 10 so weight is uniform)
    while (selected.length < batchesNeeded && remaining.length > 0) {
      let bestIdx = 0;
      let bestScore = Number.POSITIVE_INFINITY;
      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const nextAvg = (sum + (candidate.bloom || 0) * 10) / ((selected.length + 1) * 10);
        const score = Math.abs(targetBloom - nextAvg);
        if (score < bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      const chosen = remaining.splice(bestIdx, 1)[0];
      selected.push(chosen);
      sum += (chosen.bloom || 0) * 10;
    }

    // Select optimal batches
    const selectedBatches = [] as Array<{
      batchId: Id<"productionBatches">;
      batchNumber: number;
      bags: number;
      bloom?: number;
      viscosity?: number;
      percentage?: number;
      ph?: number;
      conductivity?: number;
      moisture?: number;
      h2o2?: number;
      so2?: number;
      color?: string;
      clarity?: string;
      odour?: string;
    }>;

    let batchesSelected = 0;
    
    for (const batch of selected) {
      if (batchesSelected >= batchesNeeded) break;
      selectedBatches.push({
        batchId: batch._id,
        batchNumber: batch.batchNumber,
        bags: 10,
        bloom: batch.bloom,
        viscosity: batch.viscosity,
        percentage: batch.percentage,
        ph: batch.ph,
        conductivity: batch.conductivity,
        moisture: batch.moisture,
        h2o2: batch.h2o2,
        so2: batch.so2,
        color: batch.color,
        clarity: batch.clarity,
        odour: batch.odour,
      });
      batchesSelected += 1;
    }

    // Calculate results (totalBags is batches * 10)
    const totalBags = selectedBatches.length * 10;
    const totalBloom = selectedBatches.reduce((sum, batch) => sum + ((batch.bloom || 0) * batch.bags), 0);
    let averageBloom = totalBags > 0 ? Math.round(totalBloom / totalBags) : 0;
    
    // If average is outside range, try one-pass local improvement by swapping
    if (selected.length > 0 && remaining.length > 0) {
      const withinRange = (avg: number) => avg >= args.targetBloomMin && avg <= args.targetBloomMax;
      if (!withinRange(averageBloom)) {
        // Prepare for swaps
        let bestAvg = averageBloom;
        let bestSwap: { selIdx: number; remIdx: number } | null = null;
        for (let si = 0; si < selected.length; si++) {
          for (let ri = 0; ri < Math.min(50, remaining.length); ri++) { // cap search for perf
            const sel = selected[si];
            const rem = remaining[ri];
            const newSum = sum - (sel.bloom || 0) * 10 + (rem.bloom || 0) * 10;
            const newAvg = Math.round(newSum / (selected.length * 10));
            const isBetter = withinRange(newAvg)
              ? (withinRange(bestAvg) ? (Math.abs(targetBloom - newAvg) < Math.abs(targetBloom - bestAvg)) : true)
              : (!withinRange(bestAvg) && Math.abs(targetBloom - newAvg) < Math.abs(targetBloom - bestAvg));
            if (isBetter) {
              bestAvg = newAvg;
              bestSwap = { selIdx: si, remIdx: ri };
            }
          }
        }
        if (bestSwap) {
          // Apply best swap to selectedBatches output
          const selBatch = selectedBatches[bestSwap.selIdx];
          const remBatch = remaining[bestSwap.remIdx];
          selectedBatches[bestSwap.selIdx] = {
            batchId: remBatch._id,
            batchNumber: remBatch.batchNumber,
            bags: 10,
            bloom: remBatch.bloom,
            viscosity: remBatch.viscosity,
            percentage: remBatch.percentage,
            ph: remBatch.ph,
            conductivity: remBatch.conductivity,
            moisture: remBatch.moisture,
            h2o2: remBatch.h2o2,
            so2: remBatch.so2,
            color: remBatch.color,
            clarity: remBatch.clarity,
            odour: remBatch.odour,
          };
          averageBloom = bestAvg;
        }
      }
    }
    const totalWeight = totalBags * 25; // 25kg per bag

    // Sort selected batches by batch number (lowest to highest) for easier reading
    const sortedSelectedBatches = selectedBatches.sort((a, b) => a.batchNumber - b.batchNumber);

    return {
      selectedBatches: sortedSelectedBatches,
      totalBags,
      totalWeight,
      averageBloom,
      ct3AverageBloom: averageBloom, // Same as average for now
      message: `Selected ${selectedBatches.length} batches (10 bags each) for ${totalBags} bags`
    };
  },
});

// Generate lot number
export const generateLotNumber = query({
  args: {},
  handler: async (ctx) => {
    const currentDate = new Date();
    const year = currentDate.getFullYear().toString().slice(-2);
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const day = currentDate.getDate().toString().padStart(2, '0');
    
    // Get count of blends created today for uniqueness
    const todayStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).getTime();
    const todayBlends = await ctx.db
      .query("blends")
      .filter((q) => q.gte(q.field("createdAt"), todayStart))
      .collect();
    
    const sequence = (todayBlends.length + 1).toString().padStart(3, '0');
    
    return `HG-${year}${month}-MFI-${day}${sequence}-${Math.floor(Math.random() * 10)}`;
  },
});

// Create a new blend
export const createBlend = mutation({
  args: {
    targetBloomMin: v.number(),
    targetBloomMax: v.number(),
    targetMeanBloom: v.optional(v.number()),
    lotNumber: v.string(),
    targetMesh: v.optional(v.number()),
    additionalTargets: v.optional(v.object({
      viscosity: v.optional(v.number()),
      percentage: v.optional(v.number()),
      ph: v.optional(v.number()),
      conductivity: v.optional(v.number()),
      moisture: v.optional(v.number()),
      h2o2: v.optional(v.number()),
      so2: v.optional(v.number()),
      color: v.optional(v.string()),
      clarity: v.optional(v.string()),
      odour: v.optional(v.string()),
    })),
    selectedBatches: v.array(v.object({
      batchId: v.id("productionBatches"),
      batchNumber: v.number(),
      bags: v.number(),
      bloom: v.optional(v.number()),
      viscosity: v.optional(v.number()),
      percentage: v.optional(v.number()),
      ph: v.optional(v.number()),
      conductivity: v.optional(v.number()),
      moisture: v.optional(v.number()),
      h2o2: v.optional(v.number()),
      so2: v.optional(v.number()),
      color: v.optional(v.string()),
      clarity: v.optional(v.string()),
      odour: v.optional(v.string()),
    })),
    notes: v.optional(v.string()),
    fiscalYear: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    // Enforce unique lot number
    const existingLot = await ctx.db
      .query("blends")
      .withIndex("by_lot_number", (q) => q.eq("lotNumber", args.lotNumber))
      .first();
    if (existingLot) {
      throw new Error("Lot number already exists. Please choose a unique lot number.");
    }

    // Calculate totals
    const totalBags = args.selectedBatches.reduce((sum, batch) => sum + batch.bags, 0);
    const totalBloom = args.selectedBatches.reduce((sum, batch) => sum + ((batch.bloom || 0) * batch.bags), 0);
    const averageBloom = totalBags > 0 ? Math.round(totalBloom / totalBags) : 0;
    const totalWeight = totalBags * 25; // 25kg per bag
    
    // Create the blend
    const blendId = await ctx.db.insert("blends", {
      lotNumber: args.lotNumber,
      date: now,
      targetBloomMin: args.targetBloomMin,
      targetBloomMax: args.targetBloomMax,
      targetMeanBloom: args.targetMeanBloom,
      targetMesh: args.targetMesh,
      targetViscosity: args.additionalTargets?.viscosity,
      targetPercentage: args.additionalTargets?.percentage,
      targetPh: args.additionalTargets?.ph,
      targetConductivity: args.additionalTargets?.conductivity,
      targetMoisture: args.additionalTargets?.moisture,
      targetH2o2: args.additionalTargets?.h2o2,
      targetSo2: args.additionalTargets?.so2,
      targetColor: args.additionalTargets?.color,
      targetClarity: args.additionalTargets?.clarity,
      targetOdour: args.additionalTargets?.odour,
      selectedBatches: args.selectedBatches,
      totalBags,
      totalWeight,
      averageBloom,
      ct3AverageBloom: averageBloom,
      status: "completed",
      notes: args.notes,
      fiscalYear: args.fiscalYear,
      createdAt: now,
      updatedAt: now,
    });
    
    // Mark selected batches as used
    for (const selectedBatch of args.selectedBatches) {
      await ctx.db.patch(selectedBatch.batchId, {
        isUsed: true,
        usedDate: now,
        usedInOrder: args.lotNumber,
        updatedAt: now,
      });
    }
    
    return blendId;
  },
});

// Update blend status (for review/approval)
export const updateBlendStatus = mutation({
  args: {
    blendId: v.id("blends"),
    status: v.union(v.literal("draft"), v.literal("completed"), v.literal("approved")),
    reviewedBy: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    await ctx.db.patch(args.blendId, {
      status: args.status,
      reviewedBy: args.reviewedBy,
      reviewedAt: args.status === "approved" ? now : undefined,
      notes: args.notes,
      updatedAt: now,
    });
    
    return args.blendId;
  },
});

// Delete a blend and free up the batches
export const deleteBlend = mutation({
  args: { blendId: v.id("blends") },
  handler: async (ctx, args) => {
    const blend = await ctx.db.get(args.blendId);
    if (!blend) {
      throw new Error("Blend not found");
    }
    
    // Free up the batches
    for (const selectedBatch of blend.selectedBatches) {
      await ctx.db.patch(selectedBatch.batchId, {
        isUsed: false,
        usedDate: undefined,
        usedInOrder: undefined,
        updatedAt: Date.now(),
      });
    }
    
    // Delete the blend
    await ctx.db.delete(args.blendId);
    
    return args.blendId;
  },
});
