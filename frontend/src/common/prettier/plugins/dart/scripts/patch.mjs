#!/usr/bin/env node
import process from "node:process";
import path from "node:path";
import fs from "node:fs";

const file_path = path.resolve(process.cwd(), process.argv[2]);
let file_text = fs.readFileSync(file_path, { encoding: "utf-8" });

file_text = file_text.replace(`"length": (s) => s.length`, '"length": (s) => s?.length||0');
file_text = file_text.replace('globalThis.format', 'format');
file_text += "\nexport let format;";

fs.writeFileSync(file_path, file_text);