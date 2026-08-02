/** Central query keys — scope by houseId for domain data. */
export const queryKeys = {
  me: ['me'] as const,
  houses: ['houses'] as const,
  currentHouseId: ['currentHouseId'] as const,
  occupations: (houseId: string, month: string) =>
    ['occupations', houseId, month] as const,
  checklistItems: (houseId: string) => ['checklistItems', houseId] as const,
  closings: (houseId: string) => ['closings', houseId] as const,
  closing: (closingId: string) => ['closing', closingId] as const,
};
