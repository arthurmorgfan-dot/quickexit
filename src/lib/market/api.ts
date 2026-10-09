import { ASSETS, type Asset } from "../demo-trading";
import { TIMEFRAMES, SUPPORTED_INTERVALS, type Timeframe } from "./models";
import { createMarketService, MarketFailure } from "./service";
export function createMarketApi(
  market: ReturnType<typeof createMarketService>,
) {
  return async function GET(request: Request) {
    const p = new URL(request.url).searchParams,
      asset = p.get("asset"),
      kind = p.get("kind"),
      timeframe = p.get("timeframe");
    const headers = { "Cache-Control": "no-store" };
    if (
      !asset ||
      !Object.hasOwn(ASSETS, asset) ||
      !["quote", "stats", "history"].includes(kind ?? "") ||
      (kind === "history" && !([...TIMEFRAMES, ...SUPPORTED_INTERVALS] as readonly string[]).includes(timeframe ?? ""))
    )
      return Response.json(
        { error: "Invalid market request" },
        { status: 400, headers },
      );
    try {
      const result =
        kind === "quote"
          ? await market.quote(asset as Asset)
          : kind === "stats"
            ? await market.stats(asset as Asset)
            : await market.history(asset as Asset, timeframe as Timeframe);
      return Response.json(result, { headers });
    } catch (error) {
      return Response.json(
        { error: "Market data unavailable" },
        {
          status: 503,
          headers: {
            ...headers,
            "Retry-After": String(
              error instanceof MarketFailure ? error.retryAfter : 30,
            ),
          },
        },
      );
    }
  };
}
