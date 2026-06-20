# CLAUDE.md — whisky-frog-web (④ 프론트엔드 · public)

> 이 레포는 **공개(public)** 입니다. Vercel 배포용 Next.js **씬 클라이언트**.
> 비즈니스 로직·시크릿은 여기 두지 않습니다 (DECISIONS 021). 백엔드(비공개)와는 **HTTP API로만** 통신.

---

## 세션 정체성
- 모듈 **④ 프론트엔드**. 렌더 + 백엔드 API 호출만 담당.
- 백엔드/도메인 IP(세금·비용엔진·분류기·마켓config)는 **이 레포에 없음** — private 레포 `whisky-frog-lab`에 있음.

## 컨텍스트 확보 (Option A — 볼트 로컬 참조)
깊은 프로젝트 맥락은 **private 볼트**에서 읽습니다. 같은 머신에 sibling으로 클론돼 있다고 가정:
- 볼트 경로: `../whisky-frog-lab/` (Obsidian 볼트, private)
- 세션 시작 시 읽기 순서: `../whisky-frog-lab/HOME.md`(지식 지도) → `CLAUDE.md` → `DECISIONS.md` → `CHECKLIST.md`
- 프론트 작업 UI 스펙: `../whisky-frog-lab/docs/handoff-frontend-admin-markets.md`,
  `../whisky-frog-lab/docs/handoff-frontend-admin-markets-api.md`
- ⚠️ 볼트 내용(세금모델·전략·분류기 설계 등)을 **이 public 레포에 복붙 금지.** 읽어서 이해만, 산출물은 코드.
- 볼트 접근 불가 시 → 메인 오케스트레이터에게 필요한 계약/스펙을 요청.

## ⚠️ public 철칙 (DECISIONS 021 — 반드시 준수)
1. 비즈니스 계산(세금·비용·분류) 코드를 두지 않음 — **서버액션/route 포함**, 전부 backend API 호출.
2. `NEXT_PUBLIC_*`는 브라우저 번들에 박힘 → **비밀 아닌 값만** (API 키·토큰 금지).
3. 시크릿·마켓config·세율표 커밋 금지. `.env*`는 `.gitignore`(예외 `.env.example` 템플릿).
4. `/admin` UI 코드는 공개됨 — 인증은 **백엔드가 강제**(`X-Admin-Token` 헤더). 토큰값 하드코딩 금지.

## API 계약 (백엔드와의 유일한 경계)
- 타입 생성: `npm run gen:api` — 백엔드 로컬 기동 시 `http://localhost:8000/openapi.json` → `app/lib/api/types.gen.ts`.
- 생성된 `types.gen.ts`를 **커밋** → 계약이 타입체크로 강제됨. 백엔드 API 변경 시 재생성.
- 사람용 계약 설명서: 볼트 `../whisky-frog-lab/docs/handoff-frontend-admin-markets-api.md`.

## 환경변수
- `NEXT_PUBLIC_API_BASE_URL` — 백엔드(Railway) 공개 URL. 로컬은 `http://localhost:8000`. `.env.example` 참조.

## 커밋 규칙
- **프롬프트 단위 커밋**, 메시지 `prompt: <요약> / <변경 파일 요약>`.
- 브랜치 `feature/<기능>` → 완료 시 이 레포의 `main` 머지(= Vercel 자동배포).
- 커미터: `git config user.name "frontend-session"` · `git config user.email "djejgrpgkwl@gmail.com"`.
- 트레일러: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## 스택 / 현재 화면
- Next.js 15 + Tailwind. 기존: 환율표(`/exchange-rates`), 관리자 마켓(`/admin/markets`), 홈 TopNav.
