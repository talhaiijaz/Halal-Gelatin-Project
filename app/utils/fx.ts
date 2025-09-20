export type UsdRates = {
  USD: number;
  EUR: number;
  AED: number;
};

const DEFAULT_RATES: UsdRates = {
  USD: 1,
  EUR: 0.93, // fallback approx (1 EUR ≈ 0.93 USD)
  AED: 0.2723, // 1 AED ≈ 0.2723 USD (1/3.6725)
};

export async function getUsdRates(signal?: AbortSignal): Promise<UsdRates> {
  try {
    const res = await fetch(
      "https://api.exchangerate.host/latest?base=USD&symbols=EUR,AED",
      { signal }
    );
    if (!res.ok) return DEFAULT_RATES;
    const data = await res.json();
    const eur = typeof data?.rates?.EUR === "number" ? data.rates.EUR : DEFAULT_RATES.EUR;
    const aed = typeof data?.rates?.AED === "number" ? data.rates.AED : DEFAULT_RATES.AED;
    
    // API returns how many foreign currency units per 1 USD
    // So if rates.AED = 3.67, it means 1 USD = 3.67 AED
    // To convert AED to USD: amount_AED * (1 USD / 3.67 AED) = amount_AED / 3.67
    // To convert EUR to USD: amount_EUR * (1 USD / eur EUR) = amount_EUR / eur
    
    return {
      USD: 1,
      EUR: 1 / eur, // Convert EUR to USD
      AED: 1 / aed, // Convert AED to USD
    };
  } catch {
    return DEFAULT_RATES;
  }
}

export function toUSD(amount: number, currency: keyof UsdRates, rates: UsdRates): number {
  const r = rates[currency] ?? 1;
  console.log(`Converting ${amount} ${currency} to USD using rate ${r}`);
  return amount * r;
}

