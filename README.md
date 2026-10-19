# 실감피지컬컴퓨팅

## 중간 발표 · 냉각 거치대

[냉각 거치대 3D 장면](https://snoopuppy582.github.io/physical-computing-twin/cooler.html) · [MQTT 제어판](https://snoopuppy582.github.io/physical-computing-twin/twin-control.html)

두 페이지를 함께 열고 제어판에서 출력을 바꾼다. 메시지가 공개 EMQX 브로커를 거쳐 장면에 도착하면 가상 팬이 회전한다. 같은 기본 연결 번호를 사용하므로 두 주소를 그대로 열어 시연할 수 있다. 별도 연결은 두 주소에 같은 `#room=연결이름`을 붙여 구분한다.

직접 스캔한 책상에 추가 냉각팬과 고정부 메시를 배치했다. 스캔 속 흰색 노트북을 대상으로 하는 **거치대 하단 설치 구상**이며, 정확한 고정 위치는 실측 후 정한다. **실제 팬은 연결하지 않았으며**, CPU·GPU 온도와 실측 RPM은 값을 표시하지 않는다.

‘책상 보기’에서 사용 공간을 보고, ‘팬 위치’에서는 스캔을 반투명하게 표시해 설치 구상과 회전을 확인한다. ‘구조 보기’에서는 배경을 숨겨 팬과 고정부를 살펴본다. 스캔에 이미 있는 책상·노트북을 별도의 모델로 중복 배치하지 않는다.

- `cooler.html` · `cooler.js` · `cooler.css`: 책상 스캔과 팬·고정부 3D 장면.
- `twin-control.html` · `cooler-control.js`: 출력 설정, 장면 수신 확인, 왕복 지연.
- `cooler-core.mjs` · `cooler-mqtt.mjs`: 연결 번호·메시지 검증·MQTT 통신.
- `assets/desk/`: 화면 영역을 제거한 배포용 스캔과 장면 배치 정보.
- `vendor/spark/`: 고정 버전 Spark 스플랫 렌더러와 라이선스.

배포용 스캔은 원본 PLY에서 화면 영역의 가우시안을 제거하고, 불필요한 외곽·잡점을 정리해 SPZ로 압축했다. 단색 화면판은 제거된 자리를 정리하는 용도이며, 원래 화면 정보가 남은 스캔을 그 뒤에 숨기는 방식이 아니다. 원본 PLY는 이 저장소에 포함하지 않는다.

실물 제어와 계정 정보는 포함하지 않는다. 공개 브로커의 연결 번호는 인증 수단이 아니며, 이 페이지는 가상 팬 시연용이다. 제어판의 전송이 끊기면 장면은 8초 후 가상 팬을 정지한다.

## 지난 과제 · FLIGHT / 비행 자세 제어

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

휴대폰의 센서 각도는 입력 경계에서 쿼터니언으로 바꾼다. 기준 자세의 역쿼터니언과 현재 자세를 곱해 상대 회전을 계산하고, 정규화한 `qx·qy·qz·qw`를 MQTT로 전송한다. 컴퓨터는 수신한 쿼터니언을 기체의 목표 자세로 바로 사용하며 SLERP로 보간한다. 축별 각도 제한과 오일러각을 통한 제어 경로는 없다.

오일러각(YXZ)은 계기 숫자와 휴대폰 자세계 표시에만 사용한다. 수직 자세나 ±180° 경계에서 표시 각도의 표현이 달라질 수 있지만, 이 값은 기체 제어에 다시 입력하지 않는다. PC 제어판은 각 축의 회전 속도(°/s)를 쿼터니언에 누적한다. 슬라이더를 0으로 두거나 ‘회전 멈춤’을 누르면 현재 자세를 유지하고, ‘수평으로’는 기준 자세로 돌아간다.

프로토콜 버전은 2이며 토픽은 `khu/pcomp/flight-<연결 번호>/v2/pose`다. 예시 메시지는 `{"v":2,"qx":0,"qy":0,"qz":0,"qw":1,"source":"sensor","device":"sender-example","seq":1,"t":0}` 형식이다. 네 성분이 모두 있는 유효한 회전만 수신하고, 기존 각도 메시지·0 벡터·잘못된 값·중복 순번은 거부한다. `q`와 `-q`가 같은 회전을 나타내는 특성도 처리한다.

발행 주기는 100ms이며, 화면 전환이나 전송 중지 시 휴대폰의 센서 발행을 중단한다. 컴퓨터는 마지막 수신 자세를 유지하고 신호 중단을 표시한다. **10초 측정 버튼은 메시지 수신을 세는 타이머이며 영상을 녹화하지 않는다.**

## 실행과 확인

GitHub Pages의 HTTPS 주소에서 실행한다. 휴대폰 센서는 보안 연결과 브라우저 권한이 필요하다. PC 장면은 이 폴더에서 `python -m http.server 8765`를 실행하고 `http://localhost:8765/flight.html`로도 확인할 수 있다.

정적 파일·회전 계산·메시지 검증·휴대폰 제어 로직은 코드 테스트로 확인한다. 브로커 통신 검증과 실제 휴대폰 센서·브라우저 렌더링 검증은 별개이며, 최종 촬영 전에 휴대폰으로 연결해 기체 반응을 확인한다.

## 지난 과제

- [9월 20일 · 스플랫 + 메시](https://snoopuppy582.github.io/physical-computing-twin/week03.html): 카페 스플랫과 방문 모델의 10초 시뮬레이션.
- [9월 13일 · 개념화·모델링·스캔](https://snoopuppy582.github.io/physical-computing-twin/week02.html)

현재 루트 페이지는 FLIGHT다. 카페 장면은 `week03.html`에 유지한다.
