FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY dist/ ./dist/
COPY src/web/static/ ./dist/web/static/

EXPOSE 3000

VOLUME /data

ENV DATA_DIR=/data
ENV PORT=3000

CMD ["node", "dist/index.js"]