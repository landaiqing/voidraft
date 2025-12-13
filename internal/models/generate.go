package models

//go:generate go run -mod=mod entgo.io/ent/cmd/ent generate --target ./ent --feature upsert,sql/execquery,sql/modifier,sql/lock,intercept,privacy,entql,namedges ./schema
