// Camera and placement data live in the asset manifest, not in the viewer.
const vector = (value, length) => Array.isArray(value) && value.length === length && value.every(Number.isFinite);
function transform(value, label) {
  if (!value || !vector(value.position, 3) || !vector(value.quaternion, 4) ||
      Math.abs(Math.hypot(...value.quaternion) - 1) > .02) throw new Error(`${label} 좌표가 올바르지 않습니다.`);
  if (value.scale !== undefined && (!Number.isFinite(value.scale) || value.scale <= 0)) throw new Error(`${label} 배율이 올바르지 않습니다.`);
}
export function validateSceneManifest(value, baseURL) {
  if (!value || value.version !== 1) throw new Error('장면 설정 버전을 확인해 주세요.');
  const assetURL = new URL(value.asset?.url || '', baseURL);
  if (assetURL.origin !== new URL(baseURL).origin || !/\.(spz|splat|ply|rad)$/i.test(assetURL.pathname)) {
    throw new Error('책상 스캔 파일 경로가 올바르지 않습니다.');
  }
  transform(value.scan, '스캔'); transform(value.fan, '팬');
  if (!Number.isFinite(value.fan.size) || value.fan.size <= 0 || value.fan.size > 2) throw new Error('팬 크기를 확인해 주세요.');
  for (const name of ['overview', 'fan', 'structure']) {
    const view = value.views?.[name];
    if (!view || !vector(view.position, 3) || !vector(view.target, 3) ||
        view.position.every((n, i) => Math.abs(n - view.target[i]) < .0001)) throw new Error('시점 설정을 확인해 주세요.');
  }
  if (!value.camera || !vector(value.camera.up, 3) || Math.hypot(...value.camera.up) < .1 ||
      !Number.isFinite(value.camera.fov) || value.camera.fov < 10 || value.camera.fov > 100) throw new Error('카메라 설정을 확인해 주세요.');
  for (const cover of value.screenCovers || []) {
    transform(cover, '화면 가림면');
    if (!vector(cover.size, 2) || cover.size.some(n => n <= 0)) throw new Error('화면 가림면 크기를 확인해 주세요.');
  }
  return {...value, asset: {...value.asset, resolvedURL: assetURL.href}};
}
