import assert from "node:assert/strict";
import test from "node:test";
import { optimisticPhotoshootEnabled } from "./photoshoot-availability";

test("optimistic photoshoot tile follows cache, then fotosessii path", () => {
  assert.equal(
    optimisticPhotoshootEnabled({ pathname: "/ii-fotosessiya", cached: true }),
    true,
  );
  assert.equal(
    optimisticPhotoshootEnabled({ pathname: "/ii-fotosessiya", cached: false }),
    false,
  );
  assert.equal(
    optimisticPhotoshootEnabled({ pathname: "/ii-fotosessiya", cached: null }),
    true,
  );
  assert.equal(
    optimisticPhotoshootEnabled({
      pathname: "/promty-dlya-ii-fotosessii/zhenskie",
      cached: null,
    }),
    true,
  );
  assert.equal(
    optimisticPhotoshootEnabled({ pathname: "/foto-v-promt", cached: null }),
    false,
  );
  assert.equal(
    optimisticPhotoshootEnabled({ pathname: "/", cached: null }),
    false,
  );
});
