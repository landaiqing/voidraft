/// <reference types="vite/client" />

declare interface ImportMetaEnv {
    readonly VITE_NODE_ENV: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}