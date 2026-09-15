/**
 * Search Intelligence monetary presentation for the UK product.
 *
 * DataForSEO Google Ads search_volume CPC is USD (official docs), even when
 * location_code is United Kingdom (2826). Customer-facing values are converted
 * to GBP with explicit source semantics — never relabelled as pounds.
 */
export const SEARCH_INTELLIGENCE_DISPLAY_CURRENCY = "GBP" as const;
export const DATAFORSEO_GOOGLE_ADS_CPC_CURRENCY = "USD" as const;

/** Frankfurter.app ECB reference rate, USD → GBP, 2026-09-14. */
export const USD_TO_GBP_RATE = 0.74104;
export const USD_TO_GBP_AS_OF = "2026-09-14";
export const USD_TO_GBP_SOURCE = "Frankfurter.app ECB reference rate";

export type SearchIntelligenceMoney = {
  display: string;
  amountGbp: number | null;
  displayCurrency: typeof SEARCH_INTELLIGENCE_DISPLAY_CURRENCY;
  sourceAmount: number | null;
  sourceCurrency: "USD" | "GBP" | null;
  converted: boolean;
  fxRate: number | null;
  fxAsOf: string | null;
  fxSource: string | null;
};

export function convertUsdToGbp(usd: number, rate: number = USD_TO_GBP_RATE): number {
  return Math.round(usd * rate * 100) / 100;
}

export function presentSearchIntelligenceMoney(
  amount: number | null | undefined,
  sourceCurrency: "USD" | "GBP" | null | undefined,
): SearchIntelligenceMoney {
  if (typeof amount !== "number" || !Number.isFinite(amount) || !sourceCurrency) {
    return {
      display: "—",
      amountGbp: null,
      displayCurrency: SEARCH_INTELLIGENCE_DISPLAY_CURRENCY,
      sourceAmount: typeof amount === "number" && Number.isFinite(amount) ? amount : null,
      sourceCurrency: sourceCurrency || null,
      converted: false,
      fxRate: null,
      fxAsOf: null,
      fxSource: null,
    };
  }
  if (sourceCurrency === "GBP") {
    return {
      display: `£${amount.toFixed(2)}`,
      amountGbp: amount,
      displayCurrency: SEARCH_INTELLIGENCE_DISPLAY_CURRENCY,
      sourceAmount: amount,
      sourceCurrency: "GBP",
      converted: false,
      fxRate: null,
      fxAsOf: null,
      fxSource: null,
    };
  }
  const gbp = convertUsdToGbp(amount);
  return {
    display: `£${gbp.toFixed(2)}`,
    amountGbp: gbp,
    displayCurrency: SEARCH_INTELLIGENCE_DISPLAY_CURRENCY,
    sourceAmount: amount,
    sourceCurrency: "USD",
    converted: true,
    fxRate: USD_TO_GBP_RATE,
    fxAsOf: USD_TO_GBP_AS_OF,
    fxSource: USD_TO_GBP_SOURCE,
  };
}

export function searchIntelligenceMoneyFootnote(): string {
  return `Advertising CPC is shown in GBP. DataForSEO Google Ads search volume returns CPC in USD (United Kingdom location ${2826}); amounts are converted at ${USD_TO_GBP_RATE} GBP per USD (${USD_TO_GBP_SOURCE}, ${USD_TO_GBP_AS_OF}).`;
}
