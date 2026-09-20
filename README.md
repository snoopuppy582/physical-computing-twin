# 공간과 움직임

실감피지컬컴퓨팅 · 9월 20일 과제

[통합 장면](https://snoopuppy582.github.io/physical-computing-twin/) · [제작 정보](https://snoopuppy582.github.io/physical-computing-twin/week03-notes.html) · [9월 13일 과제](https://snoopuppy582.github.io/physical-computing-twin/week02.html)

카페 스플랫과 방문 GLB를 하나의 Three.js 장면에 배치했다. 시뮬레이션 버튼을 누르면 고정 문틀 안의 문판이 경첩 축으로 열리고 닫힌다.

| 자료 | 파일 |
| --- | --- |
| 통합 장면 | index.html · twin.js · twin-config.json |
| 배경 스플랫 | assets/cafe-clean.spz |
| 방문 모델 | assets/room-door.glb |
| 장면 화면 | evidence/week03-scene.png |
| 10초 영상 | media/week03-simulation.mp4 |
| 스캔 정리 전·후 | evidence/week03-scan-before.png · evidence/week03-scan-after.png |

스캔은 240,570개에서 229,840개로 정리했다. 원본 방향과 크기를 유지했으며, 문판은 0.9 × 2.0m 모델이다.

## 실행

`python -m http.server 8765` 실행 후 브라우저에서 접속한다. 수업 지정 Three.js 0.180.0과 Spark 2.1.0을 사용한다.

강의 제공 splat-twin.html의 장면 구성과 지난 과제의 방문 모델을 바탕으로 제작했다. 배경 정리는 PlayCanvas의 공식 splat-transform 도구를 사용했다.
