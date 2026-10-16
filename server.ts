/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Security & Content Headers Middleware
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: "500kb" }));

// In-Memory Rate Limiter Store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function createRateLimiter(maxRequests: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    const now = Date.now();
    const record = rateLimitStore.get(ip);

    if (!record || now > record.resetTime) {
      rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({
        error: "Too many requests. Please slow down.",
        retryAfterMs: record.resetTime - now,
      });
    }

    record.count++;
    next();
  };
}

// Clean public healthcheck
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

const HYPERLIQUID_INFO_URL =
  "https://api.hyperliquid.xyz/info";

const CANDLE_VALID_INTERVALS = new Set([
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1M",
]);

const CANDLE_INTERVAL_MS: Record<
  string,
  number
> = {
  "1m": 60000,
  "3m": 180000,
  "5m": 300000,
  "15m": 900000,
  "30m": 1800000,
  "1h": 3600000,
  "2h": 7200000,
  "4h": 14400000,
  "8h": 28800000,
  "12h": 43200000,
  "1d": 86400000,
  "3d": 259200000,
  "1w": 604800000,
  "1M": 2592000000,
};

const CANDLE_MAX_LOOKBACK_MS =
  5 * 365 * 86_400_000;

const CANDLE_META_CACHE_TTL_MS =
  10_000;

const CANDLE_CRYPTO_COINS =
  new Set([
    "BTC",
    "ETH",
    "SOL",
    "XRP",
    "ZEC",
    "HYPE",
    "LIT",
    "BNB",
    "LINK",
    "AAVE",
    "NEAR",
    "ARB",
    "JUP",
    "JTO",
    "PYTH",
    "PUMP",
    "SUI",
    "KNTQ",
    "XPL",
    "XMR",
    "UNI",
    "ONDO",
    "GRAM",
    "TRX",
    "LTC",
    "XLM",
    "HBAR",
    "BCH",
    "ADA",
    "AVAX",
    "ENA",
    "MON",
    "APT",
    "WLFI",
    "TAO",
    "WLD",
    "ZRO",
    "VIRTUAL",
    "VVV",
    "MEGA",
    "PONS",
    "ASTER",
    "USDT",
  ]);

const CANDLE_SPOT_ONLY_COINS =
  new Set([
    "KNTQ",
    "USDT",
  ]);

let candleMainMetaCache:
  any = null;

let candleMainMetaCacheAt = 0;

let candleMainMetaPromise:
  Promise<any> |
  null = null;

let candleSpotMetaCache:
  any = null;

let candleSpotMetaCacheAt = 0;

let candleSpotMetaPromise:
  Promise<any> |
  null = null;

async function fetchHyperliquidInfo(
  payload: Record<
    string,
    unknown
  >
): Promise<any> {
  const response =
    await fetch(
      HYPERLIQUID_INFO_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            payload
          ),
      }
    );

  if (!response.ok) {
    throw new Error(
      `Hyperliquid API error: ${response.status}`
    );
  }

  return response.json();
}

async function getCandleMainMetaAndAssetCtxs():
  Promise<any> {
  const now =
    Date.now();

  if (
    candleMainMetaCache !==
      null &&
    now -
      candleMainMetaCacheAt <
      CANDLE_META_CACHE_TTL_MS
  ) {
    return candleMainMetaCache;
  }

  if (
    candleMainMetaPromise
  ) {
    return candleMainMetaPromise;
  }

  const stale =
    candleMainMetaCache;

  const promise =
    fetchHyperliquidInfo({
      type:
        "metaAndAssetCtxs",
    })
      .then((data) => {
        candleMainMetaCache =
          data;

        candleMainMetaCacheAt =
          Date.now();

        return data;
      })
      .catch((error) => {
        if (
          stale !== null
        ) {
          return stale;
        }

        throw error;
      })
      .finally(() => {
        if (
          candleMainMetaPromise ===
          promise
        ) {
          candleMainMetaPromise =
            null;
        }
      });

  candleMainMetaPromise =
    promise;

  return promise;
}

async function getCandleSpotMetaAndAssetCtxs():
  Promise<any> {
  const now =
    Date.now();

  if (
    candleSpotMetaCache !==
      null &&
    now -
      candleSpotMetaCacheAt <
      CANDLE_META_CACHE_TTL_MS
  ) {
    return candleSpotMetaCache;
  }

  if (
    candleSpotMetaPromise
  ) {
    return candleSpotMetaPromise;
  }

  const stale =
    candleSpotMetaCache;

  const promise =
    fetchHyperliquidInfo({
      type:
        "spotMetaAndAssetCtxs",
    })
      .then((data) => {
        candleSpotMetaCache =
          data;

        candleSpotMetaCacheAt =
          Date.now();

        return data;
      })
      .catch((error) => {
        if (
          stale !== null
        ) {
          return stale;
        }

        throw error;
      })
      .finally(() => {
        if (
          candleSpotMetaPromise ===
          promise
        ) {
          candleSpotMetaPromise =
            null;
        }
      });

  candleSpotMetaPromise =
    promise;

  return promise;
}

function normalizeCandleCoinKey(
  coin: string
): string {
  return coin
    .trim()
    .toUpperCase();
}

function resolveCandleMainCoin(
  coin: string,
  universe: any[]
): string | null {
  const key =
    normalizeCandleCoinKey(
      coin
    );

  const aliases =
    new Set([
      key,
      `${key}-PERP`,
      `${key}-USD`,
    ]);

  for (
    const asset of universe
  ) {
    const name =
      String(
        asset?.name ??
        ""
      );

    if (
      aliases.has(
        name.toUpperCase()
      )
    ) {
      return name;
    }
  }

  return null;
}

function resolveCandleSpotCoin(
  coin: string,
  universe: any[],
  tokens: any[]
): string | null {
  const key =
    normalizeCandleCoinKey(
      coin
    );

  const names =
    new Map<
      string,
      string
    >();

  for (
    const entry of universe
  ) {
    const name =
      String(
        entry?.name ??
        ""
      );

    if (name) {
      names.set(
        name.toUpperCase(),
        name
      );
    }
  }

  if (
    names.has(key)
  ) {
    return (
      names.get(key) ??
      null
    );
  }

  const pair =
    `${key}/USDC`;

  if (
    names.has(pair)
  ) {
    return (
      names.get(pair) ??
      null
    );
  }

  const prefixedPair =
    `U${key}/USDC`;

  if (
    names.has(
      prefixedPair
    )
  ) {
    return (
      names.get(
        prefixedPair
      ) ??
      null
    );
  }

  if (
    key.startsWith("U") &&
    key.length > 1
  ) {
    const unprefixedPair =
      `${key.slice(
        1
      )}/USDC`;

    if (
      names.has(
        unprefixedPair
      )
    ) {
      return (
        names.get(
          unprefixedPair
        ) ??
        null
      );
    }
  }

  const usdcIndex =
    tokens.find(
      (token) =>
        String(
          token?.name ??
          ""
        ).toUpperCase() ===
        "USDC"
    )?.index;

  const candidates =
    key.startsWith("U")
      ? (
          key.length > 1
            ? [
                key,
                key.slice(1),
              ]
            : [key]
        )
      : [
          `U${key}`,
          key,
        ];

  for (
    const name of candidates
  ) {
    const token =
      tokens.find(
        (candidate) =>
          String(
            candidate?.name ??
            ""
          ).toUpperCase() ===
          name
      );

    if (
      token != null &&
      usdcIndex != null
    ) {
      for (
        const entry of universe
      ) {
        const entryTokens =
          Array.isArray(
            entry?.tokens
          )
            ? entry.tokens
            : [];

        if (
          entryTokens.length >=
            2 &&
          entryTokens[0] ===
            token?.index &&
          entryTokens[1] ===
            usdcIndex
        ) {
          return (
            entry?.name ??
            null
          );
        }
      }
    }
  }

  for (
    const name of candidates
  ) {
    const token =
      tokens.find(
        (candidate) => {
          const tokenName =
            String(
              candidate?.name ??
              ""
            ).toUpperCase();

          return (
            tokenName.startsWith(
              name
            ) &&
            tokenName.length <=
              name.length + 1
          );
        }
      );

    if (
      token != null &&
      usdcIndex != null
    ) {
      for (
        const entry of universe
      ) {
        const entryTokens =
          Array.isArray(
            entry?.tokens
          )
            ? entry.tokens
            : [];

        if (
          entryTokens.length >=
            2 &&
          entryTokens[0] ===
            token?.index &&
          entryTokens[1] ===
            usdcIndex
        ) {
          return (
            entry?.name ??
            null
          );
        }
      }
    }
  }

  return null;
}

app.get(
  "/api/candles/:coin",
  async (req, res) => {
    const coin =
      String(
        req.params.coin ??
        ""
      );

    const interval =
      typeof req.query.interval ===
        "string"
        ? req.query.interval
        : "1h";

    const limitValue =
      typeof req.query.limit ===
        "string"
        ? Number(
            req.query.limit
          )
        : 100;

    const startTimeValue =
      typeof req.query.startTime ===
        "string"
        ? Number(
            req.query.startTime
          )
        : undefined;

    const endTimeValue =
      typeof req.query.endTime ===
        "string"
        ? Number(
            req.query.endTime
          )
        : undefined;

    if (
      !coin
    ) {
      return res
        .status(404)
        .json({
          detail:
            "Asset not found",
        });
    }

    if (
      !CANDLE_VALID_INTERVALS.has(
        interval
      )
    ) {
      return res
        .status(400)
        .json({
          detail:
            `Invalid interval. Valid: ${JSON.stringify(
              Array.from(
                CANDLE_VALID_INTERVALS
              )
            )}`,
        });
    }

    if (
      !Number.isFinite(
        limitValue
      ) ||
      !Number.isInteger(
        limitValue
      )
    ) {
      return res
        .status(422)
        .json({
          detail:
            "Invalid limit",
        });
    }

    if (
      startTimeValue !==
        undefined &&
      (
        !Number.isFinite(
          startTimeValue
        ) ||
        !Number.isInteger(
          startTimeValue
        )
      )
    ) {
      return res
        .status(422)
        .json({
          detail:
            "Invalid startTime",
        });
    }

    if (
      endTimeValue !==
        undefined &&
      (
        !Number.isFinite(
          endTimeValue
        ) ||
        !Number.isInteger(
          endTimeValue
        )
      )
    ) {
      return res
        .status(422)
        .json({
          detail:
            "Invalid endTime",
        });
    }

    let limit =
      limitValue;

    const requestedCoin =
      coin;

    let targetCoin =
      coin;

    try {
      if (
        CANDLE_SPOT_ONLY_COINS.has(
          targetCoin
        )
      ) {
        const spotData =
          await getCandleSpotMetaAndAssetCtxs();

        if (
          !Array.isArray(
            spotData
          ) ||
          spotData.length < 2
        ) {
          return res
            .status(404)
            .json({
              detail:
                "Spot asset not found",
            });
        }

        const spotMeta =
          spotData[0] ??
          {};

        const universe =
          Array.isArray(
            spotMeta?.universe
          )
            ? spotMeta.universe
            : [];

        const tokens =
          Array.isArray(
            spotMeta?.tokens
          )
            ? spotMeta.tokens
            : [];

        const resolved =
          resolveCandleSpotCoin(
            targetCoin,
            universe,
            tokens
          );

        if (!resolved) {
          return res
            .status(404)
            .json({
              detail:
                "Spot asset not found",
            });
        }

        targetCoin =
          resolved;
      } else if (
        targetCoin.startsWith(
          "@"
        ) ||
        targetCoin
          .toUpperCase()
          .includes(
            "/USDC"
          )
      ) {
        // Exact ZIP-2 behavior:
        // resolved Hyperliquid spot identifiers pass through unchanged.
      } else if (
        CANDLE_CRYPTO_COINS.has(
          targetCoin
        )
      ) {
        const metaData =
          await getCandleMainMetaAndAssetCtxs();

        if (
          !Array.isArray(
            metaData
          ) ||
          metaData.length < 2
        ) {
          return res
            .status(404)
            .json({
              detail:
                "Asset not found",
            });
        }

        const meta =
          metaData[0] ??
          {};

        const universe =
          Array.isArray(
            meta?.universe
          )
            ? meta.universe
            : [];

        const resolved =
          resolveCandleMainCoin(
            targetCoin,
            universe
          );

        if (!resolved) {
          return res
            .status(404)
            .json({
              detail:
                "Asset not found",
            });
        }

        targetCoin =
          resolved;
      } else if (
        targetCoin.includes(":")
      ) {
        // Already-resolved HIP-3 protocol identity.
        // Leave targetCoin unchanged.
      } else {
        // Current Anonymous Liquid backend scope contains only
        // ZIP-2 crypto + curated Spot.
        // Do not invent the excluded HIP-3/forex branch.
        return res
          .status(404)
          .json({
            detail:
              "Asset not found",
          });
      }
    } catch (error) {
      console.error(
        `Error resolving candles for ${targetCoin}:`,
        error
      );

      return res
        .status(500)
        .json({
          detail:
            error instanceof Error
              ? error.message
              : String(error),
        });
    }

    if (
      interval ===
      "1M"
    ) {
      limit =
        Math.min(
          limit,
          120
        );
    }

    const nowMs =
      Date.now();

    const intervalMsValue =
      CANDLE_INTERVAL_MS[
        interval
      ] ??
      3600000;

    const endTime =
      endTimeValue !==
        undefined
        ? endTimeValue
        : nowMs;

    let startTime =
      startTimeValue !==
        undefined
        ? startTimeValue
        : endTime -
          (
            intervalMsValue *
            limit
          );

    startTime =
      Math.max(
        startTime,
        nowMs -
          CANDLE_MAX_LOOKBACK_MS
      );

    if (
      startTime >=
      endTime
    ) {
      return res
        .status(400)
        .json({
          detail:
            "startTime must be less than endTime",
        });
    }

    const fetchSnapshot =
      async (
        snapshotCoin:
          string
      ) => {
        const payload = {
          type:
            "candleSnapshot",

          req: {
            coin:
              snapshotCoin,
            interval,
            startTime,
            endTime,
          },
        };

        const response =
          await fetch(
            HYPERLIQUID_INFO_URL,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  payload
                ),
            }
          );

        let data:
          unknown = null;

        try {
          data =
            await response.json();
        } catch {
          data = null;
        }

        return {
          status:
            response.status,
          data,
        };
      };

    try {
      let {
        status,
        data,
      } =
        await fetchSnapshot(
          targetCoin
        );

      if (
        status !== 200 ||
        !Array.isArray(
          data
        )
      ) {
        if (
          requestedCoin !==
          targetCoin
        ) {
          const fallback =
            await fetchSnapshot(
              requestedCoin
            );

          if (
            fallback.status ===
              200 &&
            Array.isArray(
              fallback.data
            )
          ) {
            status =
              fallback.status;

            data =
              fallback.data;

            targetCoin =
              requestedCoin;
          }
        }

        if (
          !Array.isArray(
            data
          )
        ) {
          let detail =
            "Invalid candle data from Hyperliquid";

          if (
            data &&
            typeof data ===
              "object" &&
            "error" in data
          ) {
            detail =
              `Invalid candle data from Hyperliquid: ${String(
                (
                  data as {
                    error?: unknown;
                  }
                ).error
              )}`;
          }

          throw new Error(
            `502: ${detail}`
          );
        }
      }

      const candles =
        data.map(
          (
            candle:
              any
          ) => ({
            t:
              candle?.t,

            o:
              candle?.o,

            h:
              candle?.h,

            l:
              candle?.l,

            c:
              candle?.c,

            v:
              candle?.v,

            n:
              candle?.n,
          })
        );

      return res.json({
        candles,
        coin:
          targetCoin,
        interval,
      });
    } catch (error) {
      console.error(
        `Error fetching candles for ${targetCoin}:`,
        error
      );

      return res
        .status(500)
        .json({
          detail:
            error instanceof Error
              ? error.message
              : String(error),
        });
    }
  }
);

// Configure Vite middleware or Static build files depending on runtime environment
async function configureAssets() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware loaded.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static production files from dist directory.");
  }
}

configureAssets().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express custom server running successfully on port ${PORT}`);
  });
}).catch(err => {
  console.error("Failed to start server asset configuration:", err);
});
