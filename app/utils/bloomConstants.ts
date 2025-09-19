// Bloom constants for the entire platform
// These values are used for order creation, editing, and schedule grouping

export const BLOOM_RANGES = [
  "160-180",
  "180-200", 
  "200-220",
  "220-240",
  "240-260",
  "250-270",
  "260-280",
  "280-300"
] as const;

export const BLOOM_INDIVIDUAL_VALUES = [
  "160", "170", "180", "190", "200",
  "210", "220", "230", "240", "250", 
  "260", "270", "280", "290", "300"
] as const;

// Combined array for dropdown options
export const ALL_BLOOM_OPTIONS = [
  // Ranges first
  ...BLOOM_RANGES.map(range => ({ value: range, label: `${range} (Range)`, type: 'range' as const })),
  // Then individual values
  ...BLOOM_INDIVIDUAL_VALUES.map(value => ({ value, label: `${value} (Individual)`, type: 'individual' as const }))
];

// Helper function to get bloom display value
export const getBloomDisplayValue = (bloom: string | number | undefined): string => {
  if (!bloom) return "No Bloom";
  return bloom.toString();
};

// Helper function to check if a bloom value is a range
export const isBloomRange = (bloom: string): boolean => {
  return BLOOM_RANGES.includes(bloom as typeof BLOOM_RANGES[number]);
};

// Helper function to check if a bloom value is an individual value
export const isBloomIndividual = (bloom: string): boolean => {
  return BLOOM_INDIVIDUAL_VALUES.includes(bloom as typeof BLOOM_INDIVIDUAL_VALUES[number]);
};

// Helper function to get bloom type
export const getBloomType = (bloom: string): 'range' | 'individual' | 'none' => {
  if (isBloomRange(bloom)) return 'range';
  if (isBloomIndividual(bloom)) return 'individual';
  return 'none';
};
