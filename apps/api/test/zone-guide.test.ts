import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { zoneGuideSchema } from '@bioatlas/contracts';
import { getZoneGuide } from '../src/zone-guide.ts';
test('every zone has sourced sections and unavailable local inventories stay regional', async () => {
  const fixture = JSON.parse(
    await readFile(new URL('../fixtures/valdivia-macrozones.geojson', import.meta.url), 'utf8'),
  );
  for (const feature of fixture.features) {
    const guide = zoneGuideSchema.parse(
      getZoneGuide(feature.properties.id, feature.properties.name),
    );
    assert.deepEqual(
      guide.sections.map((s) => s.id),
      ['culture', 'trees', 'flora'],
    );
    assert.ok(
      guide.sections.every((s) => s.sources.every((source) => source.url.startsWith('https://'))),
    );
    assert.equal(guide.sections.find((s) => s.id === 'trees')?.scope, 'commune');
  }
  const park = getZoneGuide('inat-199913', 'Parque Urbano El Bosque');
  assert.ok(park.sections.find((s) => s.id === 'trees')?.text.includes('Nothofagus obliqua'));
  assert.equal(park.sections.find((s) => s.id === 'trees')?.scope, 'sector');
  const unknown = getZoneGuide('unknown', 'Unknown');
  assert.ok(unknown.sections.every((s) => s.scope === 'commune'));
});
