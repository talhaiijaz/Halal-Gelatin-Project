// Standardized bloom ranges and values for the entire platform
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

export const ALL_BLOOM_OPTIONS = [
  // Ranges first
  ...BLOOM_RANGES.map(range => ({ value: range, label: `${range} (Range)`, type: 'range' as const })),
  // Then individual values
  ...BLOOM_INDIVIDUAL_VALUES.map(value => ({ value, label: `${value} (Individual)`, type: 'individual' as const }))
];

export type BloomRange = typeof BLOOM_RANGES[number];
export type BloomIndividualValue = typeof BLOOM_INDIVIDUAL_VALUES[number];
export type BloomValue = BloomRange | BloomIndividualValue;

// Helper function to get bloom options for dropdowns
export const getBloomOptions = () => ALL_BLOOM_OPTIONS;

// Helper function to check if a bloom value is a range
export const isBloomRange = (value: string): value is BloomRange => {
  return BLOOM_RANGES.includes(value as BloomRange);
};

// Helper function to check if a bloom value is an individual value
export const isBloomIndividual = (value: string): value is BloomIndividualValue => {
  return BLOOM_INDIVIDUAL_VALUES.includes(value as BloomIndividualValue);
};
