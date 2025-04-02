export const CVO_LOCALE_MANIFEST_SCHEMA = 'cvo.locale.manifest.v1';
export const CVO_MESSAGE_CATALOG_SCHEMA = 'cvo.message_catalog.v1';

export type CvoTextDirection = 'ltr' | 'rtl';

export interface CvoLocaleDescriptor {
    readonly id: string;
    readonly label?: string;
    readonly direction?: CvoTextDirection;
}

export interface CvoLocaleManifest {
    readonly schema: typeof CVO_LOCALE_MANIFEST_SCHEMA;
    readonly defaultLocale: string;
    readonly locales: readonly CvoLocaleDescriptor[];
    readonly fallback?: Readonly<Record<string, readonly string[]>>;
}

export interface CvoMessageCatalog {
    readonly schema: typeof CVO_MESSAGE_CATALOG_SCHEMA;
    readonly locale: string;
    /** Opaque message entries — Fluent FTL or plain string payloads. */
    readonly resources: Readonly<Record<string, string>>;
}

export interface CvoLocaleResolution {
    readonly requested: string;
    readonly resolved: string;
    readonly chain: readonly string[];
}

export interface DefineI18nPluginOptions {
    readonly name?: string;
    readonly version?: string;
    readonly manifest: CvoLocaleManifest;
    readonly catalogs: readonly CvoMessageCatalog[];
}
