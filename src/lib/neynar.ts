import type {
  BulkUsersResponse,
  CastParamType,
  CastResponse,
} from "@neynar/nodejs-sdk/build/api";
import { fetcher } from "itty-fetcher";

const neynarApi = fetcher({ base: "https://api.neynar.com" });
const LONG_TTL = 30 * 24 * 60 * 60; // 30 days
const SHORT_TTL = 30 * 60; // 30 minutes

const cachedFetcherGet = async <T>(env: Env, url: string, ttl: number) => {
  const cache = await env.KV.get(`neynar:${url}`);

  if (cache) {
    return JSON.parse(cache) as T;
  }

  const res = await neynarApi.get(url, undefined, {
    headers: {
      "x-api-key": env.NEYNAR_API_KEY,
      "x-neynar-experimental": "false",
    },
  });

  await env.KV.put(`neynar:${url}`, JSON.stringify(res), {
    expirationTtl: ttl,
  });

  return res as T;
};

export const lookupCastByHashOrWarpcastUrl = async (
  env: Env,
  hashOrUrl: string
) => {
  const type: CastParamType = hashOrUrl.startsWith("https://warpcast.com/")
    ? "url"
    : "hash";

  try {
    const res = await cachedFetcherGet<CastResponse>(
      env,
      `/v2/farcaster/cast?identifier=${encodeURIComponent(
        hashOrUrl
      )}&type=${type}`,
      LONG_TTL
    );
    return res;
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : JSON.stringify(error)
    );
    return null;
  }
};

export const getUserInfo = async (env: Env, fid: number) => {
  try {
    const res = await cachedFetcherGet<BulkUsersResponse>(
      env,
      `/v2/farcaster/user/bulk?fids=${fid}`,
      SHORT_TTL
    );
    return res.users[0];
  } catch (error) {
    console.error("Error fetching user info:", error);
    return undefined;
  }
};
