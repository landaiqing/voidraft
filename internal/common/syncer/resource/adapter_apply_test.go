package resource

import (
	"context"
	"fmt"
	"testing"
	"voidraft/internal/common/syncer/snapshot"
	"voidraft/internal/models/ent"
	"voidraft/internal/models/ent/enttest"
	extensionent "voidraft/internal/models/ent/extension"
	keybindingent "voidraft/internal/models/ent/keybinding"
	themeent "voidraft/internal/models/ent/theme"

	_ "github.com/mattn/go-sqlite3"
)

func TestExtensionAdapterApplyMatchesByName(t *testing.T) {
	ctx := context.Background()
	client := openSyncResourceTestClient(t)
	defer client.Close()

	existing, err := client.Extension.Create().
		SetUUID("local-extension-uuid").
		SetName("inlineImage").
		SetEnabled(true).
		SetConfig(map[string]interface{}{"mode": "old"}).
		SetCreatedAt("2026-04-12T10:00:00Z").
		SetUpdatedAt("2026-04-12T10:00:00Z").
		Save(ctx)
	if err != nil {
		t.Fatalf("create local extension: %v", err)
	}

	record, err := snapshot.NewRecord("extensions", extensionSyncID("inlineImage"), map[string]interface{}{
		"created_at": "2026-04-12T10:00:00Z",
		"updated_at": "2026-04-12T10:05:00Z",
		"name":       "inlineImage",
		"enabled":    false,
		"config":     map[string]interface{}{"mode": "new"},
	}, nil)
	if err != nil {
		t.Fatalf("build extension record: %v", err)
	}

	adapter := NewExtensionAdapter(client)
	if err := adapter.Apply(ctx, []snapshot.Record{record}); err != nil {
		t.Fatalf("apply extension record: %v", err)
	}

	items, err := client.Extension.Query().Where(extensionent.NameEQ("inlineImage")).All(importContext(ctx))
	if err != nil {
		t.Fatalf("query extensions: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 extension row, got %d", len(items))
	}
	if items[0].UUID != existing.UUID {
		t.Fatalf("expected extension UUID to stay %q, got %q", existing.UUID, items[0].UUID)
	}
	if items[0].Enabled {
		t.Fatalf("expected extension to be updated")
	}
}

func TestKeyBindingAdapterApplyMatchesByTypeAndName(t *testing.T) {
	ctx := context.Background()
	client := openSyncResourceTestClient(t)
	defer client.Close()

	existing, err := client.KeyBinding.Create().
		SetUUID("local-keybinding-uuid").
		SetName("save").
		SetType("standard").
		SetKey("Mod-s").
		SetMacos("Cmd-s").
		SetWindows("Ctrl-s").
		SetLinux("Ctrl-s").
		SetExtension("core").
		SetEnabled(true).
		SetPreventDefault(true).
		SetScope("editor").
		SetCreatedAt("2026-04-12T10:00:00Z").
		SetUpdatedAt("2026-04-12T10:00:00Z").
		Save(ctx)
	if err != nil {
		t.Fatalf("create local keybinding: %v", err)
	}

	record, err := snapshot.NewRecord("keybindings", keyBindingSyncID("standard", "save"), map[string]interface{}{
		"created_at":      "2026-04-12T10:00:00Z",
		"updated_at":      "2026-04-12T10:05:00Z",
		"name":            "save",
		"type":            "standard",
		"key":             "Mod-Shift-s",
		"macos":           "Cmd-Shift-s",
		"windows":         "Ctrl-Shift-s",
		"linux":           "Ctrl-Shift-s",
		"extension":       "core",
		"enabled":         false,
		"prevent_default": true,
		"scope":           "editor",
	}, nil)
	if err != nil {
		t.Fatalf("build keybinding record: %v", err)
	}

	adapter := NewKeyBindingAdapter(client)
	if err := adapter.Apply(ctx, []snapshot.Record{record}); err != nil {
		t.Fatalf("apply keybinding record: %v", err)
	}

	items, err := client.KeyBinding.Query().
		Where(keybindingent.TypeEQ("standard"), keybindingent.NameEQ("save")).
		All(importContext(ctx))
	if err != nil {
		t.Fatalf("query keybindings: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 keybinding row, got %d", len(items))
	}
	if items[0].UUID != existing.UUID {
		t.Fatalf("expected keybinding UUID to stay %q, got %q", existing.UUID, items[0].UUID)
	}
	if items[0].Key != "Mod-Shift-s" {
		t.Fatalf("expected keybinding key to be updated, got %q", items[0].Key)
	}
}

func TestThemeAdapterApplyMatchesByName(t *testing.T) {
	ctx := context.Background()
	client := openSyncResourceTestClient(t)
	defer client.Close()

	existing, err := client.Theme.Create().
		SetUUID("local-theme-uuid").
		SetName("dark-plus").
		SetType(themeent.TypeDark).
		SetColors(map[string]interface{}{"bg": "#000"}).
		SetCreatedAt("2026-04-12T10:00:00Z").
		SetUpdatedAt("2026-04-12T10:00:00Z").
		Save(ctx)
	if err != nil {
		t.Fatalf("create local theme: %v", err)
	}

	record, err := snapshot.NewRecord("themes", themeSyncID("dark-plus"), map[string]interface{}{
		"created_at": "2026-04-12T10:00:00Z",
		"updated_at": "2026-04-12T10:05:00Z",
		"name":       "dark-plus",
		"type":       "dark",
		"colors":     map[string]interface{}{"bg": "#111"},
	}, nil)
	if err != nil {
		t.Fatalf("build theme record: %v", err)
	}

	adapter := NewThemeAdapter(client)
	if err := adapter.Apply(ctx, []snapshot.Record{record}); err != nil {
		t.Fatalf("apply theme record: %v", err)
	}

	items, err := client.Theme.Query().Where(themeent.NameEQ("dark-plus")).All(importContext(ctx))
	if err != nil {
		t.Fatalf("query themes: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 theme row, got %d", len(items))
	}
	if items[0].UUID != existing.UUID {
		t.Fatalf("expected theme UUID to stay %q, got %q", existing.UUID, items[0].UUID)
	}
	if items[0].Colors["bg"] != "#111" {
		t.Fatalf("expected theme colors to be updated, got %#v", items[0].Colors)
	}
}

func openSyncResourceTestClient(t *testing.T) *ent.Client {
	t.Helper()
	dsnName := fmt.Sprintf("file:%s?mode=memory&cache=shared&_fk=1", t.Name())
	return enttest.Open(t, "sqlite3", dsnName)
}
