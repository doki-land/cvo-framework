import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    diagnoseServerArtifactForHost,
    validateServerArtifact,
    vmzOperationId,
    VMZ_SERVER_ARTIFACT_SCHEMA,
} from '@cvo/core';

const fixtureDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../specifications/fixtures/server-artifact');

test('validateServerArtifact accepts preview fixture', () => {
    const json = JSON.parse(readFileSync(path.join(fixtureDir, 'sample-server-artifact.json'), 'utf8')) as unknown;
    const decision = validateServerArtifact(json);
    assert.equal(decision.ok, true);
    assert.equal(decision.artifact?.schema, VMZ_SERVER_ARTIFACT_SCHEMA);
});

test('validateServerArtifact rejects secret values', () => {
    const json = JSON.parse(readFileSync(path.join(fixtureDir, 'sample-server-artifact.json'), 'utf8')) as Record<string, unknown>;
    json.secretRequirements = [{ id: 'DB', value: 'postgres://secret' }];
    const decision = validateServerArtifact(json);
    assert.equal(decision.ok, false);
    assert.equal(decision.code, 'cvo::server_artifact::secret_value_forbidden');
});

test('vmzOperationId is stable', () => {
    assert.equal(vmzOperationId('#server/preview/Health', 'health'), '#server/preview/Health::health');
});

test('diagnoseServerArtifactForHost profiles', () => {
    const json = JSON.parse(readFileSync(path.join(fixtureDir, 'sample-server-artifact.json'), 'utf8')) as unknown;
    const decision = validateServerArtifact(json);
    assert.equal(decision.ok, true);
    const artifact = decision.artifact!;

    const testHost = diagnoseServerArtifactForHost(artifact, 'test-host');
    assert.equal(testHost.ok, true);

    const serverHost = diagnoseServerArtifactForHost(artifact, 'server-host');
    assert.equal(serverHost.ok, true);

    const staticBad = diagnoseServerArtifactForHost(artifact, 'static');
    assert.equal(staticBad.ok, false);
});
