FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production=false
COPY . .
RUN npm run build
RUN npm prune --production
EXPOSE 5179
CMD ["node", "dist/server/server/index.js"]
