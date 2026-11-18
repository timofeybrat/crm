import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const publicApi = {
  group: ["@/entities/*/*", "@/features/*/*", "@/widgets/*/*", "@/pages/*/*"],
  message: "Import a slice through its public index.ts API.",
};
const boundaries = [
  ["shared", ["@/entities/**", "@/features/**", "@/widgets/**", "@/pages/**", "@/app/**"]],
  ["entities", ["@/entities/**", "@/features/**", "@/widgets/**", "@/pages/**", "@/app/**"]],
  ["features", ["@/features/**", "@/widgets/**", "@/pages/**", "@/app/**"]],
  ["widgets", ["@/widgets/**", "@/pages/**", "@/app/**"]],
  ["pages", ["@/pages/**", "@/app/**"]],
].map(([layer, group]) => ({
  files: [`src/${layer}/**/*.{ts,tsx}`],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          publicApi,
          {
            group,
            message:
              "FSD imports flow down the layers. Same-layer slices compose in the layer above.",
          },
        ],
      },
    ],
  },
}));

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  ...boundaries,
  globalIgnores([".next/**", "next-env.d.ts"]),
]);
