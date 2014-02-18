/** CVO plugin protocol version (independent from cvo-contract-v1). */
export const CVO_PLUGIN_PROTOCOL = 'cvo.plugin.v1';

export type CvoPluginStage =
    | 'workspace_resolve'
    | 'contract_adapter'
    | 'route_emit'
    | 'locale_resolve'
    | 'auth_policy'
    | 'observability'
    | 'data_transport'
    | 'worker_bundle';

export interface CvoPluginManifest {
    readonly name: string;
    readonly version: string;
    readonly protocol?: string;
    readonly stages: readonly CvoPluginStage[];
    readonly deterministic?: boolean;
}

export interface CvoResolvedPackage {
    readonly name: string;
    readonly root: string;
    readonly version?: string;
}

export interface CvoPluginContext {
    readonly project: string;
    readonly outDir: string;
    readonly stage: CvoPluginStage | string;
    readonly protocol: string;
    readonly packages: readonly CvoResolvedPackage[];
    readonly contractId?: string;
}

export interface CvoContributionItem {
    readonly id: string;
    readonly kind: string;
    readonly path?: string;
    readonly content?: string;
    readonly contentHash?: string;
    readonly severity?: 'error' | 'warning' | 'info';
    readonly message?: string;
    readonly code?: string;
}

export interface CvoContributionBatch {
    readonly stage: CvoPluginStage | string;
    readonly cacheKey?: string;
    readonly deterministic?: boolean;
    readonly items: readonly CvoContributionItem[];
}

export interface CvoPlugin {
    readonly manifest: CvoPluginManifest;
    contribute?(ctx: CvoPluginContext): Promise<CvoContributionBatch[] | CvoContributionBatch> | CvoContributionBatch[] | CvoContributionBatch;
}

export interface CvoUserConfig {
    readonly plugins?: readonly (string | CvoPlugin | Promise<CvoPlugin>)[];
    readonly contractId?: string;
    readonly locales?: {
        readonly default?: string;
        readonly catalog?: string;
    };
}

export type DefineCvoPluginInput = CvoPluginManifest & {
    contribute?: CvoPlugin['contribute'];
};
