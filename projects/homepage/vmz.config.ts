import { defineConfig } from '@vmz/plugin';

export default defineConfig({
    delivery: {
        default: 'static',
        profiles: {
            /** Pages CDN — no ServerArtifact. */
            static: { host: 'browser', assembly: 'web-static' },
            /**
             * CVO edge host — emits `vmz.server.artifact.v0` + `#server` modules.
             * Author surface remains `<script server>`; CVO only hosts the artifact.
             */
            edge: {
                host: 'browser',
                assembly: 'server-host',
                serverRuntime: 'worker',
            },
        },
    },
});
