export type RatingDecision =
  | Readonly<{ accepted: false; reason: "INVALID_RATING" }>
  | Readonly<{ accepted: true; valueHalfStars: number }>;

export function validateRating(valueHalfStars: number): RatingDecision {
  return Number.isInteger(valueHalfStars) && valueHalfStars >= 1 && valueHalfStars <= 10
    ? { accepted: true, valueHalfStars }
    : { accepted: false, reason: "INVALID_RATING" };
}
