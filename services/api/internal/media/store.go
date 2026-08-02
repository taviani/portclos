package media

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

type Store struct {
	root string
}

func New(root string) (*Store, error) {
	if err := os.MkdirAll(root, 0o755); err != nil {
		return nil, fmt.Errorf("upload dir: %w", err)
	}
	abs, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	return &Store{root: abs}, nil
}

func (s *Store) Path(key string) string {
	return filepath.Join(s.root, filepath.FromSlash(key))
}

func (s *Store) Save(key string, r io.Reader) error {
	full := s.Path(key)
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		return err
	}
	f, err := os.Create(full)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, r)
	return err
}

func (s *Store) Open(key string) (*os.File, error) {
	return os.Open(s.Path(key))
}

func (s *Store) Remove(key string) error {
	err := os.Remove(s.Path(key))
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func ExtForContentType(contentType string) string {
	switch strings.ToLower(contentType) {
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/heic":
		return ".heic"
	default:
		return ".bin"
	}
}
