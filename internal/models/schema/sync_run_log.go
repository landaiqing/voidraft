package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"

	"voidraft/internal/models"
	"voidraft/internal/models/schema/mixin"
)

// SyncRunLog holds the schema definition for the SyncRunLog entity.
type SyncRunLog struct {
	ent.Schema
}

// Annotations of the SyncRunLog.
func (SyncRunLog) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "sync_run_logs"},
	}
}

// Fields of the SyncRunLog.
func (SyncRunLog) Fields() []ent.Field {
	return []ent.Field{
		field.Enum("target_type").
			Values(string(models.SyncTargetGit), string(models.SyncTargetLocalFS)).
			StructTag(`json:"target_type"`).
			Comment("sync target type"),
		field.String("target_path").
			Default("").
			StructTag(`json:"target_path"`).
			Comment("git repo url or localfs root path"),
		field.String("branch").
			Default("").
			StructTag(`json:"branch"`).
			Comment("configured sync branch"),
		field.Enum("trigger_type").
			Values(string(models.SyncRunTriggerManual), string(models.SyncRunTriggerAuto)).
			StructTag(`json:"trigger_type"`).
			Comment("sync trigger type"),
		field.Enum("status").
			Values(string(models.SyncRunStatusSuccess), string(models.SyncRunStatusFailed)).
			StructTag(`json:"status"`).
			Comment("sync result status"),
		field.String("started_at").
			DefaultFunc(mixin.NowString).
			StructTag(`json:"started_at"`).
			Comment("sync start time"),
		field.String("finished_at").
			DefaultFunc(mixin.NowString).
			StructTag(`json:"finished_at"`).
			Comment("sync finish time"),
		field.JSON("details", models.SyncRunDetails{}).
			StructTag(`json:"details"`).
			Comment("sync run details"),
	}
}

// Edges of the SyncRunLog.
func (SyncRunLog) Edges() []ent.Edge {
	return nil
}

// Indexes of the SyncRunLog.
func (SyncRunLog) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("started_at"),
		index.Fields("status", "started_at"),
		index.Fields("target_type", "started_at"),
		index.Fields("trigger_type", "started_at"),
	}
}
