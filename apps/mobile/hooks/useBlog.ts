import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addBlogComment,
  clearBlogReaction,
  createBlogPost,
  deleteBlogComment,
  deleteBlogPost,
  fetchBlogPost,
  fetchBlogPosts,
  setBlogReaction,
  uploadBlogPhoto,
} from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useSession } from '@/providers/SessionProvider';

export function useBlogPosts(houseId: string | undefined) {
  const { token } = useSession();
  return useQuery({
    queryKey: queryKeys.blogPosts(houseId ?? ''),
    enabled: !!token && !!houseId,
    queryFn: async () => {
      if (!token || !houseId) throw new Error('unauthorized');
      return fetchBlogPosts(token, houseId);
    },
  });
}

export function useBlogPost(postId: string | undefined) {
  const { token } = useSession();
  return useQuery({
    queryKey: queryKeys.blogPost(postId ?? ''),
    enabled: !!token && !!postId,
    queryFn: async () => {
      if (!token || !postId) throw new Error('unauthorized');
      return fetchBlogPost(token, postId);
    },
  });
}

export function useCreateBlogPost(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; body?: string }) => {
      if (!token || !houseId) throw new Error('unauthorized');
      return createBlogPost(token, houseId, input);
    },
    onSuccess: async () => {
      if (houseId) {
        await qc.invalidateQueries({ queryKey: queryKeys.blogPosts(houseId) });
      }
    },
  });
}

export function useDeleteBlogPost(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      if (!token) throw new Error('unauthorized');
      return deleteBlogPost(token, postId);
    },
    onSuccess: async (_void, postId) => {
      if (houseId) {
        await qc.invalidateQueries({ queryKey: queryKeys.blogPosts(houseId) });
      }
      await qc.removeQueries({ queryKey: queryKeys.blogPost(postId) });
    },
  });
}

export function useUploadBlogPhoto(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      postId: string;
      uri: string;
      mimeType?: string | null;
    }) => {
      if (!token) throw new Error('unauthorized');
      return uploadBlogPhoto(token, input.postId, input.uri, input.mimeType);
    },
    onSuccess: async (_ph, input) => {
      await qc.invalidateQueries({ queryKey: queryKeys.blogPost(input.postId) });
      if (houseId) {
        await qc.invalidateQueries({ queryKey: queryKeys.blogPosts(houseId) });
      }
    },
  });
}

export function useAddBlogComment() {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { postId: string; body: string }) => {
      if (!token) throw new Error('unauthorized');
      return addBlogComment(token, input.postId, input.body);
    },
    onSuccess: async (_c, input) => {
      await qc.invalidateQueries({ queryKey: queryKeys.blogPost(input.postId) });
    },
  });
}

export function useDeleteBlogComment() {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { commentId: string; postId: string }) => {
      if (!token) throw new Error('unauthorized');
      return deleteBlogComment(token, input.commentId);
    },
    onSuccess: async (_void, input) => {
      await qc.invalidateQueries({ queryKey: queryKeys.blogPost(input.postId) });
    },
  });
}

export function useSetBlogReaction(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { postId: string; emoji: string }) => {
      if (!token) throw new Error('unauthorized');
      return setBlogReaction(token, input.postId, input.emoji);
    },
    onSuccess: async (_reactions, input) => {
      await qc.invalidateQueries({ queryKey: queryKeys.blogPost(input.postId) });
      if (houseId) {
        await qc.invalidateQueries({ queryKey: queryKeys.blogPosts(houseId) });
      }
    },
  });
}

export function useClearBlogReaction(houseId: string | undefined) {
  const { token } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      if (!token) throw new Error('unauthorized');
      return clearBlogReaction(token, postId);
    },
    onSuccess: async (_void, postId) => {
      await qc.invalidateQueries({ queryKey: queryKeys.blogPost(postId) });
      if (houseId) {
        await qc.invalidateQueries({ queryKey: queryKeys.blogPosts(houseId) });
      }
    },
  });
}
