import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  localToUtc,
  almatyDate,
  almatyTime,
  shiftDay,
  isWeekday,
} from "../src/shared/lib/datetime.ts";

test("meeting inputs use the Almaty zone, not the computer's zone", () => {
  assert.equal(localToUtc("2026-11-23", "09:00"), "2026-11-23T04:00:00.000Z");
  assert.equal(localToUtc("2026-11-23", "17:00"), "2026-11-23T12:00:00.000Z");
  assert.equal(almatyTime("2026-11-23T12:00:00Z"), "17:00");
  assert.equal(almatyDate("2026-11-22T20:00:00Z"), "2026-11-23");
});
test("historical offsets are resolved through the IANA time zone", () => {
  assert.equal(localToUtc("2024-02-29", "09:00"), "2024-02-29T03:00:00.000Z");
  assert.equal(localToUtc("2024-03-01", "09:00"), "2024-03-01T04:00:00.000Z");
});
test("day navigation handles month boundaries and weekends", () => {
  assert.equal(shiftDay("2026-11-30", 1), "2026-12-01");
  assert.equal(isWeekday("2026-11-23"), true);
  assert.equal(isWeekday("2026-11-22"), false);
});
