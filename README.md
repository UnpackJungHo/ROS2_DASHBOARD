# ROS2 Dashboard

ROS2 도메인 정보를 수집하는 FastAPI 백엔드와, 이를 시각화하는 Next.js 프론트엔드로 구성된 프로젝트입니다.

## Project Structure

- `backend`: FastAPI + `rclpy` 기반 API 서버
- `frontend`: Next.js 기반 대시보드 UI

## Running The Project

### Backend

백엔드는 ROS2 환경과 `rclpy`가 사용 가능한 Python 환경이 필요합니다.

```bash
cd backend
../venv/bin/python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

기본 API 주소는 `http://localhost:8000`입니다.

주요 엔드포인트:

- `GET /api/v1/health`
- `GET /api/v1/scan/{domain_id}`
- `GET /api/v1/graph/{domain_id}`

### Frontend

프론트엔드는 기본적으로 `http://localhost:8000`의 백엔드를 바라봅니다. 다른 주소를 사용하려면 `NEXT_PUBLIC_API_URL`을 지정합니다.

```bash
cd frontend
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 됩니다.

예시:

```bash
cd frontend
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

## Test Guide

현재 저장소에는 프론트엔드와 백엔드 모두 별도의 통합 테스트 스위트가 충분히 갖춰져 있지 않습니다. 그래서 아래 절차로 기본 검증을 수행합니다.

### 1. Backend automated test check

백엔드는 `pytest` 의존성은 있지만, 현재 저장소 기준으로 수집되는 테스트 파일이 없습니다.

```bash
./venv/bin/python -m pytest backend
```

현재 결과:

- `0 tests collected`

### 2. Frontend static check

프론트엔드 기본 정적 검사는 ESLint입니다.

```bash
cd frontend
npm run lint
```

### 3. Frontend production build check

프로덕션 빌드 가능 여부를 확인합니다.

```bash
cd frontend
npm run build
```

### 4. End-to-end manual check

백엔드와 프론트엔드를 모두 띄운 뒤 수동으로 동작을 확인합니다.

1. 백엔드를 `:8000`에서 실행합니다.
2. 프론트엔드를 `:3000`에서 실행합니다.
3. 브라우저에서 `http://localhost:3000`에 접속합니다.
4. `ROS_DOMAIN_ID`를 입력합니다.
5. 토픽, 서비스, 액션, 노드, 그래프가 정상적으로 표시되는지 확인합니다.
6. 백엔드 API 상태는 `http://localhost:8000/api/v1/health`로 확인합니다.

## Recommended Validation Flow

변경 후 최소 확인 순서는 아래와 같습니다.

```bash
./venv/bin/python -m pytest backend
cd frontend && npm run lint
cd frontend && npm run build
```

그 다음 실제 ROS2 환경에서 백엔드와 프론트엔드를 함께 띄워 수동 점검을 진행합니다.

## Current Caveats

현재 저장소 상태 기준으로 아래 사유로 검증 명령이 실패할 수 있습니다.

- 백엔드: `pytest`는 실행되지만 현재 테스트 파일이 없어 `0 tests collected` 상태입니다.
- 프론트엔드 `lint`: `frontend/src/components/node-graph.tsx`에서 React Hooks/refs 관련 ESLint 오류로 실패할 수 있습니다.
- 프론트엔드 `build`: `frontend/src/app/layout.tsx`에서 `next/font/google`의 `Geist Mono`를 불러오므로, 네트워크가 제한된 환경에서는 Google Fonts 요청 실패로 빌드가 실패할 수 있습니다.
