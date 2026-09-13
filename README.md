# 7평의 방

실감피지컬컴퓨팅 2주차: 공간 개념화, 방문 모델링, 카페 공간 스캔.

[과제 사이트](https://snoopuppy582.github.io/physical-computing-twin/) · [파일 및 제작 정보](https://snoopuppy582.github.io/physical-computing-twin/study-notes.html)

| 과제 | 페이지 | 자료 |
| --- | --- | --- |
| 공간 개념화 | room-template.html | evidence/box-scene.png |
| AI 기반 모델링 | door-model.html | assets/room-door.glb · evidence/blender-door.png |
| 테스트 스캔 | w02-spz-viewer.html | assets/cafe-test.spz · evidence/cafe-scan.png |

약 7평을 기준으로 방 4.2 × 5.5 × 2.4m와 가구 배치를 단순화했다. 박스 방문과 상세 모델의 문판은 모두 0.9 × 2 × 0.04m이다.

## AI 사용내역

1. Codex와 Blender MCP로 박스 개념화의 방문을 0.9 × 2 × 0.04m 크기로 모델링했다.
2. 문판에 손잡이와 경첩을 추가하고, 고정 문틀과 회전 문판을 분리했다.
3. GLB로 내보낸 뒤 웹 뷰어에서 경첩을 축으로 문이 열리고 닫히는 동작을 확인했다.

## 실행

이 폴더에서 `python -m http.server 8765`를 실행한 뒤 브라우저로 접속한다. Three.js와 Spark는 CDN에서 불러온다.

강의 제공 예제의 구조와 학습 내용을 바탕으로 수정했다.
