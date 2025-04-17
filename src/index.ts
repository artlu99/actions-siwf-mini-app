import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { sign } from "hono/jwt";
import { secureHeaders } from "hono/secure-headers";
import { verifyMessage } from "viem";
import { z } from "zod";
import { getAuthAddressesByFid } from "./lib/farcaster";
import hashOrUrlRoute from "./routes/hashOrUrl";
import protectedRoutes from "./routes/protected";

const app = new Hono<{ Bindings: Env }>();

// Open routes (no CSRF protection needed)
app.post("/api/webhook", async (c) => {
  try {
    const body = await c.req.json();
    console.log("Received webhook:", body);
    return c.json({ message: "Webhook received" });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return c.json({ error: "No body in POST request" });
  }
});

// Apply middleware to all other routes
app
  .use("*", cors())
  .use("*", secureHeaders())
  .use("*", (c, next) => csrf({ origin: [c.env.BASE_URL] })(c, next));

// API routes
app
  .basePath("/api")
  .get("/", (c) => {
    const { MY_VAR } = c.env;
    return c.json({ MY_VAR });
  })
  .post(
    "/verify-signin",
    zValidator(
      "json",
      z.object({
        signature: z
          .string()
          .regex(/^0x[a-fA-F0-9]+$/)
          .transform((val) => val as `0x${string}`),
        message: z.string(),
        fid: z.number(),
      })
    ),
    async (c) => {
      try {
        const { signature, message, fid } = c.req.valid("json");

        const addresses = await getAuthAddressesByFid(c.env, Number(fid));
        if (!addresses || addresses.length === 0) {
          return c.json({ error: "No auth address" }, 401);
        }

        // Race the verifications - if any one succeeds, we get true
        const verificationPromises = addresses.map((address) =>
          verifyMessage({ address, message, signature })
        );
        const isValidSignature = await Promise.race([
          // First promise: any successful verification
          Promise.any(verificationPromises),
          // Second promise: all failed verifications
          Promise.all(
            verificationPromises.map((p) => p.catch(() => false))
          ).then((results) => results.every((r) => r === false)),
        ]);
        if (!isValidSignature) {
          return c.json({ error: "Invalid signature" }, 401);
        }

        // Generate JWT token
        const payload = {
          sub: "farcaster_user",
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
          fid: fid,
        };

        const token = await sign(
          payload,
          c.env.JWT_SECRET,
          c.env.JWT_ALGORITHM
        );
        return c.json({ token, fid });
      } catch (error) {
        console.error("Error processing sign-in:", error);
        return c.json({ error: "Failed to process sign-in" }, 400);
      }
    }
  )
  .route("/protected", protectedRoutes)
  // Add the hash/url route last to avoid catching other routes
  .route("/", hashOrUrlRoute);

export default app;
