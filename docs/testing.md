# 테스트 전략

## 목표

- 백엔드와 프론트엔드 변경을 함께 검증한다.
- Docker 컨테이너 안에서 실제 테스트를 실행한다.
- 반응형 UI와 실데이터 수집 흐름을 함께 확인한다.

## 백엔드 테스트

주요 범위:

- 파서
- 수집 서비스
- 분석 로직
- 요금 계산
- FastAPI API

주요 확인 항목:

- `timeseries` 7일 x 30분 버킷 계산
- `threshold-events` 임계치 진입 / 회복 계산
- `by-weekday-hour` 요일 x 시간 상세 집계
- `admin/collector-status` 응답
- `sample` / `live` 클라이언트 선택 규칙

실행:

```bash
docker compose run --rm --no-deps backend pytest -q
```

## 프론트엔드 테스트

주요 범위:

- API 클라이언트 URL 생성
- 대시보드 렌더링
- 모바일 / 데스크톱 분기
- 마지막으로 본 공항 / 주차장 복원
- 시계열 툴팁
- 시계열 계단형 라인과 X축 라벨 레이아웃
- 요일 x 시간 히트맵
- 요일별 시간대 상세 카드
- 요일별 임계 달성 시간 / 날짜별 임계 달성 시간
- 요금 계산기

실행:

```bash
docker compose run --rm --no-deps frontend npm run test -- --run
```

## 반응형 검증

데스크톱:

- 현재 주차 현황 표 렌더링
- 시계열 차트 렌더링
- 요일 x 시간 히트맵 렌더링
- 요일별 시간대 상세 카드 렌더링
- 임계 달성 시간 표 렌더링

모바일:

- 현재 주차 현황 카드 렌더링
- 패널이 세로 흐름으로 배치되는지 확인
- 차트 툴팁이 터치로 동작하는지 확인

## 시각과 수동 수집 검증

API 확인:

- `GET /parking/current`
- `GET /admin/collector-status`

확인 포인트:

- `observed_at`이 UTC ISO 8601인지 확인
- `collected_at`이 UTC ISO 8601인지 확인
- `latest_snapshot_collected_at`이 UTC ISO 8601인지 확인
- 브라우저에서는 같은 값이 KST로 보이는지 확인

UI 확인:

- `데이터 기준 시각`
- `수집기 마지막 동기화`
- `지금 수집` 버튼

동작 확인:

1. `지금 수집` 1회 실행
2. 성공 메시지 확인
3. 즉시 다시 실행
4. 수동 수집 제한 에러 메시지 확인

## 실데이터 수집 검증

권장 절차:

1. 실데이터용 백엔드를 별도 포트로 띄운다.
2. `ENABLE_SCHEDULER=true`
3. `USE_SAMPLE_CLIENT_WHEN_NO_KEY=false`
4. `DATA_GO_KR_SERVICE_KEY` 설정
5. 빠른 검증이 필요하면 임시로 `COLLECT_INTERVAL_SECONDS=15`로 줄인다.
6. `GET /admin/collector-status`에서 최근 실행 이력을 본다.
7. 검증이 끝나면 live 검증 스택을 즉시 내린다.

정상 신호:

- `scheduler_enabled=true`
- `client_mode=live`
- `status=success`
- `raw_response_count=1`

추가 해석:

- 첫 실행에서 `snapshot_count>0`
- 이후 실행에서 `snapshot_count=0`일 수 있음
  - 원본 `observed_at`이 그대로면 중복 저장을 건너뛰기 때문
- `upstream_rate_limited=true`이면 이미 외부 API 쿼터를 소진한 상태다.
- 같은 인증키를 쓰는 live 수집기는 한 번에 하나만 유지한다.

종료 명령:

```bash
docker compose -f docker-compose.live.yml --project-name parking-radar-live down
```

## 브라우저 검증

in-app browser 또는 브라우저에서 다음을 확인한다.

- [http://localhost:3000](http://localhost:3000) 접속 가능
- [http://localhost:8000/docs](http://localhost:8000/docs) 접속 가능
- KST 기준 시각 표시
- 시계열 툴팁 표시
- 시계열 X축 라벨이 겹치지 않고 6시간 단위로 표시되는지 확인
- 6시간 단위 X축 라벨 표시
- 요일 x 시간 히트맵 표시
- 요일별 시간대 상세 카드 표시
- 요일별 임계 달성 시간 / 날짜별 임계 달성 시간 표시
- `지금 수집` 성공 / 쿨다운 메시지 표시
- 브라우저 콘솔 `error` / `warn` 없음

## ODROID 배포 스모크 체크

배포 후에는 최소한 아래를 확인한다.

- `http://192.168.1.204:3000` 응답
- `http://192.168.1.204:18000/health` 응답
- `http://192.168.1.204:18000/admin/collector-status`에서
  - `client_mode=live`
  - `scheduler_enabled=true`
  - `upstream_rate_limited=false`
- 웹 UI에서
  - 현재 시각 표시가 KST 기준인지 확인
  - `지금 수집` 버튼이 노출되는지 확인

관련 문서:

- [current-state.md](</C:/Users/digit/OneDrive/문서/New project/docs/current-state.md>)
- [time-and-collector.md](</C:/Users/digit/OneDrive/문서/New project/docs/time-and-collector.md>)

## Docker 프론트 테스트 메모

- Docker 안의 `Vitest`는 `testTimeout=15000` 기준으로 실행한다.
- 반응형 대시보드와 폼 상호작용 테스트가 컨테이너 환경에서 느려질 수 있어 기본 5초 제한 대신 여유를 둔다.

## WSL 테스트 기준

- 모든 테스트의 기준 환경은 `WSL2 + Docker`이다.
- 테스트 통과 여부는 `WSL2` 안에서 실행한 `docker compose` 결과를 기준으로 판단한다.
- Windows PowerShell은 배포, 압축, 원격 실행 보조 용도로 사용할 수 있지만 테스트 기준 환경으로 보지 않는다.
