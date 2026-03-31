package scheduler

import (
	"testing"
	"time"
)

// TestNextInterval verifies exponential backoff progression.
func TestNextInterval(t *testing.T) {
	base := 5 * time.Minute

	cases := []struct {
		failures int
		want     time.Duration
	}{
		{failures: 0, want: 5 * time.Minute},
		{failures: 1, want: 10 * time.Minute},
		{failures: 2, want: 20 * time.Minute},
		{failures: 3, want: 40 * time.Minute},
		{failures: 4, want: 40 * time.Minute},
	}

	for _, tc := range cases {
		if got := nextInterval(base, tc.failures); got != tc.want {
			t.Fatalf("failures=%d: expected %s, got %s", tc.failures, tc.want, got)
		}
	}
}
