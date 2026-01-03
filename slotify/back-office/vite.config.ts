import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import viteTsconfigPaths from "vite-tsconfig-paths";
import monacoEditorEsmPlugin from "vite-plugin-monaco-editor-esm";

export default defineConfig({
    base: "/backoffice",
    plugins: [
        react(),
        monacoEditorEsmPlugin({
            languageWorkers: ["editorWorkerService", "json"],
            customWorkers: [
                {
                    label: "graphql",
                    entry: "monaco-graphql/esm/graphql.worker.js",
                },
            ],
        }),
        viteTsconfigPaths(),
    ],
    build: {
        outDir: "./build",
    },
    server: {
        port: parseInt(process.env.PORT || "3000", 10),
        allowedHosts: ["slotify.local"],
    },
});
