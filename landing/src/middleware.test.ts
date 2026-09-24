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

test("girls plot L2 redirects to the hub; birthday tails do not", async () => {
  for (const path of [
    "/promty-dlya-foto-devushki/s-cvetami",
    "/promty-dlya-foto-devushki/portret",
    "/promty-dlya-foto-devushki/cherno-beloe",
  ]) {
    const response = await middleware(
      new NextRequest(`https://promptshot.ru${path}`),
    );
    assert.equal(response.status, 301);
    assert.equal(
      response.headers.get("location"),
      "https://promptshot.ru/promty-dlya-foto-devushki",
    );
  }

  const birthday = await middleware(
    new NextRequest("https://promptshot.ru/promty-dlya-foto-devushki/den-rozhdeniya"),
  );
  assert.notEqual(
    birthday.headers.get("location"),
    "https://promptshot.ru/promty-dlya-foto-devushki",
  );
});

test("men plot L2 redirects to the hub; birthday tails do not", async () => {
  for (const path of [
    "/promty-dlya-foto-muzhchiny/s-mashinoy",
    "/promty-dlya-foto-muzhchiny/portret",
    "/promty-dlya-foto-muzhchiny/cherno-beloe",
  ]) {
    const response = await middleware(
      new NextRequest(`https://promptshot.ru${path}`),
    );
    assert.equal(response.status, 301);
    assert.equal(
      response.headers.get("location"),
      "https://promptshot.ru/promty-dlya-foto-muzhchiny",
    );
  }

  const birthday = await middleware(
    new NextRequest("https://promptshot.ru/promty-dlya-foto-muzhchiny/den-rozhdeniya"),
  );
  assert.notEqual(
    birthday.headers.get("location"),
    "https://promptshot.ru/promty-dlya-foto-muzhchiny",
  );
});

test("legacy car URL redirects to the promty-dlya-foto hub", async () => {
  for (const path of ["/s-mashinoy", "/s-mashinoy/", "/s-mashinoy/portret"]) {
    const response = await middleware(
      new NextRequest(`https://promptshot.ru${path}`),
    );
    assert.equal(response.status, 301);
    assert.equal(
      response.headers.get("location"),
      "https://promptshot.ru/promty-dlya-foto/s-mashinoy",
    );
  }

  const hub = await middleware(
    new NextRequest("https://promptshot.ru/promty-dlya-foto/s-mashinoy"),
  );
  assert.notEqual(hub.status, 301);
});

test("legacy avatar URL redirects to the promty-dlya-foto hub", async () => {
  for (const path of ["/foto-na-avatarku", "/foto-na-avatarku/", "/foto-na-avatarku/portret"]) {
    const response = await middleware(
      new NextRequest(`https://promptshot.ru${path}`),
    );
    assert.equal(response.status, 301);
    assert.equal(
      response.headers.get("location"),
      "https://promptshot.ru/promty-dlya-foto/na-avatarku",
    );
  }
});

test("legacy sea URL redirects to the promty-dlya-foto hub", async () => {
  for (const path of ["/na-more", "/na-more/", "/na-more/portret"]) {
    const response = await middleware(
      new NextRequest(`https://promptshot.ru${path}`),
    );
    assert.equal(response.status, 301);
    assert.equal(
      response.headers.get("location"),
      "https://promptshot.ru/promty-dlya-foto/na-more",
    );
  }
});

test("legacy in-car URL redirects to the promty-dlya-foto hub", async () => {
  const response = await middleware(
    new NextRequest("https://promptshot.ru/v-mashine"),
  );
  assert.equal(response.status, 301);
  assert.equal(
    response.headers.get("location"),
    "https://promptshot.ru/promty-dlya-foto/v-mashine",
  );
});

test("legacy champagne URL redirects to the promty-dlya-foto hub", async () => {
  const response = await middleware(
    new NextRequest("https://promptshot.ru/s-shampanskim"),
  );
  assert.equal(response.status, 301);
  assert.equal(
    response.headers.get("location"),
    "https://promptshot.ru/promty-dlya-foto/s-shampanskim",
  );
});

test("legacy mirror URL redirects to the promty-dlya-foto hub", async () => {
  const response = await middleware(
    new NextRequest("https://promptshot.ru/v-zerkale"),
  );
  assert.equal(response.status, 301);
  assert.equal(
    response.headers.get("location"),
    "https://promptshot.ru/promty-dlya-foto/v-zerkale",
  );
});

test("legacy gym URL redirects to the promty-dlya-foto hub", async () => {
  const response = await middleware(
    new NextRequest("https://promptshot.ru/v-sportale"),
  );
  assert.equal(response.status, 301);
  assert.equal(
    response.headers.get("location"),
    "https://promptshot.ru/promty-dlya-foto/v-sportale",
  );
});

test("legacy motorcycle URL redirects to the promty-dlya-foto hub", async () => {
  const response = await middleware(
    new NextRequest("https://promptshot.ru/mototsikl"),
  );
  assert.equal(response.status, 301);
  assert.equal(
    response.headers.get("location"),
    "https://promptshot.ru/promty-dlya-foto/mototsikl",
  );
});

test("legacy cake URL redirects to the promty-dlya-foto hub", async () => {
  const response = await middleware(
    new NextRequest("https://promptshot.ru/s-tortom"),
  );
  assert.equal(response.status, 301);
  assert.equal(
    response.headers.get("location"),
    "https://promptshot.ru/promty-dlya-foto/s-tortom",
  );
});

test("legacy horse URL redirects to the promty-dlya-foto hub", async () => {
  const response = await middleware(
    new NextRequest("https://promptshot.ru/s-loshadyu"),
  );
  assert.equal(response.status, 301);
  assert.equal(
    response.headers.get("location"),
    "https://promptshot.ru/promty-dlya-foto/s-loshadyu",
  );
});

test("legacy forest URL redirects to the promty-dlya-foto hub", async () => {
  const response = await middleware(
    new NextRequest("https://promptshot.ru/v-lesu"),
  );
  assert.equal(response.status, 301);
  assert.equal(
    response.headers.get("location"),
    "https://promptshot.ru/promty-dlya-foto/v-lesu",
  );
});
