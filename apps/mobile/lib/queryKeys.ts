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
  houseMembers: (houseId: string) => ['houseMembers', houseId] as const,
  blogPosts: (houseId: string) => ['blogPosts', houseId] as const,
  blogPost: (postId: string) => ['blogPost', postId] as const,
  helpArticles: (houseId: string) => ['helpArticles', houseId] as const,
  helpArticle: (articleId: string) => ['helpArticle', articleId] as const,
};
