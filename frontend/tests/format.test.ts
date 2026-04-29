import { formatDateTimeWithZone, formatMinutesOfDay, parseApiDate } from "@/lib/format";

describe("format helpers", () => {
  test("treats timezone-less API timestamps as UTC", () => {
    expect(parseApiDate("2026-04-26T11:05:00").toISOString()).toBe("2026-04-26T11:05:00.000Z");
    expect(formatDateTimeWithZone("2026-04-26T11:05:00")).toBe("04.26 20:05 KST");
  });

  test("keeps explicit timezone offsets intact", () => {
    expect(formatDateTimeWithZone("2026-04-26T11:05:00+09:00")).toBe("04.26 11:05 KST");
  });

  test("formats minutes of day as a time label", () => {
    expect(formatMinutesOfDay(550)).toBe("09:10");
    expect(formatMinutesOfDay(null)).toBe("-");
  });
});
