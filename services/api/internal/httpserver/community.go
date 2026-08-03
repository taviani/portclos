package httpserver

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/taviani/portclos/services/api/internal/auth"
	"github.com/taviani/portclos/services/api/internal/media"
	"github.com/taviani/portclos/services/api/internal/store"
)

var allowedReactions = map[string]bool{
	"👍": true, "❤️": true, "😂": true, "😮": true, "😢": true, "🏠": true, "🙏": true,
}

func mountCommunityRoutes(pr chi.Router, db *store.Store, files *media.Store) {
	pr.Get("/me", func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		p, err := db.GetOrCreateProfile(r.Context(), user.Subject)
		if err != nil {
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		p.Email = user.Email
		writeJSON(w, http.StatusOK, p)
	})

	pr.Patch("/me", func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		var body struct {
			DisplayName string `json:"display_name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error":"invalid_json"}`, http.StatusBadRequest)
			return
		}
		name := strings.TrimSpace(body.DisplayName)
		if len(name) > 80 {
			http.Error(w, `{"error":"display_name_too_long"}`, http.StatusBadRequest)
			return
		}
		p, err := db.UpdateDisplayName(r.Context(), user.Subject, name)
		if err != nil {
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		p.Email = user.Email
		writeJSON(w, http.StatusOK, p)
	})

	pr.Post("/me/avatar", func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		_, contentType, buf, okUpload := readImageUpload(w, r)
		if !okUpload {
			return
		}
		photoID := uuid.NewString()
		storageKey := "avatars/" + photoID + media.ExtForContentType(contentType)
		if err := files.Save(storageKey, bytes.NewReader(buf)); err != nil {
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		old, p, err := db.SetAvatar(r.Context(), user.Subject, storageKey, contentType)
		if err != nil {
			_ = files.Remove(storageKey)
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		if old.StorageKey != "" && old.StorageKey != storageKey {
			_ = files.Remove(old.StorageKey)
		}
		p.Email = user.Email
		writeJSON(w, http.StatusOK, p)
	})

	pr.Get("/avatars/{userSub}", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := auth.UserFromContext(r.Context()); !ok {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		meta, err := db.GetAvatarFile(r.Context(), chi.URLParam(r, "userSub"))
		if err != nil {
			writeStoreErr(w, err)
			return
		}
		f, err := files.Open(meta.StorageKey)
		if err != nil {
			http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
			return
		}
		defer f.Close()
		w.Header().Set("Content-Type", meta.ContentType)
		http.ServeContent(w, r, meta.UserSub, meta.UpdatedAt, f)
	})

	pr.Delete("/me/avatar", func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		old, err := db.DeleteAvatar(r.Context(), user.Subject)
		if err != nil {
			writeStoreErr(w, err)
			return
		}
		_ = files.Remove(old.StorageKey)
		w.WriteHeader(http.StatusNoContent)
	})

	pr.Get("/houses/{id}/members", func(w http.ResponseWriter, r *http.Request) {
		_, houseID, ok := memberHouse(w, r, db)
		if !ok {
			return
		}
		list, err := db.ListHouseMembers(r.Context(), houseID)
		if err != nil {
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, list)
	})

	// Blog
	pr.Get("/houses/{id}/posts", func(w http.ResponseWriter, r *http.Request) {
		user, houseID, ok := memberHouse(w, r, db)
		if !ok {
			return
		}
		list, err := db.ListBlogPosts(r.Context(), houseID, user.Subject)
		if err != nil {
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, list)
	})

	pr.Post("/houses/{id}/posts", func(w http.ResponseWriter, r *http.Request) {
		user, houseID, ok := memberHouse(w, r, db)
		if !ok {
			return
		}
		var body struct {
			Title    string   `json:"title"`
			Body     string   `json:"body"`
			Tags     []string `json:"tags"`
			Mentions []string `json:"mentions"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error":"invalid_json"}`, http.StatusBadRequest)
			return
		}
		title := strings.TrimSpace(body.Title)
		if title == "" {
			http.Error(w, `{"error":"title_required"}`, http.StatusBadRequest)
			return
		}
		tags, err := store.NormalizeBlogTags(body.Tags)
		if err != nil {
			http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
			return
		}
		mentions := store.UniqueNonEmpty(body.Mentions)
		if len(mentions) > store.MaxBlogMentions() {
			http.Error(w, `{"error":"too_many_mentions"}`, http.StatusBadRequest)
			return
		}
		okMembers, err := db.AreHouseMembers(r.Context(), houseID, mentions)
		if err != nil {
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		if !okMembers {
			http.Error(w, `{"error":"mention_not_member"}`, http.StatusBadRequest)
			return
		}
		p, err := db.CreateBlogPost(
			r.Context(), houseID, user.Subject, title, strings.TrimSpace(body.Body), tags, mentions,
		)
		if err != nil {
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, p)
	})

	pr.Get("/posts/{postId}", func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		postID := chi.URLParam(r, "postId")
		houseID, err := db.GetBlogPostHouseID(r.Context(), postID)
		if err != nil {
			writeStoreErr(w, err)
			return
		}
		if _, err := db.GetHouseForMember(r.Context(), houseID, user.Subject); err != nil {
			writeStoreErr(w, err)
			return
		}
		p, err := db.GetBlogPost(r.Context(), postID, user.Subject)
		if err != nil {
			writeStoreErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, p)
	})

	pr.Delete("/posts/{postId}", func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		if err := db.DeleteBlogPost(r.Context(), chi.URLParam(r, "postId"), user.Subject); err != nil {
			writeStoreErr(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	pr.Post("/posts/{postId}/photos", func(w http.ResponseWriter, r *http.Request) {
		user, ok := requireBlogMember(w, r, db)
		if !ok {
			return
		}
		_, contentType, buf, okUpload := readImageUpload(w, r)
		if !okUpload {
			return
		}
		photoID := uuid.NewString()
		key := "blog/" + photoID + media.ExtForContentType(contentType)
		if err := files.Save(key, bytes.NewReader(buf)); err != nil {
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		ph, err := db.AddBlogPhoto(r.Context(), chi.URLParam(r, "postId"), user.Subject, key, contentType)
		if err != nil {
			_ = files.Remove(key)
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, ph)
	})

	pr.Get("/blog-photos/{photoId}", func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		meta, err := db.GetBlogPhotoFile(r.Context(), chi.URLParam(r, "photoId"))
		if err != nil {
			writeStoreErr(w, err)
			return
		}
		if _, err := db.GetHouseForMember(r.Context(), meta.HouseID, user.Subject); err != nil {
			writeStoreErr(w, err)
			return
		}
		f, err := files.Open(meta.StorageKey)
		if err != nil {
			http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
			return
		}
		defer f.Close()
		w.Header().Set("Content-Type", meta.ContentType)
		http.ServeContent(w, r, meta.ID, meta.CreatedAt, f)
	})

	pr.Post("/posts/{postId}/comments", func(w http.ResponseWriter, r *http.Request) {
		user, ok := requireBlogMember(w, r, db)
		if !ok {
			return
		}
		var body struct {
			Body string `json:"body"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error":"invalid_json"}`, http.StatusBadRequest)
			return
		}
		text := strings.TrimSpace(body.Body)
		if text == "" {
			http.Error(w, `{"error":"body_required"}`, http.StatusBadRequest)
			return
		}
		c, err := db.AddBlogComment(r.Context(), chi.URLParam(r, "postId"), user.Subject, text)
		if err != nil {
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, c)
	})

	pr.Delete("/comments/{commentId}", func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		if err := db.DeleteBlogComment(r.Context(), chi.URLParam(r, "commentId"), user.Subject); err != nil {
			writeStoreErr(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	pr.Put("/posts/{postId}/reactions", func(w http.ResponseWriter, r *http.Request) {
		user, ok := requireBlogMember(w, r, db)
		if !ok {
			return
		}
		var body struct {
			Emoji string `json:"emoji"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error":"invalid_json"}`, http.StatusBadRequest)
			return
		}
		emoji := strings.TrimSpace(body.Emoji)
		if !allowedReactions[emoji] {
			http.Error(w, `{"error":"invalid_emoji"}`, http.StatusBadRequest)
			return
		}
		if err := db.SetBlogReaction(r.Context(), chi.URLParam(r, "postId"), user.Subject, emoji); err != nil {
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		p, err := db.GetBlogPost(r.Context(), chi.URLParam(r, "postId"), user.Subject)
		if err != nil {
			writeStoreErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, p.Reactions)
	})

	pr.Delete("/posts/{postId}/reactions", func(w http.ResponseWriter, r *http.Request) {
		user, ok := requireBlogMember(w, r, db)
		if !ok {
			return
		}
		if err := db.ClearBlogReaction(r.Context(), chi.URLParam(r, "postId"), user.Subject); err != nil {
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	// Help
	pr.Get("/houses/{id}/help", func(w http.ResponseWriter, r *http.Request) {
		user, houseID, ok := memberHouse(w, r, db)
		if !ok {
			return
		}
		list, err := db.ListHelpArticles(r.Context(), houseID, user.Subject)
		if err != nil {
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, list)
	})

	pr.Post("/houses/{id}/help", func(w http.ResponseWriter, r *http.Request) {
		user, houseID, ok := memberHouse(w, r, db)
		if !ok {
			return
		}
		var body struct {
			Title string `json:"title"`
			Body  string `json:"body"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error":"invalid_json"}`, http.StatusBadRequest)
			return
		}
		title := strings.TrimSpace(body.Title)
		if title == "" {
			http.Error(w, `{"error":"title_required"}`, http.StatusBadRequest)
			return
		}
		order, err := db.NextHelpSortOrder(r.Context(), houseID)
		if err != nil {
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		a, err := db.CreateHelpArticle(r.Context(), houseID, user.Subject, title, strings.TrimSpace(body.Body), order)
		if err != nil {
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, a)
	})

	pr.Get("/help/{articleId}", func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		articleID := chi.URLParam(r, "articleId")
		houseID, err := db.GetHelpHouseID(r.Context(), articleID)
		if err != nil {
			writeStoreErr(w, err)
			return
		}
		if _, err := db.GetHouseForMember(r.Context(), houseID, user.Subject); err != nil {
			writeStoreErr(w, err)
			return
		}
		a, err := db.GetHelpArticle(r.Context(), articleID)
		if err != nil {
			writeStoreErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, a)
	})

	pr.Patch("/help/{articleId}", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := requireHelpMember(w, r, db); !ok {
			return
		}
		var body struct {
			Title string `json:"title"`
			Body  string `json:"body"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error":"invalid_json"}`, http.StatusBadRequest)
			return
		}
		title := strings.TrimSpace(body.Title)
		if title == "" {
			http.Error(w, `{"error":"title_required"}`, http.StatusBadRequest)
			return
		}
		a, err := db.UpdateHelpArticle(r.Context(), chi.URLParam(r, "articleId"), title, strings.TrimSpace(body.Body))
		if err != nil {
			writeStoreErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, a)
	})

	pr.Delete("/help/{articleId}", func(w http.ResponseWriter, r *http.Request) {
		if _, ok := requireHelpMember(w, r, db); !ok {
			return
		}
		if err := db.DeleteHelpArticle(r.Context(), chi.URLParam(r, "articleId")); err != nil {
			writeStoreErr(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	pr.Post("/help/{articleId}/photos", func(w http.ResponseWriter, r *http.Request) {
		user, ok := requireHelpMember(w, r, db)
		if !ok {
			return
		}
		_, contentType, buf, okUpload := readImageUpload(w, r)
		if !okUpload {
			return
		}
		photoID := uuid.NewString()
		key := "help/" + photoID + media.ExtForContentType(contentType)
		if err := files.Save(key, bytes.NewReader(buf)); err != nil {
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		ph, err := db.AddHelpPhoto(r.Context(), chi.URLParam(r, "articleId"), user.Subject, key, contentType)
		if err != nil {
			_ = files.Remove(key)
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, ph)
	})

	pr.Get("/help-photos/{photoId}", func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		meta, err := db.GetHelpPhotoFile(r.Context(), chi.URLParam(r, "photoId"))
		if err != nil {
			writeStoreErr(w, err)
			return
		}
		if _, err := db.GetHouseForMember(r.Context(), meta.HouseID, user.Subject); err != nil {
			writeStoreErr(w, err)
			return
		}
		f, err := files.Open(meta.StorageKey)
		if err != nil {
			http.Error(w, `{"error":"not_found"}`, http.StatusNotFound)
			return
		}
		defer f.Close()
		w.Header().Set("Content-Type", meta.ContentType)
		http.ServeContent(w, r, meta.ID, meta.CreatedAt, f)
	})
}

func requireBlogMember(w http.ResponseWriter, r *http.Request, db *store.Store) (auth.User, bool) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return auth.User{}, false
	}
	houseID, err := db.GetBlogPostHouseID(r.Context(), chi.URLParam(r, "postId"))
	if err != nil {
		writeStoreErr(w, err)
		return auth.User{}, false
	}
	if _, err := db.GetHouseForMember(r.Context(), houseID, user.Subject); err != nil {
		writeStoreErr(w, err)
		return auth.User{}, false
	}
	return user, true
}

func requireHelpMember(w http.ResponseWriter, r *http.Request, db *store.Store) (auth.User, bool) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return auth.User{}, false
	}
	houseID, err := db.GetHelpHouseID(r.Context(), chi.URLParam(r, "articleId"))
	if err != nil {
		writeStoreErr(w, err)
		return auth.User{}, false
	}
	if _, err := db.GetHouseForMember(r.Context(), houseID, user.Subject); err != nil {
		writeStoreErr(w, err)
		return auth.User{}, false
	}
	return user, true
}

func readImageUpload(w http.ResponseWriter, r *http.Request) (filename, contentType string, buf []byte, ok bool) {
	r.Body = http.MaxBytesReader(w, r.Body, maxPhotoBytes+1024)
	if err := r.ParseMultipartForm(maxPhotoBytes); err != nil {
		http.Error(w, `{"error":"invalid_multipart"}`, http.StatusBadRequest)
		return "", "", nil, false
	}
	file, header, err := r.FormFile("photo")
	if err != nil {
		http.Error(w, `{"error":"photo_required"}`, http.StatusBadRequest)
		return "", "", nil, false
	}
	defer file.Close()
	contentType = header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	if !strings.HasPrefix(contentType, "image/") {
		http.Error(w, `{"error":"invalid_content_type"}`, http.StatusBadRequest)
		return "", "", nil, false
	}
	buf, err = io.ReadAll(io.LimitReader(file, maxPhotoBytes+1))
	if err != nil {
		http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
		return "", "", nil, false
	}
	if len(buf) > maxPhotoBytes {
		http.Error(w, `{"error":"photo_too_large"}`, http.StatusRequestEntityTooLarge)
		return "", "", nil, false
	}
	return header.Filename, contentType, buf, true
}
