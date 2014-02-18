import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CvoPlugin, CvoUserConfig, DefineCvoPluginInput } from './types.js';
import { CVO_PLUGIN_PROTOCOL } from './types.js';

export {
    CVO_PLUGIN_PROTOCOL,
    type CvoContributionBatch,
    type CvoContributionItem,
    type CvoPlugin,
    type CvoPluginContext,
    type CvoPluginManifest,
    type CvoPluginStage,
    type CvoResolvedPackage,
    type CvoUserConfig,
    type DefineCvoPluginInput,
} from './types.js';

/** SHA-256 hex digest for plugin source provenance. */
export function contentHash(content: string | Buffer): string {
    return createHash('sha256').update(content).digest('hex');
}

/** Resolve a path next to the calling plugin module. */
export function pluginFileUrl(importMetaUrl: string, relativePath: string): string {
    return path.join(path.dirname(fileURLToPath(importMetaUrl)), relativePath);
}

/** Load text shipped beside a plugin entry (e.g. locale catalogs). */
export function loadPluginSource(importMetaUrl: string, relativePath: string): { content: string; contentHash: string; absPath: string } {
    const absPath = pluginFileUrl(importMetaUrl, relativePath);
    const content = readFileSync(absPath, 'utf8');
    return { content, contentHash: contentHash(content), absPath };
}

/** Register a CVO toolchain plugin. */
export function definePlugin(def: DefineCvoPluginInput): CvoPlugin {
    if (!def?.name || !def?.version || !Array.isArray(def.stages) || def.stages.length === 0) {
        throw new Error('definePlugin requires name, version, and non-empty stages[]');
    }
    return {
        manifest: {
            name: def.name,
            version: def.version,
            protocol: def.protocol ?? CVO_PLUGIN_PROTOCOL,
            stages: def.stages,
            deterministic: def.deterministic ?? true,
        },
        contribute: def.contribute,
    };
}

/** Identity helper for `cvo.config.ts` inference. */
export function defineConfig(config: CvoUserConfig): CvoUserConfig {
    return config ?? {};
}
