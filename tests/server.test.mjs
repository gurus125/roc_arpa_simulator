import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { handle } from "../server/server.mjs";

describe("classroom server relay", () => {
  it("relays posted messages to pollers in order, and rejects bad input", async () => {
    const srv = createServer(handle);
    await new Promise((r) => srv.listen(0, r));
    const base = `http://127.0.0.1:${srv.address().port}`;
    try {
      const first = await (await fetch(`${base}/api/poll?since=0`)).json();
      await fetch(`${base}/api/post`, { method: "POST", body: JSON.stringify({ kind: "status", n: 1 }) });
      await fetch(`${base}/api/post`, { method: "POST", body: JSON.stringify({ kind: "status", n: 2 }) });
      const got = await (await fetch(`${base}/api/poll?since=${first.seq}`)).json();
      expect(got.messages.map((m) => m.n)).toEqual([1, 2]);
      expect(got.seq).toBe(first.seq + 2);
      const none = await (await fetch(`${base}/api/poll?since=${got.seq}`)).json();
      expect(none.messages).toEqual([]);
      expect((await fetch(`${base}/api/post`, { method: "POST", body: "{not json" })).status).toBe(400);
      expect((await fetch(`${base}/nothing`)).status).toBe(404);
    } finally {
      srv.close();
    }
  });
});
