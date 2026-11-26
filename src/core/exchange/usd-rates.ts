import { z } from 'zod';

export type UsdRates = { date: string; rates: Record<string, number> };
const responseSchema = z.array(
  z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    base: z.literal('USD'),
    quote: z.string().regex(/^[A-Z]{3}$/),
    rate: z.number().finite().positive(),
  })
);
let cached: { key: string; expires: number; value: UsdRates } | undefined;

/** Reference conversion for reporting only; never used to settle money. */
export async function getUsdRates(currencies: string[]): Promise<UsdRates> {
  const quotes = [...new Set(currencies.filter((c) => c !== 'USD'))].sort();
  if (!quotes.every((c) => /^[A-Z]{3}$/.test(c)))
    throw new Error('Invalid currency');
  if (!quotes.length) return { date: '', rates: { USD: 1 } };
  const key = quotes.join(',');
  if (cached?.key === key && cached.expires > Date.now()) return cached.value;
  const params = new URLSearchParams({
    base: 'USD',
    quotes: key,
    providers: 'ECB',
  });
  const response = await fetch(
    `https://api.frankfurter.dev/v2/rates?${params}`,
    {
      signal: AbortSignal.timeout(8_000),
    }
  );
  if (!response.ok) throw new Error('Exchange rates unavailable');
  const rows = responseSchema.parse(await response.json());
  const rates: Record<string, number> = { USD: 1 };
  const dates = new Set<string>();
  for (const quote of quotes) {
    const row = rows.find((r) => r.quote === quote);
    if (!row) throw new Error(`Missing exchange rate: ${quote}`);
    rates[quote] = 1 / row.rate;
    dates.add(row.date);
  }
  if (dates.size !== 1)
    throw new Error('Exchange rates have inconsistent dates');
  const value = { date: [...dates][0], rates };
  cached = { key, expires: Date.now() + 3_600_000, value };
  return value;
}
