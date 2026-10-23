# هومينا — صورة Docker للنشر السحابي
# البناء:   docker build -t homefees .
# التشغيل:  docker run -p 4751:4751 -v homefees-data:/app/data homefees
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY server/ ./server/
COPY web/ ./web/
ENV PORT=4751
ENV HOMINA_DATA=/app/data
VOLUME ["/app/data"]
EXPOSE 4751
CMD ["node", "server/index.js"]
