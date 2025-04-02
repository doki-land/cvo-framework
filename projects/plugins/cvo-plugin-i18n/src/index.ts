import { type CvoContributionBatch, type CvoPlugin, type CvoPluginContext, definePlugin } from '@cvo/plugin';
import type { CvoLocaleManifest, CvoLocaleResolution, CvoMessageCatalog, DefineI18nPluginOptions } from './types.js';
import { CVO_LOCALE_MANIFEST_SCHEMA, CVO_MESSAGE_CATALOG_SCHEMA } from './types.js';

export {
    CVO_LOCALE_MANIFEST_SCHEMA,
    CVO_MESSAGE_CATALOG_SCHEMA,
    type CvoLocaleDescriptor,
    type CvoLocaleManifest,
    type CvoLocaleResolution,
    type CvoMessageCatalog,
    type CvoTextDirection,
    type DefineI18nPluginOptions,
} from './types.js';

/** BCP-47-ish locale id normalization (lowercase language, preserve region). */
export function normalizeLocaleId(id: string): string {
    const trimmed = id.trim();
    if (!trimmed) {
        throw new Error('locale id must be non-empty');
    }
    const parts = trimmed.replace('_', '-').split('-');
    parts[0] = parts[0].toLowerCase();
    if (parts[1]?.length === 2) {
        parts[1] = parts[1].toUpperCase();
    }
    return parts.join('-');
}

/** Resolve locale with manifest fallback chain; never silently invent locales. */
export function resolveLocale(manifest: CvoLocaleManifest, requested: string): CvoLocaleResolution {
    const normalized = normalizeLocaleId(requested);
    const known = new Set(manifest.locales.map((l) => normalizeLocaleId(l.id)));
    const chain: string[] = [];
    const visited = new Set<string>();

    function walk(id: string): string | undefined {
        const key = normalizeLocaleId(id);
        if (visited.has(key)) {
            return undefined;
        }
        visited.add(key);
        chain.push(key);
        if (known.has(key)) {
            return key;
        }
        const fallbacks = manifest.fallback?.[key] ?? manifest.fallback?.[key.split('-')[0] ?? ''] ?? [];
        for (const fb of fallbacks) {
            const hit = walk(fb);
            if (hit) {
                return hit;
            }
        }
        return undefined;
    }

    const resolved = walk(normalized) ?? walk(manifest.defaultLocale) ?? manifest.defaultLocale;
    if (!known.has(resolved)) {
        throw new Error(`locale manifest missing default locale ${manifest.defaultLocale}`);
    }
    return { requested: normalized, resolved, chain };
}

/** Lookup catalog for resolved locale. */
export function findMessageCatalog(catalogs: readonly CvoMessageCatalog[], locale: string): CvoMessageCatalog | undefined {
    const id = normalizeLocaleId(locale);
    return catalogs.find((c) => normalizeLocaleId(c.locale) === id);
}

function localeContributions(manifest: CvoLocaleManifest, catalogs: readonly CvoMessageCatalog[]): CvoContributionBatch {
    return {
        stage: 'locale_resolve',
        cacheKey: `i18n:${manifest.defaultLocale}:${catalogs.length}`,
        deterministic: true,
        items: [
            {
                id: 'cvo.locale.manifest',
                kind: 'locale_manifest',
                content: JSON.stringify(manifest),
            },
            ...catalogs.map((catalog) => ({
                id: `cvo.message_catalog.${catalog.locale}`,
                kind: 'message_catalog' as const,
                content: JSON.stringify(catalog),
            })),
        ],
    };
}

/** CVO plugin that emits locale manifest + message catalogs at `locale_resolve` stage. */
export function defineI18nPlugin(options: DefineI18nPluginOptions): CvoPlugin {
    if (options.manifest.schema !== CVO_LOCALE_MANIFEST_SCHEMA) {
        throw new Error(`manifest.schema must be ${CVO_LOCALE_MANIFEST_SCHEMA}`);
    }
    for (const catalog of options.catalogs) {
        if (catalog.schema !== CVO_MESSAGE_CATALOG_SCHEMA) {
            throw new Error(`catalog.schema must be ${CVO_MESSAGE_CATALOG_SCHEMA}`);
        }
    }

    return definePlugin({
        name: options.name ?? '@cvo/plugin-i18n',
        version: options.version ?? '0.0.0',
        stages: ['locale_resolve'],
        contribute(_ctx: CvoPluginContext) {
            return localeContributions(options.manifest, options.catalogs);
        },
    });
}

/** Build a manifest from plain locale ids. */
export function createLocaleManifest(
    defaultLocale: string,
    locales: readonly { id: string; label?: string; direction?: 'ltr' | 'rtl' }[],
    fallback?: Readonly<Record<string, readonly string[]>>,
): CvoLocaleManifest {
    return {
        schema: CVO_LOCALE_MANIFEST_SCHEMA,
        defaultLocale: normalizeLocaleId(defaultLocale),
        locales: locales.map((l) => ({ ...l, id: normalizeLocaleId(l.id) })),
        fallback,
    };
}

/** Plain string catalog (non-Fluent backends). */
export function createMessageCatalog(locale: string, messages: Readonly<Record<string, string>>): CvoMessageCatalog {
    return {
        schema: CVO_MESSAGE_CATALOG_SCHEMA,
        locale: normalizeLocaleId(locale),
        resources: messages,
    };
}
