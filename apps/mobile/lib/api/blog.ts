import { apiBaseUrl, authHeaders, getJSON } from '@/lib/api/http';
import { uploadPhotoMultipart } from '@/lib/api/upload';

export type BlogPhoto = {
  id: string;
  post_id: string;
  content_type: string;
  created_at: string;
};

export type BlogReaction = {
  emoji: string;
  count: number;
  mine: boolean;
};

export type BlogComment = {
  id: string;
  post_id: string;
  author_sub: string;
  author_name: string;
  body: string;
  created_at: string;
};

export type BlogMention = {
  user_sub: string;
  display_name: string;
  email?: string;
};

export type BlogPost = {
  id: string;
  house_id: string;
  author_sub: string;
  author_name: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  mentions: BlogMention[];
  photos: BlogPhoto[];
  reactions: BlogReaction[];
  comments?: BlogComment[];
};

export async function fetchBlogPosts(
  accessToken: string,
  houseId: string,
): Promise<BlogPost[]> {
  return getJSON(`/houses/${houseId}/posts`, {
    headers: authHeaders(accessToken),
  });
}

export async function createBlogPost(
  accessToken: string,
  houseId: string,
  input: {
    title: string;
    body?: string;
    tags?: string[];
    mentions?: string[];
  },
): Promise<BlogPost> {
  return getJSON(`/houses/${houseId}/posts`, {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function fetchBlogPost(
  accessToken: string,
  postId: string,
): Promise<BlogPost> {
  return getJSON(`/posts/${postId}`, {
    headers: authHeaders(accessToken),
  });
}

export async function deleteBlogPost(accessToken: string, postId: string): Promise<void> {
  const res = await fetch(`${apiBaseUrl()}/posts/${postId}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
}

export async function uploadBlogPhoto(
  accessToken: string,
  postId: string,
  uri: string,
  mimeType?: string | null,
): Promise<BlogPhoto> {
  return uploadPhotoMultipart(accessToken, `/posts/${postId}/photos`, uri, mimeType);
}

export function blogPhotoUrl(photoId: string): string {
  return `${apiBaseUrl()}/blog-photos/${photoId}`;
}

export async function addBlogComment(
  accessToken: string,
  postId: string,
  body: string,
): Promise<BlogComment> {
  return getJSON(`/posts/${postId}/comments`, {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });
}

export async function deleteBlogComment(
  accessToken: string,
  commentId: string,
): Promise<void> {
  const res = await fetch(`${apiBaseUrl()}/comments/${commentId}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
}

export async function setBlogReaction(
  accessToken: string,
  postId: string,
  emoji: string,
): Promise<BlogReaction[]> {
  return getJSON(`/posts/${postId}/reactions`, {
    method: 'PUT',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ emoji }),
  });
}

export async function clearBlogReaction(
  accessToken: string,
  postId: string,
): Promise<void> {
  const res = await fetch(`${apiBaseUrl()}/posts/${postId}/reactions`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
}
