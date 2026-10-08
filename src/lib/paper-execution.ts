/** Pure paper execution arithmetic. Money is integer cents; rates are basis points. */
export type ExecutionCosts = {
  entryFeeBps: number;
  exitFeeBps: number;
  spreadBps: number;
  slippageBps: number;
};
export const PAPER_COSTS: Readonly<ExecutionCosts> = Object.freeze({
  entryFeeBps: 60,
  exitFeeBps: 60,
  spreadBps: 10,
  slippageBps: 5,
});
export type PaperEntry = {
  quotedPrice: number;
  executionPrice: number;
  fee: number;
  quantity: number;
  openedAt: number;
  requestId: string;
};
export type PaperValuation = {
  marketPrice: number;
  grossMarketValue: number;
  exitExecutionPrice: number;
  exitNotional: number;
  exitFee: number;
  proceeds: number;
  entryCost: number;
  exitCost: number;
  grossProfit: number;
  netProfit: number;
};
export type PaperExecution = {
  costs: ExecutionCosts;
  entry: PaperEntry;
  marketPrice: number;
  exit?: PaperValuation & { closedAt: number };
};
export const validCosts = (v: unknown): v is ExecutionCosts => {
  if (!v || typeof v !== "object") return false;
  const c = v as ExecutionCosts;
  return ["entryFeeBps", "exitFeeBps", "spreadBps", "slippageBps"].every(
    (k) =>
      Number.isInteger(c[k as keyof ExecutionCosts]) &&
      c[k as keyof ExecutionCosts] >= 0 &&
      c[k as keyof ExecutionCosts] <= 1000,
  );
};
export const validPrice = (price: number) =>
  Number.isFinite(price) && price > 0 && price <= 1e9;
export const basisPercent = (bps: number) => `${(bps / 100).toFixed(2)}%`;
const impact = (costs: ExecutionCosts) =>
  (costs.spreadBps / 2 + costs.slippageBps) / 10000;
const fee = (cents: number, bps: number) => Math.ceil((cents * bps) / 10000);
export function openPaper(
  amount: number,
  quotedPrice: number,
  openedAt: number,
  requestId: string,
  costs: ExecutionCosts = PAPER_COSTS,
): PaperExecution {
  if (
    !Number.isSafeInteger(amount) ||
    amount < 100 ||
    !validPrice(quotedPrice) ||
    !validCosts(costs) ||
    !Number.isSafeInteger(openedAt) ||
    openedAt <= 0 ||
    typeof requestId !== "string" ||
    !requestId.trim() ||
    requestId.length > 100
  )
    throw new Error("Invalid paper entry");
  const entryFee = fee(amount, costs.entryFeeBps);
  const executionPrice = quotedPrice * (1 + impact(costs));
  if (!Number.isFinite((amount - entryFee) / 100 / executionPrice))
    throw new Error("Invalid acquired quantity");
  return {
    costs: {
      entryFeeBps: costs.entryFeeBps,
      exitFeeBps: costs.exitFeeBps,
      spreadBps: costs.spreadBps,
      slippageBps: costs.slippageBps,
    },
    entry: {
      quotedPrice,
      executionPrice,
      fee: entryFee,
      quantity: (amount - entryFee) / 100 / executionPrice,
      openedAt,
      requestId,
    },
    marketPrice: quotedPrice,
  };
}
/** Fee rounded up, sale notional rounded down: estimates do not invent fractional cents. */
export function valuePaper(
  amount: number,
  execution: PaperExecution,
  marketPrice = execution.marketPrice,
): PaperValuation {
  const { entry, costs } = execution;
  const grossMarketValue = Math.floor(
    entry.quantity * marketPrice * 100 + 1e-8,
  );
  const entryMarketValue = Math.floor(
    entry.quantity * entry.quotedPrice * 100 + 1e-8,
  );
  const exitExecutionPrice = marketPrice * (1 - impact(costs));
  const exitNotional = Math.floor(
    entry.quantity * exitExecutionPrice * 100 + 1e-8,
  );
  const exitFee = fee(exitNotional, costs.exitFeeBps);
  const proceeds = exitNotional - exitFee;
  return {
    marketPrice,
    grossMarketValue,
    exitExecutionPrice,
    exitNotional,
    exitFee,
    proceeds,
    entryCost: amount - entryMarketValue,
    exitCost: grossMarketValue - proceeds,
    grossProfit: grossMarketValue - entryMarketValue,
    netProfit: proceeds - amount,
  };
}
/** Invert the same rounded valuation, selecting the first notional satisfying net proceeds. */
export function priceForNetProfit(
  amount: number,
  execution: PaperExecution,
  netProfit: number,
): number {
  const desired = Math.max(0, amount + netProfit);
  const rate = execution.costs.exitFeeBps;
  let notional = Math.ceil(desired / (1 - rate / 10000));
  while (notional - fee(notional, rate) < desired) notional++;
  while (notional > 0 && notional - 1 - fee(notional - 1, rate) >= desired)
    notional--;
  return (
    (notional + 1e-6) /
    (execution.entry.quantity * 100 * (1 - impact(execution.costs)))
  );
}
export function percentageTarget(amount: number, percentage: number): number {
  return Math.round((amount * percentage) / 100); // Net return on the entire invested capital, including entry fee.
}
/** Rebuild execution records from their immutable inputs, rejecting arithmetic tampering. */
export function restoreExecution(
  value: unknown,
  amount: number,
  profit: number,
  closed: boolean,
): PaperExecution | null {
  try {
    if (!value || typeof value !== "object") return null;
    const x = value as PaperExecution;
    if (!validCosts(x.costs) || !x.entry || !validPrice(x.marketPrice))
      return null;
    const clean = openPaper(
      amount,
      x.entry.quotedPrice,
      x.entry.openedAt,
      x.entry.requestId,
      x.costs,
    );
    if (
      x.entry.executionPrice !== clean.entry.executionPrice ||
      x.entry.fee !== clean.entry.fee ||
      x.entry.quantity !== clean.entry.quantity
    )
      return null;
    clean.marketPrice = x.marketPrice;
    const estimate = valuePaper(amount, clean);
    if (
      !Number.isSafeInteger(estimate.proceeds) ||
      estimate.proceeds < 0 ||
      estimate.netProfit !== profit
    )
      return null;
    if (closed) {
      if (
        !x.exit ||
        !Number.isSafeInteger(x.exit.closedAt) ||
        x.exit.closedAt < x.entry.openedAt
      )
        return null;
      for (const key of Object.keys(estimate) as (keyof PaperValuation)[])
        if (x.exit[key] !== estimate[key]) return null;
      clean.exit = { ...estimate, closedAt: x.exit.closedAt };
    } else if (x.exit !== undefined) return null;
    return clean;
  } catch {
    return null;
  }
}
