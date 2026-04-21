/**
 * Dividend withholding tax rates by country code (ISO 3166-1 alpha-2).
 * These are approximate statutory rates for foreign investors.
 * Adjust to match your specific tax treaty situation.
 */
export const DIVIDEND_TAX_RATES: Record<string, number> = {
  // Americas
  US: 0.15,
  CA: 0.15,
  BR: 0.15,
  MX: 0.10,

  // Europe
  GB: 0.00,
  DE: 0.26375,
  FR: 0.128,
  NL: 0.15,
  CH: 0.35,
  IE: 0.00,
  SE: 0.30,
  DK: 0.27,
  FI: 0.35,
  BE: 0.30,
  IT: 0.26,
  ES: 0.19,
  PT: 0.25,
  AT: 0.275,
  LU: 0.15,
  NO: 0.25,
  PL: 0.19,
  CZ: 0.15,
  HU: 0.15,
  GR: 0.05,
  RO: 0.08,

  // Asia-Pacific
  JP: 0.15,
  AU: 0.30,
  NZ: 0.15,
  HK: 0.00,
  SG: 0.00,
  KR: 0.22,
  TW: 0.21,
  IN: 0.20,
  CN: 0.10,

  // Other
  IL: 0.25,
  ZA: 0.20,
  SA: 0.05,
  AE: 0.00,
}

export const DEFAULT_TAX_RATE = 0.15

/**
 * Look up the dividend withholding tax rate for a country.
 * Falls back to DEFAULT_TAX_RATE (15%) for unknown country codes.
 */
export function getTaxRate(countryCode: string): number {
  return DIVIDEND_TAX_RATES[countryCode.toUpperCase()] ?? DEFAULT_TAX_RATE
}

/**
 * Extract the country code from a T212 ticker string.
 * Examples:
 *   AAPL_US_EQ   → "US"
 *   BRK_B_US_EQ  → "US"
 *   VUSA_GBX_EQ  → "GBX" (3-char; caller should normalise as needed)
 * Returns null if the pattern is not recognised.
 */
export function countryFromTicker(ticker: string): string | null {
  const parts = ticker.split('_')
  // Expect at least 3 segments: BASE + COUNTRY + TYPE
  if (parts.length >= 3) {
    const candidate = parts[parts.length - 2]
    // Accept 2-letter ISO codes or 3-letter exchange codes (e.g. GBX)
    if (/^[A-Z]{2,3}$/.test(candidate)) return candidate.slice(0, 2)
  }
  return null
}
