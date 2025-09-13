const CATEGORY_PHP = "PHP";

// prettier-ignore
const SUPPORTED_PHP_VERSIONS = [
  5.0, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6,
  7.0, 7.1, 7.2, 7.3, 7.4,
  8.0, 8.1, 8.2, 8.3, 8.4,
];

export const LATEST_SUPPORTED_PHP_VERSION = Math.max(...SUPPORTED_PHP_VERSIONS);

/**
 * Resolve the PHP version to a number based on the provided options.
 */
export function resolvePhpVersion(options) {
  if (!options) {
    return;
  }
  
  if (options.phpVersion === "auto" || options.phpVersion === "composer") {
    options.phpVersion = LATEST_SUPPORTED_PHP_VERSION;
  } else {
    options.phpVersion = parseFloat(options.phpVersion);
  }
}

export default {
  phpVersion: {
    since: "0.13.0",
    category: CATEGORY_PHP,
    type: "choice",
    default: "auto",
    description: "Minimum target PHP version.",
    choices: [
      ...SUPPORTED_PHP_VERSIONS.map((v) => ({ value: v.toFixed(1) })),
      {
        value: "auto",
        description: `Use latest PHP Version (${LATEST_SUPPORTED_PHP_VERSION})`,
      },
    ],
  },
  trailingCommaPHP: {
    since: "0.0.0",
    category: CATEGORY_PHP,
    type: "boolean",
    default: true,
    description: "Print trailing commas wherever possible when multi-line.",
  },
  braceStyle: {
    since: "0.10.0",
    category: CATEGORY_PHP,
    type: "choice",
    default: "per-cs",
    description:
      "Print one space or newline for code blocks (classes and functions).",
    choices: [
      { value: "psr-2", description: "(deprecated) Use per-cs" },
      { value: "per-cs", description: "Use the PER Coding Style brace style." },
      { value: "1tbs", description: "Use 1tbs brace style." },
    ],
  },
  singleQuote: {
    since: "0.0.0",
    category: CATEGORY_PHP,
    type: "boolean",
    default: false,
    description: "Use single quotes instead of double quotes.",
  },
};
