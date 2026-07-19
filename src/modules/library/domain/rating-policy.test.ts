import { describe, expect, it } from "vitest";

import { validateRating } from "./rating-policy";

describe("rating policy", () => {
  it.each([1, 5, 10])("accepts integer half-star value %d", (valueHalfStars) => {
    expect(validateRating(valueHalfStars)).toEqual({ accepted: true, valueHalfStars });
  });

  it.each([0, 11, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid half-star value %s",
    (valueHalfStars) => {
      expect(validateRating(valueHalfStars)).toEqual({
        accepted: false,
        reason: "INVALID_RATING",
      });
    },
  );
});
