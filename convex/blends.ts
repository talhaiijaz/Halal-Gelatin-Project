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
        .filter((q) => q.and(q.eq(q.field("isUsed"), false), q.neq(q.field("isOnHold"), true)))
        .collect();
    } else {
      batches = await ctx.db
        .query("productionBatches")
        .filter((q) => q.and(q.eq(q.field("isUsed"), false), q.neq(q.field("isOnHold"), true)))
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
    includeOutsourceBatches: v.optional(v.boolean()), // Include outsource batches in optimization
    fiscalYear: v.optional(v.string()),
    preSelectedBatchIds: v.optional(v.array(v.union(v.id("productionBatches"), v.id("outsourceBatches")))),
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
    // Get available production batches (no bloom filtering)
    const productionBatches = await ctx.runQuery(api.blends.getAvailableBatches, {
      fiscalYear: args.fiscalYear,
    });

    // Get available outsource batches if requested
    let outsourceBatches: any[] = [];
    if (args.includeOutsourceBatches) {
      outsourceBatches = await ctx.runQuery(api.outsourceBatches.getAvailableOutsourceBatches, {
        fiscalYear: args.fiscalYear,
      });
    }

    // Combine all available batches
    const availableBatches = [...productionBatches, ...outsourceBatches];

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
    
    // Hierarchical optimization: Bloom first, then other targets
    const selected: any[] = [];
    const remaining: any[] = [...batchesWithBloom];
    let sum = 0; // sum of bloom values times bags (bags are always 10 so weight is uniform)
    
    // Define hierarchy of additional targets (in order of importance)
    const targetHierarchy = ['viscosity', 'percentage', 'ph', 'conductivity', 'moisture', 'h2o2', 'so2'];
    const attrSums: Record<string, number> = {
      viscosity: 0,
      percentage: 0,
      ph: 0,
      conductivity: 0,
      moisture: 0,
      h2o2: 0,
      so2: 0,
    };

    // Seed with user pre-selected batches (if provided)
    if (args.preSelectedBatchIds && args.preSelectedBatchIds.length > 0) {
      for (const id of args.preSelectedBatchIds) {
        const idx = remaining.findIndex((b) => b._id === id);
        if (idx !== -1) {
          const chosen = remaining.splice(idx, 1)[0];
          selected.push(chosen);
          sum += (chosen.bloom || 0) * 10;
          attrSums.viscosity += (chosen.viscosity ?? 0) * 10;
          attrSums.percentage += (chosen.percentage ?? 0) * 10;
          attrSums.ph += (chosen.ph ?? 0) * 10;
          attrSums.conductivity += (chosen.conductivity ?? 0) * 10;
          attrSums.moisture += (chosen.moisture ?? 0) * 10;
          attrSums.h2o2 += (chosen.h2o2 ?? 0) * 10;
          attrSums.so2 += (chosen.so2 ?? 0) * 10;
        }
      }
    }
    while (selected.length < batchesNeeded && remaining.length > 0) {
      let bestIdx = 0;
      let bestScore = Number.POSITIVE_INFINITY;
      
      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const nextCountBatches = selected.length + 1;
        const nextBags = nextCountBatches * 10;
        const nextAvg = (sum + (candidate.bloom || 0) * 10) / nextBags;
        
        // Primary score: Bloom range compliance (MUST be met)
        const withinBloomRange = nextAvg >= args.targetBloomMin && nextAvg <= args.targetBloomMax;
        let score = Math.abs(targetBloom - nextAvg);
        
        // If bloom is outside range, heavily penalize this candidate
        if (!withinBloomRange) {
          score += 1000; // Heavy penalty for violating bloom range
        }
        
        // Secondary optimization: Additional targets (only if bloom range is satisfied)
        if (args.additionalTargets && withinBloomRange) {
          const withAttr = {
            viscosity: (attrSums.viscosity + (candidate.viscosity ?? 0) * 10) / nextBags,
            percentage: (attrSums.percentage + (candidate.percentage ?? 0) * 10) / nextBags,
            ph: (attrSums.ph + (candidate.ph ?? 0) * 10) / nextBags,
            conductivity: (attrSums.conductivity + (candidate.conductivity ?? 0) * 10) / nextBags,
            moisture: (attrSums.moisture + (candidate.moisture ?? 0) * 10) / nextBags,
            h2o2: (attrSums.h2o2 + (candidate.h2o2 ?? 0) * 10) / nextBags,
            so2: (attrSums.so2 + (candidate.so2 ?? 0) * 10) / nextBags,
          };
          
          const targets = args.additionalTargets as any;
          let additionalScore = 0;
          
          // Apply hierarchical weighting (higher priority = lower weight multiplier)
          for (let h = 0; h < targetHierarchy.length; h++) {
            const key = targetHierarchy[h];
            if (targets[key] !== undefined) {
              const tgt = targets[key];
              const val = (withAttr as any)[key];
              const denom = Math.max(Math.abs(tgt), 1);
              const deviation = Math.abs((val - tgt) / denom);
              // Weight decreases with hierarchy position (viscosity = 1.0, ph = 0.8, etc.)
              const weight = 1.0 - (h * 0.1);
              additionalScore += deviation * weight;
            }
          }
          
          score += additionalScore * 0.1; // Small weight for additional targets
        }
        
        if (score < bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      
      const chosen = remaining.splice(bestIdx, 1)[0];
      selected.push(chosen);
      sum += (chosen.bloom || 0) * 10;
      attrSums.viscosity += (chosen.viscosity ?? 0) * 10;
      attrSums.percentage += (chosen.percentage ?? 0) * 10;
      attrSums.ph += (chosen.ph ?? 0) * 10;
      attrSums.conductivity += (chosen.conductivity ?? 0) * 10;
      attrSums.moisture += (chosen.moisture ?? 0) * 10;
      attrSums.h2o2 += (chosen.h2o2 ?? 0) * 10;
      attrSums.so2 += (chosen.so2 ?? 0) * 10;
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
    const totalViscosity = selectedBatches.reduce((sum, batch) => sum + ((batch.viscosity || 0) * batch.bags), 0);
    const averageViscosity = totalBags > 0 ? Math.round((totalViscosity / totalBags) * 100) / 100 : 0;
    
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

    // Generate optimization status messages
    const withinRange = (avg: number) => avg >= args.targetBloomMin && avg <= args.targetBloomMax;
    const warnings: string[] = [];
    const status: string[] = [];
    
    // Check bloom range compliance
    if (!withinRange(averageBloom)) {
      warnings.push(`⚠️ Bloom average (${averageBloom}) is outside target range (${args.targetBloomMin}-${args.targetBloomMax})`);
    } else {
      status.push(`✅ Bloom average (${averageBloom}) meets target range (${args.targetBloomMin}-${args.targetBloomMax})`);
    }
    
    // Check additional targets with hierarchy awareness
    if (args.additionalTargets) {
      const countBags = selectedBatches.length * 10 || 1;
      const achieved = {
        viscosity: selectedBatches.reduce((s, b) => s + (b.viscosity ?? 0) * b.bags, 0) / countBags,
        percentage: selectedBatches.reduce((s, b) => s + (b.percentage ?? 0) * b.bags, 0) / countBags,
        ph: selectedBatches.reduce((s, b) => s + (b.ph ?? 0) * b.bags, 0) / countBags,
        conductivity: selectedBatches.reduce((s, b) => s + (b.conductivity ?? 0) * b.bags, 0) / countBags,
        moisture: selectedBatches.reduce((s, b) => s + (b.moisture ?? 0) * b.bags, 0) / countBags,
        h2o2: selectedBatches.reduce((s, b) => s + (b.h2o2 ?? 0) * b.bags, 0) / countBags,
        so2: selectedBatches.reduce((s, b) => s + (b.so2 ?? 0) * b.bags, 0) / countBags,
      } as any;
      
      const targets = args.additionalTargets as any;
      for (const key of targetHierarchy) {
        if (targets[key] !== undefined) {
          const tgt = targets[key];
          const val = achieved[key] ?? 0;
          const denom = Math.max(Math.abs(tgt), 1);
          const ratio = Math.abs(val - tgt) / denom;
          const tolerance = 0.05; // 5% tolerance
          
          if (ratio <= tolerance) {
            status.push(`✅ ${key}: ${val.toFixed(2)} (target: ${tgt})`);
          } else {
            warnings.push(`⚠️ ${key}: ${val.toFixed(2)} (target: ${tgt}) - outside tolerance`);
          }
        }
      }
    }
    
    const warning = warnings.length > 0 ? warnings.join('; ') : undefined;
    const optimizationStatus = status.length > 0 ? status.join('; ') : undefined;

    return {
      selectedBatches: sortedSelectedBatches,
      totalBags,
      totalWeight,
      averageBloom,
      averageViscosity,
      ct3AverageBloom: averageBloom, // Same as average for now
      message: `Selected ${selectedBatches.length} batches (10 bags each) for ${totalBags} bags`,
      warning,
      optimizationStatus,
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
    const totalViscosity = args.selectedBatches.reduce((sum, batch) => sum + ((batch.viscosity || 0) * batch.bags), 0);
    const averageViscosity = totalBags > 0 ? Math.round((totalViscosity / totalBags) * 100) / 100 : 0;
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
      averageViscosity,
      ct3AverageBloom: averageBloom,
      status: "completed",
      notes: args.notes,
      fiscalYear: args.fiscalYear,
      createdAt: now,
      updatedAt: now,
    });
    
    // Mark selected batches as used (handle both production and outsource batches)
    for (const selectedBatch of args.selectedBatches) {
      // Try to patch as production batch first
      try {
        await ctx.db.patch(selectedBatch.batchId as unknown as Id<"productionBatches">, {
          isUsed: true,
          usedDate: now,
          usedInOrder: args.lotNumber,
          updatedAt: now,
        });
      } catch (error) {
        // If it fails, try as outsource batch
        try {
          await ctx.db.patch(selectedBatch.batchId as unknown as Id<"outsourceBatches">, {
            isUsed: true,
            usedDate: now,
            usedInOrder: args.lotNumber,
            updatedAt: now,
          });
        } catch (outError) {
          console.error(`Failed to mark batch ${selectedBatch.batchId} as used:`, outError);
          // Continue with other batches even if one fails
        }
      }
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
    
    // Free up the batches (handle both production and outsource batches)
    for (const selectedBatch of blend.selectedBatches) {
      // Try to patch as production batch first
      try {
        await ctx.db.patch(selectedBatch.batchId as unknown as Id<"productionBatches">, {
          isUsed: false,
          usedDate: undefined,
          usedInOrder: undefined,
          updatedAt: Date.now(),
        });
      } catch (error) {
        // If it fails, try as outsource batch
        try {
          await ctx.db.patch(selectedBatch.batchId as unknown as Id<"outsourceBatches">, {
            isUsed: false,
            usedDate: undefined,
            usedInOrder: undefined,
            updatedAt: Date.now(),
          });
        } catch (outError) {
          console.error(`Failed to free batch ${selectedBatch.batchId}:`, outError);
          // Continue with other batches even if one fails
        }
      }
    }
    
    // Delete the blend
    await ctx.db.delete(args.blendId);
    
    return args.blendId;
  },
});
