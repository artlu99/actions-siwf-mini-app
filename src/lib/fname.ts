import { fetcher } from "itty-fetcher";

type TransfersResponse = {
  transfers: {
    id: number;
    timestamp: number;
    username: string;
    owner: string;
    from: number;
    to: number;
    user_signature: string;
    server_signature: string;
  }[];
};

const fnamesApi = fetcher({ base: "https://fnames.farcaster.xyz" });

const cachedFetcherGet = async <T>(env: Env, url: string, ttl: number) => {
  const cache = await env.KV.get(`fnames:${url}`);

  if (cache) {
    return JSON.parse(cache) as T;
  }

  const res = await fnamesApi.get(url);

  await env.KV.put(`fnames:${url}`, JSON.stringify(res), {
    expirationTtl: ttl,
  });

  return res as T;
};

export const getCustodyAddress = async (env: Env, fid: number) => {
  try {
    const res = await cachedFetcherGet<TransfersResponse>(
      env,
      `/transfers?fid=${fid}`,
      2 * 60 * 60 // 2 hours
    );
    return res.transfers.length > 0
      ? res.transfers.slice().sort((a, b) => b.timestamp - a.timestamp)[0].owner
      : undefined;
  } catch (error) {
    console.error("Error fetching transfers:", error);
    return undefined;
  }
};
