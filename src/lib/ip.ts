import { createHash } from "crypto";
import type { NextRequest } from "next/server";

/** 원본 IP는 저장하지 않고 salt+SHA-256 해시만 사용한다. */
export function ipHashFrom(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = (fwd ? fwd.split(",")[0] : req.headers.get("x-real-ip")) ?? "unknown";
  const salt = process.env.IP_HASH_SALT ?? "gymprice-default-salt";
  return createHash("sha256").update(salt + ip.trim()).digest("hex");
}
