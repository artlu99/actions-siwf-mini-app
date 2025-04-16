import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { jwt } from "hono/jwt";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { lookupCastByHashOrWarpcastUrl } from "../lib/neynar";

const endpoint = "https://decent-bookmarks.artlu.xyz/?fid=";

const protectedRoutes = new Hono<{ Bindings: Env }>();

interface Bookmark {
  fid: number;
  username: string;
  hash: string;
}

protectedRoutes
  .use("*", (c, next) =>
    jwt({ secret: c.env.JWT_SECRET, alg: c.env.JWT_ALGORITHM })(c, next)
  )
  .get("/secret", (c) => {
    const payload = c.get("jwtPayload");
    if (!payload || !payload.fid || typeof payload.fid !== "number") {
      return c.json({ error: "Invalid token payload" }, 401);
    }
    return c.json({ fid: payload.fid, secret: c.env.SECRET });
  })
  .post("/signout", async (c) => {
    // consider adding the token to a blocklist
    // For now, just return success since the client will remove the token
    return c.json({ message: "Signed out successfully" });
  })
  .post(
    "/bookmark",
    zValidator(
      "json",
      z.object({
        hashOrUrl: z.string(),
      })
    ),
    async (c) => {
      const payload = c.get("jwtPayload");
      if (!payload || !payload.fid || typeof payload.fid !== "number") {
        return c.json({ error: "Invalid token payload" }, 401);
      }
      const fid = payload.fid;
      const { hashOrUrl } = c.req.valid("json");

      const cast = await lookupCastByHashOrWarpcastUrl(c.env, hashOrUrl);

      if (!cast || !cast.cast.author) {
        return c.json(
          {
            statusText: "Cast not found",
            hashOrUrl,
            cast,
          },
          404
        );
      }

      const bookmark: Bookmark = {
        fid: cast.cast.author.fid,
        username: cast.cast.author.username,
        hash: cast.cast.hash,
      };

      try {
        const response = await fetch(`${endpoint}${fid}`, {
          method: "POST",
          body: JSON.stringify(bookmark),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${c.env.DECENT_BOOKMARKS_SECRET}`,
          },
        });

        if (response.ok) {
          return c.json({ message: "Bookmark created", bookmark });
        }

        // don't use fetcher, it throws on all errors and we want to handle 403 without an error
        if (response.status === 403) {
          return c.json({ message: "Bookmark already exists" });
        }

        return c.json(
          { message: `Bookmark not created: ${response.statusText}` },
          response.status as ContentfulStatusCode
        );
      } catch (error) {
        return c.json({ message: "Error while creating bookmark" }, 500);
      }
    }
  );

export default protectedRoutes;
