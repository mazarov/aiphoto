import { Agent, setGlobalDispatcher } from "undici";
setGlobalDispatcher(
  new Agent({ connect: { timeout: 60_000 }, bodyTimeout: 180_000, headersTimeout: 180_000 }),
);
