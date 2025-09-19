#!/usr/bin/env node
import process from "node:process";
import path from "node:path";
import fs from "node:fs";

const pkg_path = path.resolve(process.cwd(), process.argv[2]);
const pkg_text = fs.readFileSync(pkg_path, { encoding: "utf-8" });
const pkg_json = JSON.parse(pkg_text);

// JSR

const jsr_path = path.resolve(pkg_path, "..", "build", "jsr.jsonc");
pkg_json.name = "@fmt/dart-fmt";
pkg_json.exports = "./dart_fmt.js";
pkg_json.exclude = ["!../build", "*.tgz", ".npmignore"];
fs.writeFileSync(jsr_path, JSON.stringify(pkg_json, null, 4));
