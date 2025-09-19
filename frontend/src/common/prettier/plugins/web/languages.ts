export const languages = [
  // HTML and template languages
  {
    name: "HTML",
    parsers: ["html"],
    extensions: [".html", ".htm"],
    filenames: ["*.html", "*.htm"],
    tmScope: "text.html.basic",
    aceMode: "html",
    codemirrorMode: "htmlmixed",
    linguistLanguageId: 172,
    vscodeLanguageIds: ["html"]
  },
  {
    name: "Vue",
    parsers: ["vue"],
    extensions: [".vue"],
    filenames: ["*.vue"],
    tmScope: "text.html.vue",
    aceMode: "html",
    codemirrorMode: "vue",
    linguistLanguageId: 391,
    vscodeLanguageIds: ["vue"]
  },
  {
    name: "Svelte",
    parsers: ["svelte"],
    extensions: [".svelte"],
    filenames: ["*.svelte"],
    tmScope: "source.svelte",
    aceMode: "html",
    codemirrorMode: "htmlmixed",
    linguistLanguageId: 377,
    vscodeLanguageIds: ["svelte"]
  },
  {
    name: "Astro",
    parsers: ["astro"],
    extensions: [".astro"],
    filenames: ["*.astro"],
    tmScope: "source.astro",
    aceMode: "html",
    codemirrorMode: "htmlmixed",
    linguistLanguageId: 578,
    vscodeLanguageIds: ["astro"]
  },

  // Stylesheet languages
  {
    name: "CSS",
    parsers: ["css"],
    extensions: [".css"],
    filenames: ["*.css"],
    tmScope: "source.css",
    aceMode: "css",
    codemirrorMode: "css",
    linguistLanguageId: 50,
    vscodeLanguageIds: ["css"]
  },
  {
    name: "SCSS",
    parsers: ["scss"],
    extensions: [".scss"],
    filenames: ["*.scss"],
    tmScope: "source.css.scss",
    aceMode: "scss",
    codemirrorMode: "css",
    linguistLanguageId: 329,
    vscodeLanguageIds: ["scss"]
  },
  {
    name: "Sass",
    parsers: ["sass"],
    extensions: [".sass"],
    filenames: ["*.sass"],
    tmScope: "source.sass",
    aceMode: "sass",
    codemirrorMode: "sass",
    linguistLanguageId: 207,
    vscodeLanguageIds: ["sass"]
  },
  {
    name: "Less",
    parsers: ["less"],
    extensions: [".less"],
    filenames: ["*.less"],
    tmScope: "source.css.less",
    aceMode: "less",
    codemirrorMode: "css",
    linguistLanguageId: 198,
    vscodeLanguageIds: ["less"]
  },

  // Script languages
  {
    name: "JavaScript",
    parsers: ["js"],
    extensions: [".js", ".mjs", ".cjs", ".jsx"],
    filenames: ["*.js", "*.mjs", "*.cjs", "*.jsx"],
    tmScope: "source.js",
    aceMode: "javascript",
    codemirrorMode: "javascript",
    linguistLanguageId: 183,
    vscodeLanguageIds: ["javascript"]
  },
  {
    name: "TypeScript",
    parsers: ["ts"],
    extensions: [".ts", ".tsx", ".cts", ".mts"],
    filenames: ["*.ts", "*.tsx", "*.cts", "*.mts"],
    tmScope: "source.ts",
    aceMode: "typescript",
    codemirrorMode: "javascript",
    linguistLanguageId: 378,
    vscodeLanguageIds: ["typescript"]
  },

  // Data languages
  {
    name: "JSON",
    parsers: ["json"],
    extensions: [".json", ".jsonc"],
    filenames: ["*.json", "*.jsonc", ".babelrc", ".eslintrc", "tsconfig.json"],
    tmScope: "source.json",
    aceMode: "json",
    codemirrorMode: "javascript",
    linguistLanguageId: 174,
    vscodeLanguageIds: ["json", "jsonc"]
  }
];
