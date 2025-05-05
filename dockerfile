# Dockerfile
FROM node:18-alpine

# 앱 디렉토리 생성
WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm install

# 소스 복사 및 빌드
COPY . .
RUN npm run build

# 앱 실행
CMD ["node", "dist/main"]