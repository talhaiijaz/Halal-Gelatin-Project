export type UsdRates = {
  USD: number;
  EUR: number;
  AED: number;
};

const DEFAULT_RATES: UsdRates = {
  USD: 1,
  EUR: 1.08, // fallback approx
  AED: 0.2723, // 1 AED ≈ 0.2723 USD
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
    // API returns how many EUR per USD; we need 1 of foreign to USD → but since base=USD, 1 USD = eur EUR.
    // We want direct multiplier to convert foreign->USD, so:
    // amount_EUR * (USD per EUR) = amount_EUR * (1 / (EUR per USD))
    // However, since base=USD, rates.EUR = EUR per USD. So USD per EUR = 1 / rates.EUR.
    // For AED, same logic. We'll invert below.
    return {
      USD: 1,
      EUR: 1 / eur,
      AED: 1 / aed,
    };
  } catch {
    return DEFAULT_RATES;
  }
}

export function toUSD(amount: number, currency: keyof UsdRates, rates: UsdRates): number {
  const r = rates[currency] ?? 1;
  return amount * r;
}

