// Penumbra fixture — TypeScript (tint: blue)
import { useState, useEffect } from "react";

interface User {
  id: number;
  name: string;
  active: boolean;
  tags: string[];
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const greet = async (user: User): Promise<Result<string>> => {
  if (!user.active) return { ok: false, error: "inactive" };
  await new Promise((r) => setTimeout(r, 100));
  return { ok: true, value: `Hello, ${user.name}` };
};

const users: readonly User[] = [
  { id: 1, name: "Ada",   active: true,  tags: ["admin"] },
  { id: 2, name: "Grace", active: false, tags: [] },
];

// Test: regex, numbers, escape sequences
const re = /^hello\s+(\w+)$/gi;
const n = 0xff_ff + 1e3;
console.log(`matched ${re.test("hello world")}, n=${n}`);
