import { createMarketApi } from "@/lib/market/api";
import {
  createExchangeProvider,
  createMarketService,
} from "@/lib/market/service";
export const GET = createMarketApi(
  createMarketService(createExchangeProvider()),
);
