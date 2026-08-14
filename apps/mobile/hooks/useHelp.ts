import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createHelpArticle,
  deleteHelpArticle,
  deleteHelpDocument,
  fetchHelpArticle,
  fetchHelpArticles,
  updateHelpArticle,
  uploadHelpDocument,
  uploadHelpPhoto,
} from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useSession } from '@/providers/SessionProvider';

export function useHelpArticles(houseId: string | undefined) {
  const { token } = useSession();
  return useQuery({
    queryKey: queryKeys.helpArticles(houseId ?? ''),
    enabled: !!token && !!houseId,
    queryFn: async () => {
      if (!token || !houseId) throw new Error('unauthorized');
      return fetchHelpArticles(token, houseId);
    },
  });
}

export function useHelpArticle(articleId: string | undefined) {
  const { token } = useSession();
  return useQuery({
    queryKey: queryKeys.helpArticle(articleId ?? ''),
    enabled: !!token && !!articleId,
    queryFn: async () => {
      if (!token || !articleId) throw new Error('unauthorized');
      return fetchHelpArticle(token, articleId);
    },
  });
}

export function useCreateHelpArticle(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; body?: string }) => {
      if (!token || !houseId) throw new Error('unauthorized');
      return createHelpArticle(token, houseId, input);
    },
    onSuccess: async () => {
      if (houseId) {
        await qc.invalidateQueries({ queryKey: queryKeys.helpArticles(houseId) });
      }
    },
  });
}

export function useUpdateHelpArticle(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { articleId: string; title: string; body: string }) => {
      if (!token) throw new Error('unauthorized');
      return updateHelpArticle(token, input.articleId, {
        title: input.title,
        body: input.body,
      });
    },
    onSuccess: async (article) => {
      await qc.setQueryData(queryKeys.helpArticle(article.id), article);
      if (houseId) {
        await qc.invalidateQueries({ queryKey: queryKeys.helpArticles(houseId) });
      }
    },
  });
}

export function useDeleteHelpArticle(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (articleId: string) => {
      if (!token) throw new Error('unauthorized');
      return deleteHelpArticle(token, articleId);
    },
    onSuccess: async (_void, articleId) => {
      if (houseId) {
        await qc.invalidateQueries({ queryKey: queryKeys.helpArticles(houseId) });
      }
      await qc.removeQueries({ queryKey: queryKeys.helpArticle(articleId) });
    },
  });
}

export function useUploadHelpPhoto(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      articleId: string;
      uri: string;
      mimeType?: string | null;
    }) => {
      if (!token) throw new Error('unauthorized');
      return uploadHelpPhoto(token, input.articleId, input.uri, input.mimeType);
    },
    onSuccess: async (_ph, input) => {
      await qc.invalidateQueries({ queryKey: queryKeys.helpArticle(input.articleId) });
      if (houseId) {
        await qc.invalidateQueries({ queryKey: queryKeys.helpArticles(houseId) });
      }
    },
  });
}

export function useUploadHelpDocument(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      articleId: string;
      uri: string;
      mimeType?: string | null;
      fileName?: string | null;
    }) => {
      if (!token) throw new Error('unauthorized');
      return uploadHelpDocument(
        token,
        input.articleId,
        input.uri,
        input.mimeType,
        input.fileName,
      );
    },
    onSuccess: async (_doc, input) => {
      await qc.invalidateQueries({ queryKey: queryKeys.helpArticle(input.articleId) });
      if (houseId) {
        await qc.invalidateQueries({ queryKey: queryKeys.helpArticles(houseId) });
      }
    },
  });
}

export function useDeleteHelpDocument(houseId: string | undefined, articleId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string) => {
      if (!token) throw new Error('unauthorized');
      return deleteHelpDocument(token, documentId);
    },
    onSuccess: async () => {
      if (articleId) {
        await qc.invalidateQueries({ queryKey: queryKeys.helpArticle(articleId) });
      }
      if (houseId) {
        await qc.invalidateQueries({ queryKey: queryKeys.helpArticles(houseId) });
      }
    },
  });
}
