import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validateSceneManifest} from '../cooler-scene.mjs';

const source = () => ({
  version: 1, asset: {url: 'desk.spz'},
  scan: {position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: 1},
  fan: {position: [-1, -.3, .5], quaternion: [0, 0, 0, 1], size: .12},
  camera: {up: [0, 1, 0], fov: 50},
  views: Object.fromEntries(['overview', 'fan', 'structure'].map(name => [name, {position: [1, 1, 2], target: [0, 0, 0]}])),
  screenCovers: [{position: [0, 0, 0], quaternion: [0, 0, 0, 1], size: [.3, .2]}]
});
const base = 'https://example.org/course/assets/desk/scene.json';
test('Manifest uses its own asset-relative path and preserves calibrated positions', () => {
  const result = validateSceneManifest(source(), base);
  assert.equal(result.asset.resolvedURL, 'https://example.org/course/assets/desk/desk.spz');
  assert.deepEqual(result.fan.position, [-1, -.3, .5]);
});
test('Manifest rejects unsupported resources and invalid camera or placement data', () => {
  for (const mutate of [
    value => { value.asset.url = 'https://external.example/unknown.spz'; },
    value => { value.asset.url = 'page.html'; },
    value => { value.fan.position = [0, NaN, 0]; },
    value => { value.fan.quaternion = [0, 0, 0, 0]; },
    value => { value.camera.fov = 0; },
    value => { value.views.fan.position = [0, 0, 0]; },
    value => { value.screenCovers[0].size = [-.3, .2]; }
  ]) {
    const value = source(); mutate(value);
    assert.throws(() => validateSceneManifest(value, base));
  }
});
