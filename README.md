# FLIGHT / 비행 자세 제어

[비행기 장면](https://snoopuppy582.github.io/physical-computing-twin/flight.html) · [휴대폰 제어 화면](https://snoopuppy582.github.io/physical-computing-twin/phone.html) · [제작 정보·에셋 출처](https://snoopuppy582.github.io/physical-computing-twin/flight-credits.html)

스마트폰의 방향 센서 → MQTT 브로커 → Three.js 비행기 장면. 컴퓨터에 표시된 QR을 휴대폰으로 열고 **센서 시작 → 기준 자세 설정**을 누른 뒤 휴대폰을 기울인다. 두 기기가 인터넷에 연결되어 있으면 같은 Wi-Fi에 있을 필요는 없다.

교수님이 제공한 Week 07의 `phone-pose.html`, `mqtt-pose-twin.html`을 바탕으로 QR 연결, 기준 자세 설정, GLB 비행기·HDR 하늘, 수신 상태와 왕복 지연 표시를 추가했다. PC 제어판의 슬라이더도 실제 MQTT 브로커를 통한다.

## 구성

| 파일 | 역할 |
| --- | --- |
| `index.html` · `flight.html` | 같은 비행기 장면, QR 연결과 상태 표시 |
| `phone.html` · `phone.js` | 휴대폰 센서 발행기와 PC 직접 조작 |
| `flight.js` | Three.js 장면·기체 자세 보간 |
| `flight-core.mjs` | 연결 번호, 기준 자세 계산, 페이로드 검증 |
| `flight-mqtt.mjs` | MQTT 연결·발행·구독·왕복 지연 측정 |
| `assets/flight/` | Airplane GLB · 1K 하늘 HDR |
| `vendor/` | 고정 버전 Three.js · MQTT.js · QR 라이브러리와 라이선스 |

브로커는 EMQX이며, 연결 문제 시 PC의 연결 정보에서 다시 연결할 수 있다. 연결 번호마다 별도 토픽을 사용한다. 공개 브로커에는 자세·순번·지연 측정 메시지만 보내며, 계정이나 비밀번호를 코드에 넣지 않는다. 연결 번호는 토픽을 구분하며 인증 수단은 아니다.

방향 값은 기준 자세에 대한 상대 회전이다. 단위는 도(°), 범위는 pitch ±35°, roll/yaw ±55°다. 발행 주기는 100ms이며, 화면 전환이나 전송 중지 시 휴대폰의 센서 발행을 중단한다. 컴퓨터는 마지막 수신 자세를 유지하고 신호 중단을 표시한다. **10초 측정 버튼은 메시지 수신을 세는 타이머이며 영상을 녹화하지 않는다.**

## 실행과 확인

GitHub Pages의 HTTPS 주소에서 실행한다. 휴대폰 센서는 보안 연결과 브라우저 권한이 필요하다. PC 장면은 이 폴더에서 `python -m http.server 8765`를 실행하고 `http://localhost:8765/flight.html`로도 확인할 수 있다.

정적 파일·회전 계산·메시지 검증·휴대폰 제어 로직은 코드 테스트로 확인한다. 브로커 통신 검증과 실제 휴대폰 센서·브라우저 렌더링 검증은 별개이며, 최종 촬영 전에 휴대폰으로 연결해 기체 반응을 확인한다.

## 지난 과제

- [9월 20일 · 스플랫 + 메시](https://snoopuppy582.github.io/physical-computing-twin/week03.html): 카페 스플랫과 방문 모델의 10초 시뮬레이션.
- [9월 13일 · 개념화·모델링·스캔](https://snoopuppy582.github.io/physical-computing-twin/week02.html)

현재 루트 페이지는 FLIGHT다. 카페 장면은 `week03.html`에 유지한다.
