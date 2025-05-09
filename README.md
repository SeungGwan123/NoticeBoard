# Noticeboard Project

## 개요

Noticeboard 프로젝트는 NestJS와 PostgreSQL을 사용하여 게시판 기능을 제공하는 웹 애플리케이션입니다. 이 프로젝트는 게시글을 작성하고, 수정하고, 삭제하는 기본적인 게시판 기능을 포함하고 있습니다.

## 기술 스택

- **Backend**: NestJS
- **Database**: PostgreSQL
- **ORM**: TypeORM
- **Authentication**: JWT
- **API Documentation**: Swagger

## 설치 및 실행 방법

### 1. 프로젝트 클론

프로젝트를 로컬 환경에 클론합니다.

```bash
git clone <repository-url>
cd noticeboard
```

### 2. 환경 변수 설정
프로젝트 루트 디렉토리에 .env.development 및 .env.production 파일을 생성하고, 필요한 환경 변수들을 설정합니다.

예시:
.env.development
```env
DB_HOST=db
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=1234
DB_DATABASE=testnoticeboard
DB_SYNC=true
DB_DROPSCHEMA=true

ACCESS_TOKEN_SECRET=noticeboardAccessTokenSecret
REFRESH_TOKEN_SECRET=noticeboardRefreshTokenSecret
ACCESS_TOKEN_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_NUMBER=604800000

NODE_ENV=development
```
.env.production

```env
DB_HOST=db
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=1234
DB_DATABASE=noticeboard
DB_SYNC=false
DB_DROPSCHEMA=false

ACCESS_TOKEN_SECRET=noticeboardAccessTokenSecret
REFRESH_TOKEN_SECRET=noticeboardRefreshTokenSecret
ACCESS_TOKEN_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_NUMBER=604800000

NODE_ENV=production
```
### 3. 의존성 설치
프로젝트의 의존성을 설치합니다.

```bash
npm install
```
### 4. 도커 설정
프로젝트에서는 Docker를 사용하여 실행할 수 있습니다. docker-compose.yml 파일을 사용하여 PostgreSQL과 Backend를 설정합니다.

```bash
docker-compose up --build
```
### 5. 애플리케이션 실행
애플리케이션을 로컬에서 실행하려면 아래 명령어를 사용합니다:

```bash
npm run start:dev  # 개발 모드로 실행
```
### 6. API Documentation
애플리케이션이 실행되면, Swagger UI를 통해 API 문서를 확인할 수 있습니다. 기본적으로 http://localhost:3000/api에서 접근할 수 있습니다.

### 프로젝트 구조

auth/: 인증 관련 로직

comment/: 댓글 관련 로직

post/: 게시글 관련 로직

user/: 사용자 관련 로직

.env: 환경 변수 설정 파일

docker-compose.yml: Docker를 이용한 환경 설정 파일

