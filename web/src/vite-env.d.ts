/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_FECHA_CORTE_INICIAL?: string;
    readonly VITE_API_DESTINO?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
