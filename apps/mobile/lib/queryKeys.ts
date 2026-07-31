/** Central query keys — scope by houseId for domain data. */
export const queryKeys = {
  me: ['me'] as const,
  houses: ['houses'] as const,
  currentHouseId: ['currentHouseId'] as const,
  /** Future: occupation calendar */
  occupations: (houseId: string, month: string) =>
    ['occupations', houseId, month] as const,
};
