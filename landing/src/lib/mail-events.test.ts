import assert from "node:assert/strict";
import test from "node:test";
import { parsePostboxEvents } from "./mail-events";

test("parses SES-style hard bounce and ignores transient", () => {
  assert.deepEqual(
    parsePostboxEvents({
      eventType: "Bounce",
      bounce: {
        bounceType: "Permanent",
        bouncedRecipients: [{ emailAddress: "Bad@Example.com" }],
      },
    }),
    [{ email: "bad@example.com", reason: "hard_bounce", source: "postbox_bounce" }],
  );
  assert.deepEqual(
    parsePostboxEvents({
      eventType: "Bounce",
      bounce: { bounceType: "Transient", bouncedRecipients: [{ emailAddress: "soft@example.com" }] },
    }),
    [],
  );
});

test("parses complaint and SNS-wrapped records", () => {
  assert.deepEqual(
    parsePostboxEvents({
      eventType: "Complaint",
      complaint: { complainedRecipients: [{ emailAddress: "spam@example.com" }] },
    }),
    [{ email: "spam@example.com", reason: "complaint", source: "postbox_complaint" }],
  );
  assert.deepEqual(
    parsePostboxEvents({
      Records: [
        {
          body: JSON.stringify({
            eventType: "Bounce",
            mail: { destination: ["wrap@example.com"] },
          }),
        },
      ],
    }),
    [{ email: "wrap@example.com", reason: "hard_bounce", source: "postbox_bounce" }],
  );
});
