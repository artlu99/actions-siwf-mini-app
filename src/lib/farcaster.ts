import { getCustodyAddress } from "./fname";
import { getUserInfo } from "./neynar";

export const getAuthAddressesByFid = async (
  env: Env,
  fid: number
): Promise<`0x${string}`[] | null> => {
  const address = await getCustodyAddress(env, fid);
  if (address) {
    return [address as `0x${string}`];
  }

  // fallback + possible future use for multiple auth addresses
  const user = await getUserInfo(env, fid);
  if (user?.custody_address) {
    return [user.custody_address as `0x${string}`];
  }

  return null;
};
