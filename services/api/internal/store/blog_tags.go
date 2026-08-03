package store

import (
	"errors"
	"regexp"
	"strings"
	"unicode"
)

var (
	ErrInvalidTag   = errors.New("invalid_tag")
	ErrTooManyTags  = errors.New("too_many_tags")
	blogTagPattern  = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,23}$`)
	maxBlogTags     = 8
	maxBlogMentions = 20
)

func NormalizeBlogTags(raw []string) ([]string, error) {
	seen := map[string]bool{}
	var out []string
	for _, t := range raw {
		t = strings.TrimSpace(strings.ToLower(t))
		t = strings.TrimPrefix(t, "#")
		t = strings.Map(func(r rune) rune {
			if unicode.IsSpace(r) {
				return -1
			}
			return r
		}, t)
		if t == "" {
			continue
		}
		if !blogTagPattern.MatchString(t) {
			return nil, ErrInvalidTag
		}
		if seen[t] {
			continue
		}
		seen[t] = true
		out = append(out, t)
		if len(out) > maxBlogTags {
			return nil, ErrTooManyTags
		}
	}
	return out, nil
}

func UniqueNonEmpty(values []string) []string {
	seen := map[string]bool{}
	var out []string
	for _, v := range values {
		v = strings.TrimSpace(v)
		if v == "" || seen[v] {
			continue
		}
		seen[v] = true
		out = append(out, v)
	}
	return out
}

func MaxBlogMentions() int { return maxBlogMentions }
