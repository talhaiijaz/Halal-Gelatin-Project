import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { requireProductionAccess, getCurrentUser } from "./authUtils";

// Get all blends with pagination
export const getAllBlends = query({
  args: {
    paginationOpts: paginationOptsValidator,
    fiscalYear: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Require production access
    await requireProductionAccess(ctx);
    if (args.fiscalYear) {
      // For fiscal year filtering, we need to collect all blends and sort by serial number
      const allBlends = await ctx.db
        .query("blends")
        .withIndex("by_fiscal_year", (q) => q.eq("fiscalYear", args.fiscalYear))
        .collect();
      
      // Sort by serial number in descending order (highest first)
      const sortedBlends = allBlends.sort((a, b) => b.serialNumber - a.serialNumber);
      
      // Manual pagination since we can't use the index for both fiscal year and serial number
      const startIndex = args.paginationOpts.cursor ? parseInt(args.paginationOpts.cursor) : 0;
      const endIndex = startIndex + args.paginationOpts.numItems;
      const page = sortedBlends.slice(startIndex, endIndex);
      
      return {
        page,
        isDone: endIndex >= sortedBlends.length,
        continueCursor: endIndex < sortedBlends.length ? endIndex.toString() : null,
        pageStatus: null,
        splitCursor: null,
      };
    } else {
      return await ctx.db
        .query("blends")
        .withIndex("by_serial_number")
        .order("desc")
        .paginate(args.paginationOpts);
    }
  },
});

// Get a specific blend by ID
export const getBlendById = query({
  args: { blendId: v.id("blends") },
  handler: async (ctx, args) => {
    // Require production access
    await requireProductionAccess(ctx);
    
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
    // Require production access
    await requireProductionAccess(ctx);
    
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
    bloomSelectionMode: v.optional(v.union(v.literal("target-range"), v.literal("high-low"), v.literal("random-average"))), // Bloom selection strategy
    targetBags: v.optional(v.number()), // Desired number of bags (must be multiple of 10)
    includeOutsourceBatches: v.optional(v.boolean()), // Include outsource batches in optimization
    onlyOutsourceBatches: v.optional(v.boolean()), // Use only outsource batches (ignore production)
    fiscalYear: v.optional(v.string()),
    preSelectedBatchIds: v.optional(v.array(v.union(v.id("productionBatches"), v.id("outsourceBatches")))),
    heldBatchIds: v.optional(v.array(v.union(v.id("productionBatches"), v.id("outsourceBatches")))),
    additionalTargets: v.optional(v.object({
      viscosity: v.optional(v.object({
        enabled: v.boolean(),
        min: v.optional(v.number()),
        max: v.optional(v.number()),
      })),
      percentage: v.optional(v.object({
        enabled: v.boolean(),
        min: v.optional(v.number()),
        max: v.optional(v.number()),
      })),
      ph: v.optional(v.object({
        enabled: v.boolean(),
        min: v.optional(v.number()),
        max: v.optional(v.number()),
      })),
      conductivity: v.optional(v.object({
        enabled: v.boolean(),
        min: v.optional(v.number()),
        max: v.optional(v.number()),
      })),
      moisture: v.optional(v.object({
        enabled: v.boolean(),
        min: v.optional(v.number()),
        max: v.optional(v.number()),
      })),
      h2o2: v.optional(v.object({
        enabled: v.boolean(),
        min: v.optional(v.number()),
        max: v.optional(v.number()),
      })),
      so2: v.optional(v.object({
        enabled: v.boolean(),
        min: v.optional(v.number()),
        max: v.optional(v.number()),
      })),
      color: v.optional(v.object({
        enabled: v.boolean(),
        min: v.optional(v.string()),
        max: v.optional(v.string()),
      })),
      clarity: v.optional(v.object({
        enabled: v.boolean(),
        min: v.optional(v.number()),
        max: v.optional(v.number()),
      })),
      odour: v.optional(v.object({
        enabled: v.boolean(),
        min: v.optional(v.string()),
        max: v.optional(v.string()),
      })),
    })),
  },
  handler: async (ctx, args) => {
    // Require production access
    await requireProductionAccess(ctx);
    
    const useOnlyOutsource = args.onlyOutsourceBatches === true;

    // Get available production batches unless "only outsource" is selected
    const productionBatches = useOnlyOutsource
      ? []
      : await ctx.runQuery(api.blends.getAvailableBatches, {
          fiscalYear: args.fiscalYear,
        });

    // Determine whether to load outsource batches
    const shouldLoadOutsource = useOnlyOutsource || args.includeOutsourceBatches === true;
    let outsourceBatches: any[] = [];
    if (shouldLoadOutsource) {
      const rawOutsource = await ctx.runQuery(api.outsourceBatches.getAvailableOutsourceBatches, {
        fiscalYear: args.fiscalYear,
      });
      // Tag outsource batches so we can carry the marker through optimization
      outsourceBatches = rawOutsource.map((b: any) => ({ ...b, __isOutsource: true }));
    }

    // Combine all available batches based on mode
    const availableBatches = useOnlyOutsource
      ? [...outsourceBatches]
      : [...productionBatches, ...outsourceBatches];

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
    
    // Filter out held batches first
    let availableBatchesForOptimization = availableBatches;
    if (args.heldBatchIds && args.heldBatchIds.length > 0) {
      console.log('Held batch IDs:', args.heldBatchIds);
      console.log('Available batches before filtering:', availableBatches.length);
      availableBatchesForOptimization = availableBatches.filter(batch => 
        !args.heldBatchIds!.includes(batch._id)
      );
      console.log('Available batches after filtering:', availableBatchesForOptimization.length);
    }
    
    // Filter batches by bloom range based on selection mode
    const mode = args.bloomSelectionMode || 'random-average';
    let batchesWithBloom: any[] = [];
    
    if (mode === 'target-range') {
      // Target Bloom Range Mode: only include batches within the bloom range
      batchesWithBloom = availableBatchesForOptimization.filter(batch => {
        const bloom = batch.bloom;
        return bloom !== undefined && bloom !== null && !isNaN(bloom) && 
               bloom >= args.targetBloomMin && bloom <= args.targetBloomMax;
      });
    } else if (mode === 'high-low') {
      // High and Low Mode: only include batches outside the bloom range
      batchesWithBloom = availableBatchesForOptimization.filter(batch => {
        const bloom = batch.bloom;
        return bloom !== undefined && bloom !== null && !isNaN(bloom) && 
               (bloom < args.targetBloomMin || bloom > args.targetBloomMax);
      });
    } else {
      // Random Average Mode: include all batches with valid bloom values
      batchesWithBloom = availableBatchesForOptimization.filter(batch => {
        const bloom = batch.bloom;
        return bloom !== undefined && bloom !== null && !isNaN(bloom);
      });
    }

    if (batchesWithBloom.length === 0) {
      return { selectedBatches: [], message: "No batches found with valid bloom values for the selected mode" };
    }

    // Note: Manual batch validation is handled on the frontend to avoid duplicate warnings
    
    // Hierarchical optimization: Bloom first, then other targets
    const selected: any[] = [];
    const remaining: any[] = [...batchesWithBloom];
    let sum = 0; // sum of bloom values times bags (bags are always 10 so weight is uniform)
    
    // Define hierarchy of additional targets (in order of importance)
    const targetHierarchy = ['viscosity', 'percentage', 'ph', 'conductivity', 'moisture', 'h2o2', 'so2', 'color', 'clarity', 'odour'];
    const attrSums: Record<string, number> = {
      viscosity: 0,
      percentage: 0,
      ph: 0,
      conductivity: 0,
      moisture: 0,
      h2o2: 0,
      so2: 0,
      clarity: 0,
    };
    
    // Track string field values for exact matching or averaging
    const stringFieldValues: Record<string, string[]> = {
      color: [],
      odour: []
    };

    // PRIORITY 1: Validate and include compatible manual batches
    let preSelectedCount = 0;
    let incompatibleManualBatches: string[] = [];
    
    console.log('Manual batch processing - preSelectedBatchIds:', args.preSelectedBatchIds);
    console.log('Available batches for optimization:', availableBatchesForOptimization.length);
    
    if (args.preSelectedBatchIds && args.preSelectedBatchIds.length > 0) {
      for (const id of args.preSelectedBatchIds) {
        // Check all available batches first, not just batchesWithBloom
        const batch = availableBatchesForOptimization.find((b) => b._id === id);
        console.log(`Processing manual batch ${id}:`, batch ? `Batch #${batch.batchNumber}, bloom: ${batch.bloom}` : 'Not found');
        if (batch) {
          const batchBloom = batch.bloom || 0;
          let isCompatible = false;
          
          // Check compatibility based on mode
          if (mode === 'target-range') {
            // Target Range Mode: batch must be within target range
            isCompatible = batchBloom >= args.targetBloomMin && batchBloom <= args.targetBloomMax;
            console.log(`Target range mode: Batch #${batch.batchNumber} bloom ${batchBloom} vs range ${args.targetBloomMin}-${args.targetBloomMax}, compatible: ${isCompatible}`);
            if (!isCompatible) {
              incompatibleManualBatches.push(`Batch #${batch.batchNumber} (bloom: ${batchBloom}) is outside target range (${args.targetBloomMin}-${args.targetBloomMax})`);
            }
          } else if (mode === 'high-low') {
            // High-Low Mode: batch must be outside target range
            isCompatible = batchBloom < args.targetBloomMin || batchBloom > args.targetBloomMax;
            console.log(`High-low mode: Batch #${batch.batchNumber} bloom ${batchBloom} vs range ${args.targetBloomMin}-${args.targetBloomMax}, compatible: ${isCompatible}`);
            if (!isCompatible) {
              incompatibleManualBatches.push(`Batch #${batch.batchNumber} (bloom: ${batchBloom}) is within range (${args.targetBloomMin}-${args.targetBloomMax}); High-Low mode requires batches <${args.targetBloomMin} or >${args.targetBloomMax}`);
            }
          } else {
            // Average Random Mode: any batch is compatible
            isCompatible = true;
            console.log(`Average random mode: Batch #${batch.batchNumber} bloom ${batchBloom}, compatible: ${isCompatible}`);
          }
          
          if (isCompatible) {
            // Add compatible manual batch directly (don't check remaining array)
            console.log(`Adding compatible manual batch: Batch #${batch.batchNumber}, bloom: ${batch.bloom}`);
            selected.push(batch);
            sum += (batch.bloom || 0) * 10;
            attrSums.viscosity += (batch.viscosity ?? 0) * 10;
            attrSums.percentage += (batch.percentage ?? 0) * 10;
            attrSums.ph += (batch.ph ?? 0) * 10;
            attrSums.conductivity += (batch.conductivity ?? 0) * 10;
            attrSums.moisture += (batch.moisture ?? 0) * 10;
            attrSums.h2o2 += (batch.h2o2 ?? 0) * 10;
            attrSums.so2 += (batch.so2 ?? 0) * 10;
            
            // Track string field values for pre-selected batches
            if (batch.color) stringFieldValues.color.push(batch.color);
            if (batch.odour) stringFieldValues.odour.push(batch.odour);
            if (batch.clarity) attrSums.clarity += (batch.clarity ?? 0) * 10;
            preSelectedCount++;
            
            // Remove from remaining array to avoid double-selection
            const idx = remaining.findIndex((b) => b._id === id);
            if (idx !== -1) {
              remaining.splice(idx, 1);
            }
          } else {
            console.log(`Manual batch incompatible: Batch #${batch.batchNumber}, bloom: ${batch.bloom}`);
          }
        }
      }
    }
    
    // PRIORITY 2: Smart manual selection optimization
    console.log(`Manual batch processing completed. Selected: ${selected.length}, preSelectedCount: ${preSelectedCount}`);
    console.log(`Manual batch numbers: ${selected.slice(0, preSelectedCount).map(b => b.batchNumber).join(', ')}`);
    
    // Helper function to generate combinations
    const getCombinations = (arr: any[], size: number): any[][] => {
      if (size === 0) return [[]];
      if (size > arr.length) return [];
      if (size === arr.length) return [arr];
      
      const result: any[][] = [];
      for (let i = 0; i <= arr.length - size; i++) {
        const head = arr[i];
        const tailCombinations = getCombinations(arr.slice(i + 1), size - 1);
        for (const tail of tailCombinations) {
          result.push([head, ...tail]);
        }
      }
      return result;
    };

    // Check if manual selections can achieve target average with additional batches
    if (preSelectedCount > 0) {
      const manualBatches = selected.slice(0, preSelectedCount);
      const manualAvg = sum / (preSelectedCount * 10);
      const targetAvg = (args.targetBloomMin + args.targetBloomMax) / 2;
      
      console.log(`Manual selection average: ${manualAvg}, target average: ${targetAvg}`);
      
      // If manual selections are too low, try to find a better combination
      if (manualAvg < args.targetBloomMin) {
        console.log(`Manual selections too low (${manualAvg}), looking for better combination...`);
        
        // Get all available batches including the ones we haven't processed yet
        const allAvailableBatches = [...remaining, ...selected.slice(preSelectedCount)];
        
        // Try different combinations of manual selections to see if we can achieve target
        let bestCombination: any[] = [];
        let bestScore = Number.POSITIVE_INFINITY;
        
        // Try combinations of 1 to all manual batches
        for (let comboSize = 1; comboSize <= preSelectedCount; comboSize++) {
          // Generate combinations (simplified - just try different sizes)
          const combinations = getCombinations(manualBatches, comboSize);
          
          for (const combination of combinations) {
            const comboSum = combination.reduce((s, b) => s + (b.bloom || 0) * 10, 0);
            const comboAvg = comboSum / (combination.length * 10);
            
            // Check if this combination can reach target with additional batches
            const remainingBagsNeeded = (batchesNeeded - combination.length) * 10;
            const targetTotal = targetAvg * batchesNeeded * 10;
            const additionalNeeded = targetTotal - comboSum;
            
            // Check if we can achieve this with remaining batches
            const highBatches = allAvailableBatches.filter(b => 
              !combination.some(c => c._id === b._id) && 
              (b.bloom || 0) >= args.targetBloomMin
            );
            
            if (highBatches.length > 0 && additionalNeeded > 0) {
              const score = Math.abs(comboAvg - targetAvg);
              if (score < bestScore) {
                bestScore = score;
                bestCombination = combination;
              }
            }
          }
        }
        
        // If we found a better combination, update the selection
        if (bestCombination.length > 0 && bestCombination.length !== preSelectedCount) {
          console.log(`Found better combination with ${bestCombination.length} batches instead of ${preSelectedCount}`);
          
          // Update selection with better combination
          selected.length = 0;
          selected.push(...bestCombination);
          sum = bestCombination.reduce((s, b) => s + (b.bloom || 0) * 10, 0);
          preSelectedCount = bestCombination.length;
          
          // Update attribute sums
          attrSums.viscosity = 0;
          attrSums.percentage = 0;
          attrSums.ph = 0;
          attrSums.conductivity = 0;
          attrSums.moisture = 0;
          attrSums.h2o2 = 0;
          attrSums.so2 = 0;
          attrSums.clarity = 0;
          stringFieldValues.color = [];
          stringFieldValues.odour = [];
          stringFieldValues.clarity = [];
          
          bestCombination.forEach(batch => {
            attrSums.viscosity += (batch.viscosity ?? 0) * 10;
            attrSums.percentage += (batch.percentage ?? 0) * 10;
            attrSums.ph += (batch.ph ?? 0) * 10;
            attrSums.conductivity += (batch.conductivity ?? 0) * 10;
            attrSums.moisture += (batch.moisture ?? 0) * 10;
            attrSums.h2o2 += (batch.h2o2 ?? 0) * 10;
            attrSums.so2 += (batch.so2 ?? 0) * 10;
            attrSums.clarity += (batch.clarity ?? 0) * 10;
            
            if (batch.color) stringFieldValues.color.push(batch.color);
            if (batch.odour) stringFieldValues.odour.push(batch.odour);
          });
          
          // Add warning about the optimization
          const excludedBatches = manualBatches.filter(b => 
            !bestCombination.some(c => c._id === b._id)
          );
          if (excludedBatches.length > 0) {
            incompatibleManualBatches.push(
              `Smart optimization: Used ${bestCombination.length} of ${manualBatches.length} manually selected batches to achieve target average (${targetAvg}). Excluded batches that prevented reaching target: ${excludedBatches.map(b => `Batch #${b.batchNumber} (bloom: ${b.bloom})`).join(', ')}`
            );
          }
        }
      }
      
      // This warning logic will be moved to after the final optimization is complete
    }
    
    // Update remaining batches (remove the selected manual batches)
    const selectedIds = new Set(selected.map(b => b._id));
    const updatedRemaining = remaining.filter(b => !selectedIds.has(b._id));
    remaining.length = 0;
    remaining.push(...updatedRemaining);
    
    // Adjust batches needed based on current pre-selected batches
    const remainingBatchesNeeded = Math.max(0, batchesNeeded - preSelectedCount);
    // Helper function for random selection
    const shuffleArray = (array: any[]) => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };
    
    if (mode === 'random-average') {
      // Smart Random Average Mode: Intelligently select batches to achieve target average
      console.log(`Starting smart random average selection. Manual: ${preSelectedCount}, needed: ${remainingBatchesNeeded}`);
      
      // Calculate current average from manual selections
      const currentAvg = preSelectedCount > 0 ? sum / (preSelectedCount * 10) : 0;
      const targetAvg = (args.targetBloomMin + args.targetBloomMax) / 2;
      console.log(`Current average: ${currentAvg}, target average: ${targetAvg}`);
      
      // Strategy: Add batches that will bring us closer to target average
      while (selected.length < preSelectedCount + remainingBatchesNeeded && remaining.length > 0) {
        let bestCandidate = null;
        let bestScore = Number.POSITIVE_INFINITY;
        let bestIndex = -1;
        
        // Find the batch that would bring us closest to target average
        for (let i = 0; i < remaining.length; i++) {
          const candidate = remaining[i];
          const nextCountBatches = selected.length + 1;
          const nextBags = nextCountBatches * 10;
          const nextAvg = (sum + (candidate.bloom || 0) * 10) / nextBags;
          
          // Calculate how close this gets us to target average
          const distanceFromTarget = Math.abs(nextAvg - targetAvg);
          
          // Prefer batches that keep us within the target range
          const withinRange = nextAvg >= args.targetBloomMin && nextAvg <= args.targetBloomMax;
          const score = withinRange ? distanceFromTarget : distanceFromTarget + 1000;
          
          if (score < bestScore) {
            bestScore = score;
            bestCandidate = candidate;
            bestIndex = i;
          }
        }
        
        if (bestCandidate && bestIndex !== -1) {
          // Add the best candidate
          selected.push(bestCandidate);
          sum += (bestCandidate.bloom || 0) * 10;
          attrSums.viscosity += (bestCandidate.viscosity ?? 0) * 10;
          attrSums.percentage += (bestCandidate.percentage ?? 0) * 10;
          attrSums.ph += (bestCandidate.ph ?? 0) * 10;
          attrSums.conductivity += (bestCandidate.conductivity ?? 0) * 10;
          attrSums.moisture += (bestCandidate.moisture ?? 0) * 10;
          attrSums.h2o2 += (bestCandidate.h2o2 ?? 0) * 10;
          attrSums.so2 += (bestCandidate.so2 ?? 0) * 10;
          
          // Track field values for chosen batches
          if (bestCandidate.color) stringFieldValues.color.push(bestCandidate.color);
          if (bestCandidate.odour) stringFieldValues.odour.push(bestCandidate.odour);
          if (bestCandidate.clarity) attrSums.clarity += (bestCandidate.clarity ?? 0) * 10;
          
          // Remove from remaining
          remaining.splice(bestIndex, 1);
          
          const newAvg = sum / (selected.length * 10);
          console.log(`Added batch #${bestCandidate.batchNumber} (bloom: ${bestCandidate.bloom}), new average: ${newAvg}`);
        } else {
          break; // No more candidates
        }
      }
      
      console.log(`Smart selection completed. Final selection: ${selected.length}, manual: ${preSelectedCount}`);
    } else if (mode === 'high-low') {
      // High and Low Mode: Random selection from low and high batches
      const lowBatches = remaining.filter(b => (b.bloom || 0) < args.targetBloomMin);
      const highBatches = remaining.filter(b => (b.bloom || 0) > args.targetBloomMax);
      
      if (lowBatches.length === 0 || highBatches.length === 0) {
        return { selectedBatches: [], message: "High and Low Mode requires both low (<240) and high (>260) batches to be available" };
      }
      
      // Shuffle both arrays for random selection
      const shuffledLow = shuffleArray(lowBatches);
      const shuffledHigh = shuffleArray(highBatches);
      
      let lowIndex = 0;
      let highIndex = 0;
      
      // First, try to create a balanced mix
      while (selected.length < preSelectedCount + remainingBatchesNeeded && lowIndex < shuffledLow.length && highIndex < shuffledHigh.length) {
        // Alternate between low and high batches
        const candidate = selected.length % 2 === 0 ? shuffledLow[lowIndex++] : shuffledHigh[highIndex++];
        
        selected.push(candidate);
        sum += (candidate.bloom || 0) * 10;
        attrSums.viscosity += (candidate.viscosity ?? 0) * 10;
        attrSums.percentage += (candidate.percentage ?? 0) * 10;
        attrSums.ph += (candidate.ph ?? 0) * 10;
        attrSums.conductivity += (candidate.conductivity ?? 0) * 10;
        attrSums.moisture += (candidate.moisture ?? 0) * 10;
        attrSums.h2o2 += (candidate.h2o2 ?? 0) * 10;
        attrSums.so2 += (candidate.so2 ?? 0) * 10;
        
        // Track field values for chosen batches
        if (candidate.color) stringFieldValues.color.push(candidate.color);
        if (candidate.odour) stringFieldValues.odour.push(candidate.odour);
        if (candidate.clarity) attrSums.clarity += (candidate.clarity ?? 0) * 10;
      }
      
      // If we need more batches, fill with remaining low or high batches
      while (selected.length < preSelectedCount + remainingBatchesNeeded) {
        let candidate;
        if (lowIndex < shuffledLow.length) {
          candidate = shuffledLow[lowIndex++];
        } else if (highIndex < shuffledHigh.length) {
          candidate = shuffledHigh[highIndex++];
        } else {
          break; // No more batches available
        }
        
        selected.push(candidate);
        sum += (candidate.bloom || 0) * 10;
        attrSums.viscosity += (candidate.viscosity ?? 0) * 10;
        attrSums.percentage += (candidate.percentage ?? 0) * 10;
        attrSums.ph += (candidate.ph ?? 0) * 10;
        attrSums.conductivity += (candidate.conductivity ?? 0) * 10;
        attrSums.moisture += (candidate.moisture ?? 0) * 10;
        attrSums.h2o2 += (candidate.h2o2 ?? 0) * 10;
        attrSums.so2 += (candidate.so2 ?? 0) * 10;
        
        // Track field values for chosen batches
        if (candidate.color) stringFieldValues.color.push(candidate.color);
        if (candidate.odour) stringFieldValues.odour.push(candidate.odour);
        if (candidate.clarity) attrSums.clarity += (candidate.clarity ?? 0) * 10;
      }
    } else {
      // Target Bloom Range Mode: Original optimization logic
    while (selected.length < preSelectedCount + remainingBatchesNeeded && remaining.length > 0) {
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
        
          // Target range mode: penalize any batch outside the bloom range
          const candidateBloom = candidate.bloom || 0;
          if (candidateBloom < args.targetBloomMin || candidateBloom > args.targetBloomMax) {
          score += 1000; // Heavy penalty for violating bloom range
        }
        
        // Secondary optimization: Additional targets (only if bloom range is satisfied)
        if (args.additionalTargets && withinBloomRange) {
          const targets = args.additionalTargets as any;
          let additionalScore = 0;
          
          // Apply hierarchical weighting (higher priority = lower weight multiplier)
          for (let h = 0; h < targetHierarchy.length; h++) {
            const key = targetHierarchy[h];
              const targetConfig = targets[key];
              
              if (targetConfig && targetConfig.enabled) {
                const { min, max } = targetConfig;
                
                // Handle string-based fields (color, odour) - exact match or averaging
                if (key === 'color' || key === 'odour') {
                  const candidateValue = candidate[key];
                  
                  // If we have established values, prefer matching them
                  if (stringFieldValues[key].length > 0) {
                    const establishedValues = stringFieldValues[key];
                    const allMatch = establishedValues.every(val => val === candidateValue);
                    if (!allMatch) {
                      additionalScore += 100; // Heavy penalty for mismatch
                    }
                  } else {
                    // First batch - check if value is within range (for string fields, this means exact match)
                    if (candidateValue !== min && candidateValue !== max) {
                      additionalScore += 50; // Moderate penalty for mismatch
                    }
                  }
                } else {
                  // Handle numeric fields - check if adding this candidate keeps average within range
                  const currentSum = attrSums[key] || 0;
                  const candidateValue = candidate[key] || 0;
                  const nextSum = currentSum + (candidateValue * 10);
                  const nextAverage = nextSum / nextBags;
                  
                  // Check if the new average would be within range
                  if (min !== undefined && max !== undefined) {
                    if (nextAverage < min || nextAverage > max) {
                      // Calculate how far outside the range
                      const deviation = nextAverage < min ? (min - nextAverage) / Math.max(min, 1) : (nextAverage - max) / Math.max(max, 1);
              const weight = 1.0 - (h * 0.1);
                      additionalScore += deviation * weight * 10; // Scale up penalty for range violations
                    }
                  }
                }
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
        
        // Track field values for chosen batches
        if (chosen.color) stringFieldValues.color.push(chosen.color);
        if (chosen.odour) stringFieldValues.odour.push(chosen.odour);
        if (chosen.clarity) attrSums.clarity += (chosen.clarity ?? 0) * 10;
      }
    }

    // Select optimal batches
    const selectedBatches = [] as Array<{
      batchId: Id<any>;
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
      isOutsource?: boolean;
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
        isOutsource: (batch as any).__isOutsource === true,
      });
      batchesSelected += 1;
    }
    
    console.log(`Final selection: ${selected.length} batches, preSelected: ${preSelectedCount}, output: ${selectedBatches.length}`);
    console.log(`Selected batch numbers: ${selected.map(b => b.batchNumber).join(', ')}`);
    console.log(`Output batch numbers: ${selectedBatches.map(b => b.batchNumber).join(', ')}`);
    console.log(`Output bloom values: ${selectedBatches.map(b => b.bloom).join(', ')}`);

    // Calculate results (totalBags is batches * 10)
    const totalBags = selectedBatches.length * 10;
    const totalBloom = selectedBatches.reduce((sum, batch) => sum + ((batch.bloom || 0) * batch.bags), 0);
    let averageBloom = totalBags > 0 ? Math.round(totalBloom / totalBags) : 0;
    
    console.log(`Total bloom: ${totalBloom}, total bags: ${totalBags}, average bloom: ${averageBloom}`);
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
      
      // If target is not met and we have manual selections, warn about them
      if (preSelectedCount > 0) {
        const manualBatches = selected.slice(0, preSelectedCount);
        const targetAvg = (args.targetBloomMin + args.targetBloomMax) / 2;
        warnings.push(
          `Your manual selections (${manualBatches.map(b => `Batch #${b.batchNumber} (bloom: ${b.bloom})`).join(', ')}) contributed to not achieving the target average bloom (${targetAvg}). Consider selecting batches with higher bloom values like 267, 252, etc.`
        );
      }
    } else {
      const modeText = mode === 'target-range' ? 'Target Range Mode' : 
                      mode === 'high-low' ? 'High & Low Mode' : 'Random Average Mode';
      status.push(`✅ Bloom average (${averageBloom}) meets target range (${args.targetBloomMin}-${args.targetBloomMax}) [${modeText}]`);
    }
    
    // Check additional targets with hierarchy awareness
    if (args.additionalTargets) {
      const countBags = selectedBatches.length * 10 || 1;
      const targets = args.additionalTargets as any;
      
      for (const key of targetHierarchy) {
        const targetConfig = targets[key];
        
        if (targetConfig && targetConfig.enabled) {
          const { min, max } = targetConfig;
          
          // Handle string-based fields (color, odour)
          if (key === 'color' || key === 'odour') {
            const batchValues = selectedBatches
              .filter(b => b[key] !== undefined && b[key] !== null)
              .map(b => b[key]);
            
            if (batchValues.length === 0) {
              warnings.push(`⚠️ ${key}: No data available (target range: ${min}-${max})`);
          } else {
              // Check if all values match the target range (exact match for strings)
              const allMatchMin = batchValues.every(val => val === min);
              const allMatchMax = batchValues.every(val => val === max);
              const allMatch = allMatchMin || allMatchMax;
              
              if (allMatch) {
                const matchedValue = allMatchMin ? min : max;
                status.push(`✅ ${key}: ${matchedValue} (target range: ${min}-${max})`);
              } else {
                const uniqueValues = Array.from(new Set(batchValues.filter(val => val !== undefined)));
                warnings.push(`⚠️ ${key}: ${uniqueValues.join(', ')} (target range: ${min}-${max}) - inconsistent values`);
              }
            }
          } else {
            // Handle numeric fields - calculate average and check if within range
            const average = selectedBatches.reduce((s, b) => s + (((b as any)[key] ?? 0) * b.bags), 0) / countBags;
            
            if (min !== undefined && max !== undefined) {
              if (average >= min && average <= max) {
                status.push(`✅ ${key}: ${average.toFixed(2)} (target range: ${min}-${max})`);
              } else {
                warnings.push(`⚠️ ${key}: ${average.toFixed(2)} (target range: ${min}-${max}) - outside range`);
              }
            }
          }
        }
      }
    }
    
    const warning = warnings.length > 0 ? warnings.join('; ') : undefined;
    const optimizationStatus = status.length > 0 ? status.join('; ') : undefined;

    // Add warnings about incompatible manual batches
    let finalWarning = warning;
    if (incompatibleManualBatches.length > 0) {
      const incompatibleWarning = `⚠️ ${incompatibleManualBatches.length} manually selected batch(es) are incompatible with the selected mode: ${incompatibleManualBatches.join('; ')}`;
      finalWarning = finalWarning ? `${finalWarning}; ${incompatibleWarning}` : incompatibleWarning;
    }
    
    // Add information about held batches
    if (args.heldBatchIds && args.heldBatchIds.length > 0) {
      const heldBatchInfo = `ℹ️ ${args.heldBatchIds.length} batch(es) were held and excluded from this optimization`;
      finalWarning = finalWarning ? `${finalWarning}; ${heldBatchInfo}` : heldBatchInfo;
    }

    return {
      selectedBatches: sortedSelectedBatches,
      totalBags,
      totalWeight,
      averageBloom,
      averageViscosity,
      ct3AverageBloom: averageBloom, // Same as average for now
      message: preSelectedCount > 0 
        ? `Selected ${selectedBatches.length} batches (${preSelectedCount} user-selected + ${selectedBatches.length - preSelectedCount} optimized) for ${totalBags} bags`
        : `Selected ${selectedBatches.length} batches (10 bags each) for ${totalBags} bags`,
      warning: finalWarning,
      optimizationStatus,
    };
  },
});

// Generate lot number
export const generateLotNumber = query({
  args: {},
  handler: async (ctx) => {
    // Require production access
    await requireProductionAccess(ctx);
    
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

// Get the next SR number for a new blend
export const getNextSRNumber = query({
  args: {},
  handler: async (ctx) => {
    // Require production access
    await requireProductionAccess(ctx);
    
    // Get all blends and find the highest SR number
    const allBlends = await ctx.db.query("blends").collect();
    
    if (allBlends.length === 0) {
      return 1; // First blend gets SR number 1
    }
    
    // Find the highest SR number
    const maxSRNumber = Math.max(...allBlends.map(blend => blend.serialNumber || 0));
    
    return maxSRNumber + 1;
  },
});

// Create a new blend
export const createBlend = mutation({
  args: {
    targetBloomMin: v.number(),
    targetBloomMax: v.number(),
    targetMeanBloom: v.optional(v.number()),
    bloomSelectionMode: v.optional(v.union(v.literal("target-range"), v.literal("high-low"), v.literal("random-average"))), // Bloom selection strategy
    lotNumber: v.string(),
    targetMesh: v.optional(v.number()),
    additionalTargets: v.optional(v.object({
      viscosity: v.optional(v.object({
        enabled: v.boolean(),
        min: v.optional(v.number()),
        max: v.optional(v.number()),
      })),
      percentage: v.optional(v.object({
        enabled: v.boolean(),
        min: v.optional(v.number()),
        max: v.optional(v.number()),
      })),
      ph: v.optional(v.object({
        enabled: v.boolean(),
        min: v.optional(v.number()),
        max: v.optional(v.number()),
      })),
      conductivity: v.optional(v.object({
        enabled: v.boolean(),
        min: v.optional(v.number()),
        max: v.optional(v.number()),
      })),
      moisture: v.optional(v.object({
        enabled: v.boolean(),
        min: v.optional(v.number()),
        max: v.optional(v.number()),
      })),
      h2o2: v.optional(v.object({
        enabled: v.boolean(),
        min: v.optional(v.number()),
        max: v.optional(v.number()),
      })),
      so2: v.optional(v.object({
        enabled: v.boolean(),
        min: v.optional(v.number()),
        max: v.optional(v.number()),
      })),
      color: v.optional(v.object({
        enabled: v.boolean(),
        min: v.optional(v.string()),
        max: v.optional(v.string()),
      })),
      clarity: v.optional(v.object({
        enabled: v.boolean(),
        min: v.optional(v.number()),
        max: v.optional(v.number()),
      })),
      odour: v.optional(v.object({
        enabled: v.boolean(),
        min: v.optional(v.string()),
        max: v.optional(v.string()),
      })),
    })),
    selectedBatches: v.array(v.object({
      batchId: v.union(v.id("productionBatches"), v.id("outsourceBatches")),
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
      isOutsource: v.optional(v.boolean()),
    })),
    notes: v.optional(v.string()),
    fiscalYear: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Require production access
    await requireProductionAccess(ctx);
    
    const now = Date.now();
    // Enforce unique lot number
    const existingLot = await ctx.db
      .query("blends")
      .withIndex("by_lot_number", (q) => q.eq("lotNumber", args.lotNumber))
      .first();
    if (existingLot) {
      throw new Error("Lot number already exists. Please choose a unique lot number.");
    }

    // Get the next SR number
    const allBlends = await ctx.db.query("blends").collect();
    const nextSRNumber = allBlends.length === 0 ? 1 : Math.max(...allBlends.map(blend => blend.serialNumber || 0)) + 1;

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
      serialNumber: nextSRNumber,
      date: now,
      targetBloomMin: args.targetBloomMin,
      targetBloomMax: args.targetBloomMax,
      targetMeanBloom: args.targetMeanBloom,
      bloomSelectionMode: args.bloomSelectionMode,
      targetMesh: args.targetMesh,
      targetViscosity: args.additionalTargets?.viscosity?.enabled ? `${args.additionalTargets.viscosity.min}-${args.additionalTargets.viscosity.max}` : undefined,
      targetPercentage: args.additionalTargets?.percentage?.enabled ? `${args.additionalTargets.percentage.min}-${args.additionalTargets.percentage.max}` : undefined,
      targetPh: args.additionalTargets?.ph?.enabled ? `${args.additionalTargets.ph.min}-${args.additionalTargets.ph.max}` : undefined,
      targetConductivity: args.additionalTargets?.conductivity?.enabled ? `${args.additionalTargets.conductivity.min}-${args.additionalTargets.conductivity.max}` : undefined,
      targetMoisture: args.additionalTargets?.moisture?.enabled ? `${args.additionalTargets.moisture.min}-${args.additionalTargets.moisture.max}` : undefined,
      targetH2o2: args.additionalTargets?.h2o2?.enabled ? `${args.additionalTargets.h2o2.min}-${args.additionalTargets.h2o2.max}` : undefined,
      targetSo2: args.additionalTargets?.so2?.enabled ? `${args.additionalTargets.so2.min}-${args.additionalTargets.so2.max}` : undefined,
      targetColor: args.additionalTargets?.color?.enabled ? `${args.additionalTargets.color.min}-${args.additionalTargets.color.max}` : undefined,
      targetClarity: args.additionalTargets?.clarity?.enabled ? `${args.additionalTargets.clarity.min}-${args.additionalTargets.clarity.max}` : undefined,
      targetOdour: args.additionalTargets?.odour?.enabled ? `${args.additionalTargets.odour.min}-${args.additionalTargets.odour.max}` : undefined,
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

// Update blend status
export const updateBlendStatus = mutation({
  args: {
    blendId: v.id("blends"),
    status: v.union(v.literal("draft"), v.literal("completed")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Require production access
    await requireProductionAccess(ctx);
    
    const now = Date.now();
    
    await ctx.db.patch(args.blendId, {
      status: args.status,
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
    // Require production access
    await requireProductionAccess(ctx);
    
    // Check if blend is within 48 hours of creation
    const blend = await ctx.db.get(args.blendId);
    if (!blend) {
      throw new Error("Blend not found");
    }
    
    const now = Date.now();
    const creationTime = blend.createdAt || blend._creationTime;
    const hoursSinceCreation = (now - creationTime) / (1000 * 60 * 60);
    
    if (hoursSinceCreation > 48) {
      throw new Error("Cannot delete blend: Blend is older than 48 hours");
    }
    // Revert batches used in this blend back to available before deleting
    if (Array.isArray(blend.selectedBatches) && blend.selectedBatches.length > 0) {
      for (const batch of blend.selectedBatches as Array<{ batchId: Id<any> }>) {
        // Try reverting as production batch first
        try {
          await ctx.db.patch(batch.batchId as unknown as Id<"productionBatches">, {
            isUsed: false,
            usedInOrder: undefined,
            usedDate: undefined,
            updatedAt: now,
          });
          continue; // done for this batch
        } catch (_) {
          // Fallback to outsource batch
        }
        try {
          await ctx.db.patch(batch.batchId as unknown as Id<"outsourceBatches">, {
            isUsed: false,
            usedInOrder: undefined,
            usedDate: undefined,
            updatedAt: now,
          });
        } catch (err) {
          console.error("Failed to revert batch to available during blend deletion:", batch.batchId, err);
        }
      }
    }

    await ctx.db.delete(args.blendId);
    return { success: true };
  },
});
