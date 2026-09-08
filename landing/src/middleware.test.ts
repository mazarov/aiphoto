import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

test("pairs children redirect to the hub with exact 301", async () => {
  for (const path of [
    "/promty-dlya-foto-par/cherno-beloe",
    "/promty-dlya-foto-par/v-mashine",
    "/promty-dlya-foto-par/osen",
    "/promty-dlya-foto-s-parnem",
  ]) {
    const response = await middleware(
      new NextRequest(`https://promptshot.ru${path}?sort=popular`),
    );

    assert.equal(response.status, 301);
    assert.equal(
      response.headers.get("location"),
      "https://promptshot.ru/promty-dlya-foto-par",
    );
  }
});
