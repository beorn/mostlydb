import { defineConfig } from "vitepress"

export default defineConfig({
  title: "mostlydb",
  description: "MongoDB queries over any storage backend.",
  base: "/mostlydb/",
  head: [["link", { rel: "icon", type: "image/svg+xml", href: "/mostlydb/favicon.svg" }]],
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Reference", link: "/reference/api" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "Queries", link: "/guide/queries" },
          { text: "Write Operations", link: "/guide/write-operations" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "API", link: "/reference/api" },
          { text: "Types", link: "/reference/types" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/beorn/mostlydb" }],
    footer: { message: "Released under the MIT License." },
    search: { provider: "local" },
  },
})
