import type { CvoPlugin } from '@cvo/plugin';
import {
    type CvoLocaleManifest,
    type CvoMessageCatalog,
    createLocaleManifest,
    createMessageCatalog,
    defineI18nPlugin,
    normalizeLocaleId,
    resolveLocale,
} from '@cvo/plugin-i18n';
import { FluentBundle, FluentResource, type FluentVariable } from '@fluent/bundle';
import { negotiateLanguages } from '@fluent/langneg';

export interface FluentLocaleInput {
    readonly id: string;
    readonly label?: string;
    readonly direction?: 'ltr' | 'rtl';
    /** Raw FTL text for this locale. */
    readonly ftl: string;
}

export interface DefineFluentI18nPluginOptions {
    readonly name?: string;
    readonly version?: string;
    readonly defaultLocale: string;
    readonly locales: readonly FluentLocaleInput[];
    readonly fallback?: Readonly<Record<string, readonly string[]>>;
}

/** Parse FTL and collect message ids for catalog metadata. */
export function createFluentResource(ftl: string): FluentResource {
    return new FluentResource(ftl);
}

/** Worker/browser-safe bundle factory (no filesystem). */
export function createFluentBundle(locale: string, ftl: string): FluentBundle {
    const bundle = new FluentBundle(normalizeLocaleId(locale));
    const resource = createFluentResource(ftl);
    bundle.addResource(resource);
    return bundle;
}

/** Format a Fluent message; returns messageKey on missing entries. */
export function formatFluentMessage(bundle: FluentBundle, messageId: string, args?: Record<string, FluentVariable>): string {
    const message = bundle.getMessage(messageId);
    if (!message?.value) {
        return messageId;
    }
    const errors: Error[] = [];
    const formatted = bundle.formatPattern(message.value, args ?? {}, errors);
    if (errors.length > 0) {
        return messageId;
    }
    return formatted;
}

/** Pick best negotiated locale from available Fluent locales. */
export function negotiateFluentLocale(requested: string, available: readonly string[]): string {
    const normalized = available.map((id) => normalizeLocaleId(id));
    const [best] = negotiateLanguages([requested], normalized, { defaultLocale: normalized[0] });
    return best ?? normalized[0] ?? requested;
}

function fluentCatalogFromFtl(locale: string, ftl: string): CvoMessageCatalog {
    return createMessageCatalog(locale, { __fluent: ftl });
}

/** Register Fluent locales through the standard CVO i18n plugin. */
export function defineFluentI18nPlugin(options: DefineFluentI18nPluginOptions): CvoPlugin {
    const manifest: CvoLocaleManifest = createLocaleManifest(
        options.defaultLocale,
        options.locales.map(({ id, label, direction }) => ({ id, label, direction })),
        options.fallback,
    );
    const catalogs = options.locales.map(({ id, ftl }) => fluentCatalogFromFtl(id, ftl));
    return defineI18nPlugin({
        name: options.name ?? '@cvo/plugin-i18n-fluent',
        version: options.version ?? '0.0.0',
        manifest,
        catalogs,
    });
}

export { createLocaleManifest, createMessageCatalog, defineI18nPlugin, normalizeLocaleId, resolveLocale };
