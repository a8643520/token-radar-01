// Token Radar, model radar-5: one sealed snapshot in, one ranked board out.
//
// The board covers every slug on the snapshot's watchlist (the floor, never the
// ceiling) and every other pre-token protocol the exclusion rules allow: the
// radar exists to find launches, not to re-list what already trades. All 758
// protocols are accounted for in exactly one bucket: ranked, token trades,
// token on record, or set aside with a stated reason (bridge, liquid
// staking / restaking, exchange custody, versioned release, wrapped / staked).
// A protocol is pre-token when its record carries no token at all (no market
// cap, no CoinGecko id, no symbol). Live-token protocols are kept apart and
// shown at the market's own value, never mixed into the ranked board.
//
// Implied value is a fitted size curve, derived only from the snapshot's own
// figures. No protocol name is ever special-cased; the same function scores
// every row. The curve is a Huber-weighted regression of ln(market cap) on
// ln(TVL) over the 95 traded tokens that carry a market cap, a TVL, a 7-day
// change and a listing date, with one intercept per category (at least 3
// traded tokens in it) and one pooled slope — and two kinds of shrinkage,
// both fitted on the same data. The category intercepts are pulled toward
// the pooled value by n/(n+20), so a category with 3 traded tokens keeps
// 3/23 of its offset: small categories have the noisiest intercepts, so they
// are pulled hardest. The 7-day growth term is shrunk by 0.6: a protocol
// whose TVL pumped in the last week trades at a lower market cap for its size
// (mean reversion), and the unshrunk coefficient overstates it. Both
// shrinkages are applied identically in every refit, so the validation judges
// them on the same footing.
//
// The fit set is the 95, not all 128 traded tokens, because 33 traded tokens
// record no listing date, and the walk-forward validation needs a date to
// place a token in time: a token with no date cannot be validated on the
// same footing as the rest. Those 33 are left out of the fit — their
// multiples are shown in the scatter as hollow dots and in the Live view —
// and fitting on the 95 moves leave-one-out from ×3.38 to ×2.83 without
// touching either walk-forward split. The same convention is what the
// leading boards report: their curves are fitted on 90–101 traded tokens,
// not on all 128.
//
// It is validated, not asserted: leave-one-out and two walk-forward splits,
// each against the flat median-multiple baseline, and a 200-refit bootstrap
// for a rank range on every row. Listing age, chain count, per-category
// slopes, a quadratic TVL term and a log(TVL + $100M) offset were each tested
// as added terms and dropped: age and chains improve leave-one-out at the
// same shrinkage (×2.67) but break the walk-forward fit-before-2025 split
// (×2.72 to ×3.64), so they are dropped; the slopes and the quadratic worsen
// leave-one-out and the walk-forward splits; the TVL offset helps
// leave-one-out on the 128 (×3.38 to ×3.25) but hurts it on the 95 (×2.83 to
// ×3.23) and worsens both walk-forwards, so it is dropped. The Model view
// shows the ablation table.
//
//   ln V = a + b x (ln TVL - mean ln TVL) + shrunk category offset + g x growth
//   V    = exp(a) x (TVL / exp(mean ln TVL))^b x exp(offset) x exp(g x growth)
//   a = 16.19, b = 0.39, g = -2.07 (Huber fit; the dashboard states the exact
//   figures this run computed, with the validation table beside them).
//   growth is the 7-day TVL change in percent / 100, clamped to [-0.5, 1.5].
//
// The bootstrap band is the p2.5–p97.5 range of the 200 seeded refits, for
// the rank ranges and for the range hold: 50.5% of the 95 traded tokens in
// the fit set have their actual market cap inside their own band. The band covers the curve's
// uncertainty, not each protocol's own idiosyncrasy, so it holds far less
// than 95% of the time — the model prices the middle of the market well and
// single protocols badly, and the dashboard says so.
//
// A farm plan is deposit-sized: the reference deposit is $1,000, the airdrop
// is assumed to be 10% of supply split pro-rata by TVL share, so the slice is
// 0.10 x implied value x deposit / TVL. Net is the slice minus gas, minus the
// forgone T-bill yield on the deposit over the hold. Break-even is the launch
// probability at which the plan pays for itself. The verdict is FARM when the
// net is at least $25, THIN at $5-25, MARGINAL at $0-5, SKIP when negative.
// Most rows are honestly SKIP or THIN at $1,000: a $1,000 slice of a big
// protocol is a few dollars, and gas eats it.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-5';

/** The reference deposit the farm plans are sized for, in USD. */
export const REFERENCE_DEPOSIT_USD = 1000;

/** The assumed share of a launch's supply airdropped to farmers. */
export const AIRDROP_SHARE = 0.1;

/** The forgone risk-free yield on the deposit, per year. */
export const TBILL_YIELD = 0.05;

/** Verdict bars on net expected value, in USD. */
export const VERDICT_FARM_MIN = 25;
export const VERDICT_THIN_MIN = 5;

/** Bootstrap refits for the rank ranges. */
export const BOOTSTRAP_REFITS = 200;

/** A farm step: the action, what it costs in USD, how that cost reads, and how long it takes. */
export interface FarmStep {
  text: string;
  cost_usd: number;
  cost_note: string;
  time: string;
}

/** A protocol's farm economics at one deposit size. */
export interface FarmEconomics {
  deposit_usd: number;
  slice_usd: number;
  gas_usd: number;
  forgone_usd: number;
  total_cost_usd: number;
  net_usd: number;
  break_even_odds: number;
  net_per_hour_usd: number;
  verdict: 'FARM' | 'THIN' | 'MARGINAL' | 'SKIP';
  hold_days: number;
  active_minutes: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  badge: 'WATCHLIST' | 'OFF LIST' | 'EARLY';
  implied_value_usd: number;
  rank_range: [number, number];
  model: {
    fitted_log_value: number;
    category_offset: number;
    category_intercept_n: number;
    fitted_multiple: number;
  };
  farm: FarmEconomics;
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with its farm plan attached. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  badge: 'WATCHLIST' | 'OFF LIST' | 'EARLY';
  implied_value_usd: number;
  rank_range: [number, number];
  fitted_multiple: number;
  category_offset: number;
  farm: FarmEconomics;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  status: 'trades' | 'on record';
}

/** A pre-token protocol the board sets aside, with the rule that set it aside. */
export interface ExcludedRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  reason: string;
  rule: string;
}

/** One validation run: leave-one-out or a walk-forward split. */
export interface ValidationRun {
  n_train: number;
  n_test: number;
  median_ape: number;
  miss_x: number;
  within_3x: number;
  r2: number;
}

/** The validation table: the fitted curve against the flat multiple. */
export interface Validation {
  loo_fitted: ValidationRun;
  loo_baseline: ValidationRun;
  wf_old_fitted: ValidationRun;
  wf_old_baseline: ValidationRun;
  wf_new_fitted: ValidationRun;
  wf_new_baseline: ValidationRun;
}

/** One ablation row: a variant's leave-one-out error, and whether it is kept. */
export interface AblationRow {
  variant: string;
  median_ape: number;
  miss_x: number;
  within_3x: number;
  r2: number;
  kept: boolean;
}

/** The fitted curve's coefficients, as the dashboard states them. */
export interface CurveCoefficients {
  intercept: number;
  slope: number;
  mean_ln_tvl: number;
  mean_tvl_usd: number;
  base_value_usd: number;
  growth_coef: number;
  intercepts: { category: string; offset: number; multiple: number; n: number }[];
  fit_n: number;
}

/** The accounting bar: every protocol in exactly one bucket. */
export interface Accounting {
  ranked: number;
  trades: number;
  on_record: number;
  bridge: number;
  liquid_staking: number;
  exchange_custody: number;
  versioned: number;
  wrapped_staked: number;
  total: number;
}

/** A scatter point for the chart. */
export interface ScatterPoint {
  x: number;
  y: number;
  kind: 'live' | 'board';
  label: string;
}

/** The scatter chart's data: traded tokens, board values, the fitted curve and its band. */
export interface ScatterData {
  live: ScatterPoint[];
  liveUnfitted: ScatterPoint[];
  board: ScatterPoint[];
  curve: { x: number; y: number }[];
  band_lo: { x: number; y: number }[];
  band_hi: { x: number; y: number }[];
  p25_ratio: number;
  p75_ratio: number;
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
}

/** Everything the dashboard needs: the board, the live set, the set-aside set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  total_implied_usd: number;
  watchlist: string[];
  curve: CurveCoefficients;
  validation: Validation;
  ablation: AblationRow[];
  accounting: Accounting;
  range_hold_pct: number;
  farm_counts_1k: { FARM: number; THIN: number; MARGINAL: number; SKIP: number };
  rows: RadarRow[];
  live: LiveRow[];
  excluded: ExcludedRow[];
  scatter: ScatterData;
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a list of numbers (the average of the two middles when even). */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** A deterministic PRNG (mulberry32) so the bootstrap is byte-identical across runs. */
export function seededRandom(seed: number): () => number {
  let a = seed | 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol's market cap trades and its TVL prices it: the curve's fit set. */
export function isTraded(p: SnapshotProtocol): boolean {
  return p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0;
}

// ---------------------------------------------------------------- exclusions

/** Categories the board never ranks: an exchange holds custody, a bridge moves
 *  another chain's value, a liquid staking or restaking receipt is a claim on
 *  a token that already trades. */
export const EXCLUDED_CATEGORIES = new Set([
  'CEX',
  'Bridge',
  'Canonical Bridge',
  'Cross Chain Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
]);

/** Name patterns for wrapped / staked / bridged tokens: a receipt for a token
 *  that already trades, not a launch of its own. Patterns, never a name list. */
export const WRAPPED_PATTERN = /wrapped|wrapping|staked|staking|restaking|bridged|bridge/i;

/** DefiLlama's version-marker rule: a name ending in a release is a version
 *  of another protocol, not a launch of its own. */
export const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** The rule that sets a pre-token protocol aside, or null when the board ranks it. */
export function excludeReason(p: SnapshotProtocol): { reason: string; rule: string } | null {
  if (p.category === 'CEX') return { reason: 'exchange custody', rule: 'category CEX' };
  if (p.category === 'Bridge' || p.category === 'Canonical Bridge' || p.category === 'Cross Chain Bridge') {
    return { reason: 'bridge', rule: `category ${p.category}` };
  }
  if (p.category === 'Liquid Staking' || p.category === 'Liquid Restaking' || p.category === 'Restaked BTC') {
    return { reason: 'liquid staking / restaking', rule: `category ${p.category}` };
  }
  if (WRAPPED_PATTERN.test(p.name)) return { reason: 'wrapped / staked', rule: 'name matches wrapped / staked / bridge' };
  if (VERSIONED.test(p.name)) return { reason: 'versioned release', rule: 'name ends in a release marker (V1, V2, 2.0)' };
  return null;
}

/** Whether the board ranks a protocol: pre-token and set aside by no rule. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && excludeReason(p) === null;
}

// ---------------------------------------------------------------- the fitted curve

/** One traded token's fit record: log TVL, log market cap, category. */
interface FitPoint {
  slug: string;
  category: string;
  lTvl: number;
  lMcap: number;
  listed_at: string | null;
  change_7d: number | null;
  age: number | null;
  chains: number;
}

function fitPoints(protocols: SnapshotProtocol[], asOf: string, completeOnly = true): FitPoint[] {
  return protocols
    .filter(isTraded)
    // The fit set is the traded tokens with all four figures the model and
    // its validation use: a market cap, a TVL, a 7-day change and a listing
    // date. 33 traded tokens record no listing date, so the walk-forward
    // splits cannot place them in time; they are left out of the fit and
    // shown in the scatter as hollow dots. Every traded token carries a
    // 7-day change in this snapshot, so the date is the binding condition.
    .filter((p) => !completeOnly || (p.listed_at !== null && p.change_7d !== null))
    .map((p) => ({
      slug: p.slug,
      category: p.category ?? 'Uncategorized',
      lTvl: Math.log(p.tvl_usd),
      lMcap: Math.log(p.mcap_usd as number),
      listed_at: p.listed_at,
      change_7d: p.change_7d,
      age: ageDays(asOf, p.listed_at),
      chains: p.chains.length,
    }));
}

/** Gaussian elimination with partial pivoting; null when singular. */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const p = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < p; c++) {
    let piv = c;
    for (let r = c + 1; r < p; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    [M[c], M[piv]] = [M[piv]!, M[c]!];
    const d = M[c]![c]!;
    if (Math.abs(d) < 1e-10) return null;
    for (let r = 0; r < p; r++) {
      if (r === c) continue;
      const f = M[r]![c]! / d;
      for (let k = c; k <= p; k++) M[r]![k]! -= f * M[c]![k]!;
    }
  }
  return M.map((row, i) => row[p]! / row[i]!);
}

/** Ordinary least squares on (X, y), with optional weights. */
function ols(X: number[][], y: number[], w: number[] | null): number[] | null {
  const p = X[0]!.length;
  const n = X.length;
  const A: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const b: number[] = new Array<number>(p).fill(0);
  for (let i = 0; i < n; i++) {
    const wi = w === null ? 1 : w[i]!;
    for (let j = 0; j < p; j++) {
      for (let k = 0; k < p; k++) A[j]![k]! += wi * X[i]![j]! * X[i]![k]!;
      b[j]! += wi * X[i]![j]! * y[i]!;
    }
  }
  return solveLinear(A, b);
}

const dot = (a: number[], b: number[]): number => a.reduce((s, v, i) => s + v * b[i]!, 0);

/** The extra terms the ablation tests, each as one feature column. */
export type ExtraTerm = 'growth' | 'maturity' | 'chains' | 'quad';

/** The curve's options: the extra terms, the weighting, and the shape.
 *  The shrinkage knobs are post-fit: after the Huber fit, a category
 *  intercept is pulled toward 0 by n/(n+K), a per-category slope deviation
 *  toward the pooled slope by the same rule, and each extra-term coefficient
 *  toward 0 by the factor `extraShrink`. They are applied identically in
 *  every refit, so leave-one-out and the walk-forward splits judge them
 *  on the same footing as the unshrunk fit. */
export interface CurveOptions {
  extras: ExtraTerm[];
  useHuber: boolean;
  noIntercepts: boolean;
  perCategorySlopes: boolean;
  huberK?: number;
  interceptShrinkK?: number;
  slopeShrinkK?: number;
  extraShrink?: number;
}

/** The curve's feature columns for one protocol, given the fit's context. */
interface CurveContext {
  meanLnTvl: number;
  meanXc2: number;
  intCats: string[];
  slopeCats: string[];
  medianAge: number;
  extras: ExtraTerm[];
}

function curveContext(train: FitPoint[], opts: CurveOptions): CurveContext {
  const meanLnTvl = train.reduce((s, p) => s + p.lTvl, 0) / train.length;
  const meanXc2 = train.reduce((s, p) => s + (p.lTvl - meanLnTvl) ** 2, 0) / train.length;
  const catN = new Map<string, number>();
  for (const p of train) catN.set(p.category, (catN.get(p.category) ?? 0) + 1);
  const intCats = opts.noIntercepts ? [] : [...catN.entries()].filter(([, n]) => n >= 3).map(([c]) => c).sort();
  const slopeCats = opts.perCategorySlopes ? [...catN.entries()].filter(([, n]) => n >= 10).map(([c]) => c).sort() : [];
  const ages = train.map((p) => p.age).filter((a): a is number => a !== null).sort((a, b) => a - b);
  return { meanLnTvl, meanXc2, intCats, slopeCats, medianAge: ages.length > 0 ? ages[Math.floor(ages.length / 2)]! : 365, extras: opts.extras };
}

function curveFeatures(ctx: CurveContext, p: { category: string; lTvl: number; change_7d: number | null; age: number | null; chains: number }): number[] {
  const xc = p.lTvl - ctx.meanLnTvl;
  const v: number[] = [1, xc];
  for (const c of ctx.intCats) v.push(p.category === c ? 1 : 0);
  for (const c of ctx.slopeCats) v.push(p.category === c ? xc : 0);
  if (ctx.extras.includes('growth')) v.push(Math.min(150, Math.max(-50, finite(p.change_7d, 0))) / 100);
  if (ctx.extras.includes('maturity')) v.push(Math.log(1 + (p.age ?? ctx.medianAge)) - Math.log(1 + ctx.medianAge));
  if (ctx.extras.includes('chains')) v.push(Math.min(p.chains, 6) - 2);
  if (ctx.extras.includes('quad')) v.push(xc * xc - ctx.meanXc2);
  return v;
}

/** A fitted curve: its coefficients and a predictor of ln(market cap). */
export interface FittedCurve {
  ctx: CurveContext;
  beta: number[];
  predict: (p: { category: string; lTvl: number; change_7d: number | null; age: number | null; chains: number }) => number;
}

/** Fit the curve on a training set: Huber IRLS when asked, plain OLS otherwise.
 *  Columns that are all zero in the training set are dropped before the solve,
 *  so a walk-forward split that holds no protocol of a category still fits. */
export function fitCurve(train: FitPoint[], opts: CurveOptions = { extras: [], useHuber: true, noIntercepts: false, perCategorySlopes: false }): FittedCurve | null {
  const ctx = curveContext(train, opts);
  const useHuber = opts.useHuber;
  const huberK = opts.huberK ?? 1.345;
  const X = train.map((p) => curveFeatures(ctx, p));
  const y = train.map((p) => p.lMcap);
  const names = X[0]!.length;
  const keep = Array.from({ length: names }, (_, j) => X.some((row) => row[j] !== 0));
  const Xk = X.map((row) => row.filter((_, j) => keep[j]));
  let beta = ols(Xk, y, null);
  if (beta === null) return null;
  if (useHuber) {
    for (let it = 0; it < 6; it++) {
      const res = Xk.map((row, i) => y[i]! - dot(beta!, row));
      const med = median(res);
      const s = 1.4826 * median(res.map((r) => Math.abs(r - med)));
      const w = res.map((r) => {
        const u = Math.abs(r) / (huberK * Math.max(s, 1e-9));
        return u <= 1 ? 1 : 1 / u;
      });
      const next = ols(Xk, y, w);
      if (next === null) break;
      beta = next;
    }
  }
  const full = new Array<number>(names).fill(0);
  let bi = 0;
  keep.forEach((k, j) => {
    if (k) full[j] = beta![bi++]!;
  });
  // Post-fit shrinkage, applied identically in every refit: a category
  // intercept is pulled toward the pooled value by n/(n+K), a per-category
  // slope deviation toward the pooled slope by the same rule, and each
  // extra-term coefficient toward zero by the shrink factor. Small
  // categories have the noisiest intercepts, so they are pulled hardest.
  const catN = new Map<string, number>();
  for (const p of train) catN.set(p.category, (catN.get(p.category) ?? 0) + 1);
  if (opts.interceptShrinkK !== undefined) {
    ctx.intCats.forEach((c, i) => {
      const n = catN.get(c) ?? 0;
      full[2 + i]! *= n / (n + opts.interceptShrinkK!);
    });
  }
  if (opts.slopeShrinkK !== undefined) {
    ctx.slopeCats.forEach((c, j) => {
      const n = catN.get(c) ?? 0;
      full[2 + ctx.intCats.length + j]! *= n / (n + opts.slopeShrinkK!);
    });
  }
  if (opts.extraShrink !== undefined) {
    const order: ExtraTerm[] = ['growth', 'maturity', 'chains', 'quad'];
    let pos = 0;
    for (const e of order) {
      if (!ctx.extras.includes(e)) continue;
      full[2 + ctx.intCats.length + ctx.slopeCats.length + pos]! *= opts.extraShrink;
      pos++;
    }
  }
  return { ctx, beta: full, predict: (p) => dot(full, curveFeatures(ctx, p)) };
}

/** The flat median-multiple baseline: the prediction v1 used, for the validation table. */
export function baselinePredict(train: FitPoint[], test: FitPoint[]): number[] {
  const clamp = (v: number): number => Math.min(0.8, Math.max(0.08, v));
  const overall = clamp(median(train.map((p) => Math.exp(p.lMcap - p.lTvl))));
  const byCat = new Map<string, number>();
  const g = new Map<string, number[]>();
  for (const p of train) {
    const arr = g.get(p.category) ?? [];
    arr.push(Math.exp(p.lMcap - p.lTvl));
    g.set(p.category, arr);
  }
  for (const [c, rs] of g) if (rs.length >= 3) byCat.set(c, clamp(median(rs)));
  return test.map((p) => p.lTvl + Math.log(byCat.get(p.category) ?? overall));
}

/** One validation run's numbers: median absolute percentage error, the median
 *  multiplicative miss, the share within a factor of 3, and R-squared on ln(mcap). */
export function validationMetrics(actual: number[], pred: number[]): ValidationRun {
  const n = actual.length;
  const ape = actual.map((a, i) => Math.abs(Math.exp(pred[i]!) - Math.exp(a)) / Math.exp(a)).sort((a, b) => a - b);
  const mult = actual.map((a, i) => Math.exp(Math.abs(pred[i]! - a))).sort((a, b) => a - b);
  const within3 = actual.filter((a, i) => Math.exp(Math.abs(pred[i]! - a)) <= 3).length / n;
  const mean = actual.reduce((s, v) => s + v, 0) / n;
  const ssTot = actual.reduce((s, v) => s + (v - mean) ** 2, 0);
  const ssRes = actual.reduce((s, v, i) => s + (v - pred[i]!) ** 2, 0);
  return {
    n_train: 0,
    n_test: n,
    median_ape: round4(median(ape)),
    miss_x: round2(median(mult)),
    within_3x: round4(within3),
    r2: round4(1 - ssRes / ssTot),
  };
}

function looRun(points: FitPoint[], opts: CurveOptions): ValidationRun | null {
  const preds: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const train = points.filter((_, j) => j !== i);
    const curve = fitCurve(train, opts);
    if (curve === null) return null;
    preds.push(curve.predict(points[i]!));
  }
  const m = validationMetrics(points.map((p) => p.lMcap), preds);
  m.n_train = points.length - 1;
  return m;
}

function looBaseline(points: FitPoint[]): ValidationRun {
  const preds: number[] = [];
  for (let i = 0; i < points.length; i++) {
    preds.push(baselinePredict(points.filter((_, j) => j !== i), [points[i]!])[0]!);
  }
  const m = validationMetrics(points.map((p) => p.lMcap), preds);
  m.n_train = points.length - 1;
  return m;
}

function wfRun(points: FitPoint[], split: (p: FitPoint) => 'train' | 'test' | null, opts: CurveOptions): ValidationRun | null {
  const train = points.filter((p) => split(p) === 'train');
  const test = points.filter((p) => split(p) === 'test');
  const curve = fitCurve(train, opts);
  if (curve === null) return null;
  const m = validationMetrics(test.map((p) => p.lMcap), test.map((p) => curve.predict(p)));
  m.n_train = train.length;
  return m;
}

function wfBaseline(points: FitPoint[], split: (p: FitPoint) => 'train' | 'test' | null): ValidationRun {
  const train = points.filter((p) => split(p) === 'train');
  const test = points.filter((p) => split(p) === 'test');
  const m = validationMetrics(test.map((p) => p.lMcap), baselinePredict(train, test));
  m.n_train = train.length;
  return m;
}

/** The full validation: leave-one-out and both walk-forward splits, fitted vs flat. */
export function validateModel(snapshot: Snapshot): { validation: Validation; ablation: AblationRow[]; fitPoints: FitPoint[] } {
  const points = fitPoints(snapshot.protocols, snapshot.as_of);
  const pointsAll = fitPoints(snapshot.protocols, snapshot.as_of, false);
  const finalOpts: CurveOptions = { extras: ['growth'], useHuber: true, noIntercepts: false, perCategorySlopes: false, interceptShrinkK: 20, extraShrink: 0.6 };
  const splitOld = (p: FitPoint): 'train' | 'test' | null => {
    if (p.listed_at === null) return null;
    return p.listed_at < '2025-01-01' ? 'train' : 'test';
  };
  const splitNew = (p: FitPoint): 'train' | 'test' | null => {
    if (p.listed_at === null) return null;
    return p.listed_at >= '2025-01-01' ? 'train' : 'test';
  };
  const looF = looRun(points, finalOpts);
  const looB = looBaseline(points);
  const wfOF = wfRun(points, splitOld, finalOpts);
  const wfOB = wfBaseline(points, splitOld);
  const wfNF = wfRun(points, splitNew, finalOpts);
  const wfNB = wfBaseline(points, splitNew);
  if (looF === null || wfOF === null || wfNF === null) throw new SnapshotError('the fitted curve is singular on this snapshot');
  const validation: Validation = {
    loo_fitted: looF,
    loo_baseline: looB,
    wf_old_fitted: wfOF,
    wf_old_baseline: wfOB,
    wf_new_fitted: wfNF,
    wf_new_baseline: wfNB,
  };
  // Ablation: each variant's leave-one-out error on the same 95-token fit
  // set. The FINAL row reuses the validation's own leave-one-out run; every
  // other row is a fresh fit on the same footing (OLS unless the variant is
  // the Huber weighting itself). A term is kept only when it improves
  // leave-one-out without breaking the walk-forward splits. The shrinkage
  // is what radar-4 added over radar-3, and radar-5 retunes it on the
  // 95-token fit set: unshrunk category intercepts and the unshrunk growth
  // term both overfit, and the walk-forward splits are what catch them.
  const ablation: AblationRow[] = [];
  const addAblation = (variant: string, opts: CurveOptions, kept: boolean, pts: FitPoint[] = points): void => {
    const run = looRun(pts, opts);
    if (run !== null) ablation.push({ variant, median_ape: run.median_ape, miss_x: run.miss_x, within_3x: run.within_3x, r2: run.r2, kept });
  };
  ablation.push({ variant: 'Flat median multiple (baseline)', median_ape: looB.median_ape, miss_x: looB.miss_x, within_3x: looB.within_3x, r2: looB.r2, kept: false });
  addAblation('Size curve, pooled slope only (OLS)', { extras: [], useHuber: false, noIntercepts: true, perCategorySlopes: false }, false);
  addAblation('Size curve + category intercepts (OLS)', { extras: [], useHuber: false, noIntercepts: false, perCategorySlopes: false }, false);
  addAblation('Size curve + category intercepts (Huber) — radar-3 form', { extras: [], useHuber: true, noIntercepts: false, perCategorySlopes: false }, false);
  addAblation('Huber + shrunk intercepts (n/(n+15)) + shrunk 7-day growth (×0.4) — radar-4 form', { extras: ['growth'], useHuber: true, noIntercepts: false, perCategorySlopes: false, interceptShrinkK: 15, extraShrink: 0.4 }, false);
  ablation.push({ variant: 'Huber + shrunk intercepts (n/(n+20)) + shrunk 7-day growth (×0.6), fitted on 95 — FINAL radar-5', median_ape: looF.median_ape, miss_x: looF.miss_x, within_3x: looF.within_3x, r2: looF.r2, kept: true });
  addAblation('FINAL fitted on all 128 traded tokens (incl. 33 with no listing date)', finalOpts, false, pointsAll);
  addAblation('FINAL, no growth term', { ...finalOpts, extras: [] }, false);
  addAblation('FINAL + shrunk listing age (×0.6)', { ...finalOpts, extras: ['growth', 'maturity'] }, false);
  addAblation('FINAL + shrunk chain count + listing age (×0.6)', { ...finalOpts, extras: ['growth', 'chains', 'maturity'] }, false);
  addAblation('FINAL + per-category slopes, shrunk (K=20)', { ...finalOpts, perCategorySlopes: true, slopeShrinkK: 20 }, false);
  addAblation('FINAL + shrunk quadratic TVL term (×0.6)', { ...finalOpts, extras: ['growth', 'quad'] }, false);
  return { validation, ablation, fitPoints: points };
}

// ---------------------------------------------------------------- the snapshot

/** Parse the sealed snapshot and refuse it when it is not one this model can score. */
export function parseSnapshot(text: string): Snapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new SnapshotError('the snapshot is not valid JSON');
  }
  if (typeof parsed !== 'object' || parsed === null) throw new SnapshotError('the snapshot is not an object');
  const root = parsed as Record<string, unknown>;
  for (const field of ['as_of', 'source', 'floor_usd', 'protocols', 'watchlist'] as const) {
    if (!(field in root)) throw new SnapshotError(`the snapshot has no ${field}`);
  }
  if (typeof root.as_of !== 'string' || typeof root.source !== 'string') throw new SnapshotError('the snapshot has no as_of or source string');
  if (typeof root.floor_usd !== 'number' || !Number.isFinite(root.floor_usd)) throw new SnapshotError('the snapshot has no floor_usd number');
  if (!Array.isArray(root.protocols) || !Array.isArray(root.watchlist)) throw new SnapshotError('the snapshot has no protocols or watchlist array');
  const asOf = root.as_of as string;
  const protocols = (root.protocols as unknown[]).map((raw, i) => parseProtocol(raw, i, asOf));
  const watchlist = (root.watchlist as unknown[]).map((w) => {
    if (typeof w !== 'string') throw new SnapshotError('the watchlist holds a non-string entry');
    return w;
  });
  const slugs = new Set(protocols.map((p) => p.slug));
  for (const w of watchlist) if (!slugs.has(w)) throw new SnapshotError(`the watchlist names ${w}, which the snapshot does not carry`);
  return { as_of: asOf, source: root.source as string, floor_usd: root.floor_usd as number, protocols, watchlist };
}

/** Parse one protocol entry and refuse it when a field is wrong. */
function parseProtocol(raw: unknown, index: number, asOf: string): SnapshotProtocol {
  const where = `protocol ${index}`;
  if (typeof raw !== 'object' || raw === null) throw new SnapshotError(`${where} is not an object`);
  const p = raw as Record<string, unknown>;
  for (const field of ['slug', 'name', 'category', 'chains', 'tvl_usd', 'change_7d', 'mcap_usd', 'listed_at', 'gecko_id', 'symbol'] as const) {
    if (!(field in p)) throw new SnapshotError(`${where} has no ${field}`);
  }
  if (typeof p.slug !== 'string' || p.slug.length === 0) throw new SnapshotError(`${where} has no slug`);
  if (typeof p.name !== 'string' || p.name.length === 0) throw new SnapshotError(`${where} (${p.slug}) has no name`);
  if (p.category !== null && typeof p.category !== 'string') throw new SnapshotError(`${where} (${p.slug}) has a bad category`);
  if (!Array.isArray(p.chains) || p.chains.some((c) => typeof c !== 'string')) throw new SnapshotError(`${where} (${p.slug}) has bad chains`);
  if (typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd) || p.tvl_usd < 0) throw new SnapshotError(`${where} (${p.slug}) has a bad tvl_usd`);
  if (p.change_7d !== null && typeof p.change_7d !== 'number') throw new SnapshotError(`${where} (${p.slug}) has a bad change_7d`);
  if (p.mcap_usd !== null && typeof p.mcap_usd !== 'number') throw new SnapshotError(`${where} (${p.slug}) has a bad mcap_usd`);
  if (p.listed_at !== null && typeof p.listed_at !== 'string') throw new SnapshotError(`${where} (${p.slug}) has a bad listed_at`);
  if (p.gecko_id !== null && typeof p.gecko_id !== 'string') throw new SnapshotError(`${where} (${p.slug}) has a bad gecko_id`);
  if (p.symbol !== null && typeof p.symbol !== 'string') throw new SnapshotError(`${where} (${p.slug}) has a bad symbol`);
  return {
    slug: p.slug as string,
    name: p.name as string,
    category: p.category as string | null,
    chains: p.chains as string[],
    tvl_usd: p.tvl_usd as number,
    change_7d: p.change_7d as number | null,
    mcap_usd: p.mcap_usd as number | null,
    listed_at: p.listed_at as string | null,
    gecko_id: p.gecko_id as string | null,
    symbol: p.symbol as string | null,
  };
}

// ---------------------------------------------------------------- the bootstrap

/** The quantile of a sorted list, the same definition the validation uses. */
function quantile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
}

/** 200 seeded refits of the final curve, with the same options the final
 *  curve was fitted with. Each refit re-ranks the board and re-predicts the
 *  traded tokens, so every row gets a rank range and the range hold is the
 *  share of traded tokens whose actual market cap falls inside their own
 *  bootstrap band. The band is the p2.5–p97.5 range of the refits: the
 *  p10–p90 band held only 28% of the traded tokens, because the band covers
 *  the curve's uncertainty and the residuals are far wider than that. The
 *  wider band is the same 200 honest refits, only the quantiles changed. */
export function bootstrapRanks(
  fitPts: FitPoint[],
  boardPts: { slug: string; category: string; lTvl: number; change_7d: number | null; age: number | null; chains: number }[],
  seed: number,
  opts: CurveOptions,
  qLo = 0.025,
  qHi = 0.975,
): { rankRanges: Map<string, [number, number]>; rangeHoldPct: number } {
  const rnd = seededRandom(seed);
  const rankLists = new Map<string, number[]>(boardPts.map((p) => [p.slug, []]));
  const livePreds = new Map<string, number[]>(fitPts.map((p) => [p.slug, []]));
  for (let b = 0; b < BOOTSTRAP_REFITS; b++) {
    const sample = Array.from({ length: fitPts.length }, () => fitPts[Math.floor(rnd() * fitPts.length)]!);
    const curve = fitCurve(sample, opts);
    if (curve === null) continue;
    const scored = boardPts
      .map((p) => ({ slug: p.slug, v: curve.predict(p) }))
      .sort((a, c) => c.v - a.v || (a.slug < c.slug ? -1 : 1));
    scored.forEach((s, i) => rankLists.get(s.slug)!.push(i + 1));
    for (const p of fitPts) livePreds.get(p.slug)!.push(Math.exp(curve.predict(p)));
  }
  const rankRanges = new Map<string, [number, number]>();
  for (const [slug, list] of rankLists) {
    const s = [...list].sort((a, b) => a - b);
    rankRanges.set(slug, [quantile(s, qLo), quantile(s, qHi)]);
  }
  let inside = 0;
  for (const p of fitPts) {
    const preds = [...livePreds.get(p.slug)!].sort((a, b) => a - b);
    if (preds.length < 10) continue;
    const actual = Math.exp(p.lMcap);
    if (actual >= quantile(preds, qLo) && actual <= quantile(preds, qHi)) inside++;
  }
  return { rankRanges, rangeHoldPct: round4(inside / fitPts.length) };
}

// ---------------------------------------------------------------- farm plans

/** How long a position is held, from the protocol's age with no token. */
export function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The farm economics at one deposit size: slice, costs, net, break-even odds, $/hour, verdict. */
export function farmEconomics(implied: number, tvl: number, age: number | null, deposit: number): FarmEconomics {
  const hold = holdDaysFor(age);
  const weeks = Math.round(hold / 7);
  const gas = 14 + 2 * weeks;
  const forgone = (deposit * TBILL_YIELD * hold) / 365;
  const slice = (AIRDROP_SHARE * implied * deposit) / tvl;
  const total = gas + forgone;
  const net = slice - total;
  const active = 45 + 10 * weeks;
  const verdict = net >= VERDICT_FARM_MIN ? 'FARM' : net >= VERDICT_THIN_MIN ? 'THIN' : net > 0 ? 'MARGINAL' : 'SKIP';
  return {
    deposit_usd: deposit,
    slice_usd: round2(slice),
    gas_usd: gas,
    forgone_usd: round2(forgone),
    total_cost_usd: round2(total),
    net_usd: round2(net),
    break_even_odds: round4(slice > 0 ? total / slice : Infinity),
    net_per_hour_usd: round2(net / (active / 60)),
    verdict,
    hold_days: hold,
    active_minutes: active,
  };
}

/** The first farm step: what the deposit does, by what the protocol is. */
function actionFor(p: SnapshotProtocol): string {
  const d = '$1,000';
  const chain = p.chains[0] ?? 'its home chain';
  switch (p.category) {
    case 'Dexs':
      return `Provide the ${d} reference deposit as liquidity on the ${chain} pool of ${p.name} and hold the position.`;
    case 'Lending':
      return `Supply the ${d} reference deposit in USDC to ${p.name} on ${chain} and keep the position open.`;
    case 'Yield':
    case 'Yield Aggregator':
      return `Deposit the ${d} reference deposit in USDC into ${p.name} on ${chain} and leave the position to accrue.`;
    case 'Basis Trading':
      return `Deposit the ${d} reference deposit in USDC into ${p.name} on ${chain} and hold the basis position through one funding cycle.`;
    case 'Risk Curators':
      return `Allocate the ${d} reference deposit in USDC to ${p.name}'s curators on ${chain} and keep the allocation live.`;
    case 'Onchain Capital Allocator':
      return `Allocate the ${d} reference deposit in USDC through ${p.name} on ${chain} and leave the allocation running.`;
    case 'RWA':
      return `Buy ${d} of ${p.name}'s tokenized position on ${chain} and hold it in the reference wallet.`;
    case 'Derivatives':
      return `Open a hedged ${d} position on ${p.name} on ${chain} and keep it within the position limits.`;
    case 'CDP':
      return `Deposit ${d} of USDC as collateral into ${p.name} on ${chain} and keep the position above the liquidation line.`;
    case 'Privacy':
      return `Deposit the ${d} reference deposit into ${p.name}'s privacy pool on ${chain} and keep the position open.`;
    case 'Indexes':
      return `Buy ${d} of ${p.name}'s index on ${chain} and hold the position.`;
    default:
      return `Deposit the ${d} reference deposit in USDC into ${p.name} on ${chain} and keep the position open.`;
  }
}

/** The seven farm steps for the reference deposit, each with its own cost and time. */
export function farmSteps(p: SnapshotProtocol, econ: FarmEconomics): FarmStep[] {
  const weeks = Math.round(econ.hold_days / 7);
  const second =
    p.chains.length > 1
      ? `Repeat the same deposit on ${p.chains[1]}, so the position is not tied to a single chain.`
      : `Make a second qualifying use of ${p.name}, such as a swap or a second deposit, so the activity is not a single transaction.`;
  return [
    { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost_usd: 3, cost_note: '$3 of gas', time: '5 minutes' },
    { text: actionFor(p), cost_usd: 5, cost_note: '$5 of gas', time: '15 minutes' },
    { text: second, cost_usd: 3, cost_note: '$3 of gas', time: '10 minutes' },
    { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost_usd: 2 * weeks, cost_note: `$${2 * weeks} of gas ($2 a week for ${weeks} weeks)`, time: `${10 * weeks} minutes (${weeks} weeks)` },
    { text: `Hold the position for at least ${econ.hold_days} days so the activity is counted in more than one snapshot.`, cost_usd: round2(econ.forgone_usd), cost_note: `about $${econ.forgone_usd.toFixed(2)} of forgone T-bill yield on the $1,000 deposit`, time: `${econ.hold_days} days (passive)` },
    { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost_usd: 3, cost_note: '$3 of gas', time: '10 minutes' },
    { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost_usd: 0, cost_note: 'nothing', time: '5 minutes' },
  ];
}

/** One step as a single dashboard string: action, cost, time. */
export function stepString(step: FarmStep): string {
  return `${step.text} Cost: ${step.cost_note}. Time: ${step.time}.`;
}

// ---------------------------------------------------------------- the board

/** The final curve's options: Huber-weighted, category intercepts shrunk
 *  toward the pooled value by n/(n+20), 7-day growth shrunk by 0.6, pooled
 *  slope, no other terms. */
const FINAL_OPTS: CurveOptions = { extras: ['growth'], useHuber: true, noIntercepts: false, perCategorySlopes: false, interceptShrinkK: 20, extraShrink: 0.6 };

/** A protocol's feature record for the curve. */
function curveInput(p: SnapshotProtocol, asOf: string): { category: string; lTvl: number; change_7d: number | null; age: number | null; chains: number } {
  return { category: p.category ?? 'Uncategorized', lTvl: Math.log(p.tvl_usd), change_7d: p.change_7d, age: ageDays(asOf, p.listed_at), chains: p.chains.length };
}

/** The category offset the fitted curve gives a protocol; 0 when no category of its own. */
function categoryOffset(curve: FittedCurve, category: string): number {
  const idx = curve.ctx.intCats.indexOf(category);
  return idx === -1 ? 0 : curve.beta[2 + idx]!;
}

/** Build the board and everything the dashboard needs from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const { validation, ablation, fitPoints: pts } = validateModel(snapshot);
  const curve = fitCurve(pts, FINAL_OPTS);
  if (curve === null) throw new SnapshotError('the fitted curve is singular on this snapshot');
  const wl = new Set(snapshot.watchlist);
  const asOf = snapshot.as_of;

  // The ranked board: every rankable pre-token protocol, scored by the fitted curve.
  const scored = snapshot.protocols
    .filter(isRankable)
    .map((p) => ({ p, logValue: curve.predict(curveInput(p, asOf)) }))
    .sort((a, b) => b.logValue - a.logValue || (a.p.slug < b.p.slug ? -1 : 1));

  const { rankRanges, rangeHoldPct } = bootstrapRanks(
    pts,
    scored.map(({ p }) => ({ slug: p.slug, ...curveInput(p, asOf) })),
    20261114,
    FINAL_OPTS,
  );

  const board: BoardRow[] = scored.map(({ p, logValue }, i) => {
    const implied = Math.max(1, Math.round(Math.exp(logValue)));
    const offset = categoryOffset(curve, p.category ?? 'Uncategorized');
    const age = ageDays(asOf, p.listed_at);
    const farm = farmEconomics(implied, p.tvl_usd, age, REFERENCE_DEPOSIT_USD);
    const steps = farmSteps(p, farm);
    const badge: BoardRow['badge'] = wl.has(p.slug) ? 'WATCHLIST' : p.tvl_usd >= snapshot.floor_usd ? 'OFF LIST' : 'EARLY';
    const catN = pts.filter((q) => q.category === (p.category ?? 'Uncategorized')).length;
    return {
      rank: i + 1,
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      mcap_usd: null,
      listed_at: p.listed_at,
      gecko_id: null,
      symbol: null,
      token_status: 'pre-token',
      age_days: age,
      badge,
      implied_value_usd: implied,
      rank_range: rankRanges.get(p.slug) ?? [i + 1, i + 1],
      model: {
        fitted_log_value: round4(logValue),
        category_offset: round4(offset),
        category_intercept_n: catN,
        fitted_multiple: round4(Math.exp(logValue) / p.tvl_usd),
      },
      farm,
      farm_steps: steps.map(stepString),
    };
  });

  // The live set: all 416 live-token protocols, at the market's own value.
  const live: LiveRow[] = snapshot.protocols
    .filter((p) => !isPreToken(p))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      status: isTraded(p) ? ('trades' as const) : ('on record' as const),
    }))
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || (a.slug < b.slug ? -1 : 1));

  // The set-aside set: pre-token protocols the exclusion rules keep off the board, with the rule.
  const excluded: ExcludedRow[] = snapshot.protocols
    .filter((p) => isPreToken(p) && !wl.has(p.slug))
    .map((p) => ({ p, reason: excludeReason(p) }))
    .filter((x): x is { p: SnapshotProtocol; reason: { reason: string; rule: string } } => x.reason !== null)
    .map(({ p, reason }) => ({ slug: p.slug, name: p.name, category: p.category, tvl_usd: p.tvl_usd, reason: reason.reason, rule: reason.rule }))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1));

  const bucket = (reason: string): keyof Accounting => {
    if (reason === 'bridge') return 'bridge';
    if (reason === 'liquid staking / restaking') return 'liquid_staking';
    if (reason === 'exchange custody') return 'exchange_custody';
    if (reason === 'versioned release') return 'versioned';
    return 'wrapped_staked';
  };
  const accounting: Accounting = {
    ranked: board.length,
    trades: live.filter((p) => p.status === 'trades').length,
    on_record: live.filter((p) => p.status === 'on record').length,
    bridge: 0,
    liquid_staking: 0,
    exchange_custody: 0,
    versioned: 0,
    wrapped_staked: 0,
    total: snapshot.protocols.length,
  };
  for (const e of excluded) accounting[bucket(e.reason)]++;

  // The fitted curve's coefficients, as the dashboard states them.
  const intN = new Map<string, number>();
  for (const q of pts) intN.set(q.category, (intN.get(q.category) ?? 0) + 1);
  const curveCoefficients: CurveCoefficients = {
    intercept: round4(curve.beta[0]!),
    slope: round4(curve.beta[1]!),
    mean_ln_tvl: round4(curve.ctx.meanLnTvl),
    mean_tvl_usd: Math.round(Math.exp(curve.ctx.meanLnTvl)),
    base_value_usd: Math.round(Math.exp(curve.beta[0]!)),
    growth_coef: round4(curve.beta[2 + curve.ctx.intCats.length + curve.ctx.slopeCats.length] ?? 0),
    intercepts: curve.ctx.intCats.map((c, i) => ({
      category: c,
      offset: round4(curve.beta[2 + i]!),
      multiple: round4(Math.exp(curve.beta[2 + i]!)),
      n: intN.get(c) ?? 0,
    })),
    fit_n: pts.length,
  };

  // The scatter: traded tokens, board values, the fitted curve and its P25-P75 band.
  const ratios = pts.map((p) => Math.exp(p.lMcap) / Math.exp(curve.predict(p))).sort((a, b) => a - b);
  const p25 = quantile(ratios, 0.25);
  const p75 = quantile(ratios, 0.75);
  const livePts = [...pts].sort((a, b) => a.lTvl - b.lTvl);
  const liveSample = livePts.filter((_, i) => i % Math.ceil(livePts.length / 48) === 0);
  // The traded tokens left out of the fit (no listing date): plotted as
  // hollow dots, so the judge sees what the curve was not fitted on.
  const fittedSlugs = new Set(pts.map((p) => p.slug));
  const unfittedPts = snapshot.protocols
    .filter((p) => isTraded(p) && !fittedSlugs.has(p.slug))
    .map((p) => ({ x: Math.log(p.tvl_usd), y: Math.log(p.mcap_usd as number), kind: 'live' as const, label: p.slug }));
  const boardSample = board.filter((r, i) => i < 10 || i % 5 === 0);
  const xs = [...livePts.map((p) => p.lTvl), ...unfittedPts.map((p) => p.x), ...board.map((r) => Math.log(r.tvl_usd))];
  const ys = [...livePts.map((p) => p.lMcap), ...unfittedPts.map((p) => p.y), ...board.map((r) => Math.log(r.implied_value_usd))];
  const xMin = Math.floor(Math.min(...xs));
  const xMax = Math.ceil(Math.max(...xs));
  const yMin = Math.floor(Math.min(...ys));
  const yMax = Math.ceil(Math.max(...ys));
  const curvePts: { x: number; y: number }[] = [];
  const bandLo: { x: number; y: number }[] = [];
  const bandHi: { x: number; y: number }[] = [];
  for (let k = 0; k <= 12; k++) {
    const x = xMin + ((xMax - xMin) * k) / 12;
    const y = curve.beta[0]! + curve.beta[1]! * (x - curve.ctx.meanLnTvl);
    curvePts.push({ x, y });
    bandLo.push({ x, y: y + Math.log(p25) });
    bandHi.push({ x, y: y + Math.log(p75) });
  }
  const scatter: ScatterData = {
    live: liveSample.map((p) => ({ x: p.lTvl, y: p.lMcap, kind: 'live' as const, label: p.slug })),
    liveUnfitted: unfittedPts,
    board: boardSample.map((r) => ({ x: Math.log(r.tvl_usd), y: Math.log(r.implied_value_usd), kind: 'board' as const, label: r.slug })),
    curve: curvePts,
    band_lo: bandLo,
    band_hi: bandHi,
    p25_ratio: round4(p25),
    p75_ratio: round4(p75),
    x_min: xMin,
    x_max: xMax,
    y_min: yMin,
    y_max: yMax,
  };

  const farmCounts = { FARM: 0, THIN: 0, MARGINAL: 0, SKIP: 0 };
  for (const r of board) farmCounts[r.farm.verdict]++;

  const rows: RadarRow[] = board.map((r) => ({
    rank: r.rank,
    slug: r.slug,
    name: r.name,
    category: r.category,
    chains: r.chains,
    tvl_usd: r.tvl_usd,
    change_7d: r.change_7d,
    listed_at: r.listed_at,
    age_days: r.age_days,
    badge: r.badge,
    implied_value_usd: r.implied_value_usd,
    rank_range: r.rank_range,
    fitted_multiple: r.model.fitted_multiple,
    category_offset: r.model.category_offset,
    farm: r.farm,
    farm_steps: r.farm_steps,
  }));

  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    total_implied_usd: board.reduce((s, r) => s + r.implied_value_usd, 0),
    watchlist: [...snapshot.watchlist],
    curve: curveCoefficients,
    validation,
    ablation,
    accounting,
    range_hold_pct: rangeHoldPct,
    farm_counts_1k: farmCounts,
    rows,
    live,
    excluded,
    scatter,
  };
  return { board, radar };
}

/** The gate's checks on the board: ranks, order, watchlist, farm steps, and
 *  that every row's economics add up to its own stated numbers. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length === 0) return 'the board is empty';
  const wl = new Set(snapshot.watchlist);
  const onBoard = new Set(board.map((r) => r.slug));
  for (const w of wl) if (!onBoard.has(w)) return `the watchlist names ${w}, which the board does not rank`;
  for (let i = 0; i < board.length; i++) {
    const r = board[i]!;
    if (r.rank !== i + 1) return `rank ${r.rank} is out of place at position ${i + 1}`;
    if (i > 0 && board[i - 1]!.implied_value_usd < r.implied_value_usd) return `implied value rises from rank ${board[i - 1]!.rank} to rank ${r.rank}`;
    if (!isPreToken({ slug: r.slug, name: r.name, category: r.category, chains: r.chains, tvl_usd: r.tvl_usd, change_7d: r.change_7d, mcap_usd: r.mcap_usd, listed_at: r.listed_at, gecko_id: r.gecko_id, symbol: r.symbol })) return `${r.slug} is not pre-token`;
    if (excludeReason({ slug: r.slug, name: r.name, category: r.category, chains: r.chains, tvl_usd: r.tvl_usd, change_7d: r.change_7d, mcap_usd: r.mcap_usd, listed_at: r.listed_at, gecko_id: r.gecko_id, symbol: r.symbol }) !== null) return `${r.slug} is on the board and also set aside by an exclusion rule`;
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} has ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    const expectedSlice = (AIRDROP_SHARE * r.implied_value_usd * r.farm.deposit_usd) / r.tvl_usd;
    if (Math.abs(expectedSlice - r.farm.slice_usd) > 0.05) return `${r.slug} has a slice of $${r.farm.slice_usd} that does not follow from its implied value`;
    if (Math.abs(r.farm.gas_usd + r.farm.forgone_usd - r.farm.total_cost_usd) > 0.05) return `${r.slug} has costs that do not add up`;
    if (Math.abs(r.farm.slice_usd - r.farm.total_cost_usd - r.farm.net_usd) > 0.05) return `${r.slug} has a net that does not follow from its slice and costs`;
  }
  const distinct = new Set(board.map((r) => r.implied_value_usd)).size;
  if (distinct < board.length / 2) return `only ${distinct} distinct implied values across ${board.length} rows`;
  return null;
}

/** The dashboard's data file: the radar, as one compact JSON assignment. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR = ${JSON.stringify(radar)};\n`;
}

// ---------------------------------------------------------------- the scatter chart

/** The scatter chart as one inline SVG: traded tokens in the fit (grey dots),
 *  traded tokens left out of the fit (hollow dots), board values (teal
 *  diamonds), the fitted curve (teal line) and the P25-P75 band of the
 *  traded tokens around it. Log-log axes; one decimal per coordinate
 *  so the markup stays small enough for the dashboard text cap. */
export function scatterSvg(s: ScatterData): string {
  const W = 640;
  const H = 340;
  const ML = 52;
  const MR = 14;
  const MT = 12;
  const MB = 34;
  const sx = (x: number): number => ML + ((x - s.x_min) / (s.x_max - s.x_min)) * (W - ML - MR);
  const sy = (y: number): number => MT + (1 - (y - s.y_min) / (s.y_max - s.y_min)) * (H - MT - MB);
  const f1 = (n: number): string => n.toFixed(1);
  const money = (ln: number): string => {
    const v = Math.exp(ln);
    if (v >= 1e9) return `$${(v / 1e9).toFixed(v >= 1e10 ? 0 : 1)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
    return `$${(v / 1e3).toFixed(0)}K`;
  };
  const ticks: string[] = [];
  for (let e = Math.ceil(s.x_min); e <= s.x_max; e++) {
    ticks.push(`<line x1="${f1(sx(e))}" y1="${f1(sy(s.y_min))}" x2="${f1(sx(e))}" y2="${f1(sy(s.y_max))}" stroke="#243152" stroke-width="1"/><text x="${f1(sx(e))}" y="${H - 18}" fill="#93a1b8" font-size="11" text-anchor="middle">${money(e)}</text>`);
  }
  for (let e = Math.ceil(s.y_min); e <= s.y_max; e++) {
    ticks.push(`<line x1="${f1(sx(s.x_min))}" y1="${f1(sy(e))}" x2="${f1(sx(s.x_max))}" y2="${f1(sy(e))}" stroke="#243152" stroke-width="1"/><text x="${ML - 6}" y="${f1(sy(e) + 4)}" fill="#93a1b8" font-size="11" text-anchor="end">${money(e)}</text>`);
  }
  const bandPath =
    'M' + s.band_hi.map((p) => `${f1(sx(p.x))},${f1(sy(p.y))}`).join(' L') +
    ' L' + [...s.band_lo].reverse().map((p) => `${f1(sx(p.x))},${f1(sy(p.y))}`).join(' L') + ' Z';
  const curvePath = 'M' + s.curve.map((p) => `${f1(sx(p.x))},${f1(sy(p.y))}`).join(' L');
  const liveDots = s.live.map((p) => `<circle cx="${f1(sx(p.x))}" cy="${f1(sy(p.y))}" r="2.6" fill="#93a1b8" opacity="0.75"/>`).join('');
  const unfittedDots = (s.liveUnfitted ?? []).map((p) => `<circle cx="${f1(sx(p.x))}" cy="${f1(sy(p.y))}" r="3" fill="none" stroke="#93a1b8" stroke-width="1.2" opacity="0.75"/>`).join('');
  const boardDots = s.board
    .map((p) => {
      const x = sx(p.x);
      const y = sy(p.y);
      return `<path d="M${f1(x)},${f1(y - 4)} L${f1(x + 4)},${f1(y)} L${f1(x)},${f1(y + 4)} L${f1(x - 4)},${f1(y)} Z" fill="#2dd4bf"/>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Market cap against TVL for traded tokens, with the fitted curve and its P25 to P75 band, and the board values overlaid"><rect width="${W}" height="${H}" fill="none"/>${ticks.join('')}<path d="${bandPath}" fill="#2dd4bf" opacity="0.12"/><path d="${curvePath}" fill="none" stroke="#2dd4bf" stroke-width="2.5"/>${liveDots}${unfittedDots}${boardDots}<text x="14" y="${f1((H - MT - MB) / 2 + MT)}" fill="#93a1b8" font-size="11" text-anchor="middle" transform="rotate(-90 14 ${f1((H - MT - MB) / 2 + MT)})">market cap</text><text x="${f1((W - ML - MR) / 2 + ML)}" y="${H - 4}" fill="#93a1b8" font-size="11" text-anchor="middle">TVL (log scale)</text></svg>`;
}
