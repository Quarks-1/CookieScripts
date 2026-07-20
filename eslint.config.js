import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "extension/domains/**/scripts/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["extension/**/*.ts", "ui/**/*.ts", "ui/**/*.tsx", "tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: [
      "extension/core/**/*.ts",
      "ui/popup/core/**/*.ts",
      "ui/popup/core/**/*.tsx",
      "ui/shared/**/*.ts",
      "ui/shared/**/*.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex:
                "^@ext/domains/target/lib/(?!index\\.ts$|host\\.ts$|channel-config\\.ts$|quantity-limit\\.ts$).+",
              message:
                "Import Target lib via @ext/domains/target/lib/index.ts (or host/channel-config/quantity-limit for chunk-safe core imports)",
            },
            {
              regex: "^@ext/domains/walmart/lib/(?!index\\.ts$).+",
              message: "Import Walmart lib via @ext/domains/walmart/lib/index.ts",
            },
            {
              regex: "^@ext/domains/samsclub/lib/(?!index\\.ts$).+",
              message: "Import Sam's Club lib via @ext/domains/samsclub/lib/index.ts",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["extension/domains/discord/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@ext/domains/target/**", "@ext/domains/walmart/**"],
              message: "Discord domain must not import other domains.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["extension/domains/target/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@ext/domains/discord/**", "@ext/domains/walmart/**", "@ext/domains/samsclub/**"],
              message: "Target domain must not import other domains.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["extension/domains/walmart/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@ext/domains/discord/**", "@ext/domains/target/**", "@ext/domains/samsclub/**"],
              message: "Walmart domain must not import other domains.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["extension/domains/samsclub/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@ext/domains/discord/**", "@ext/domains/target/**", "@ext/domains/walmart/**"],
              message: "Sam's Club domain must not import other domains.",
            },
          ],
        },
      ],
    },
  },
);
