FROM node:22-alpine
WORKDIR /app
COPY . .
# Keep a pristine copy of the content so an empty volume can be seeded on first start.
RUN cp -r data /app/data-seed
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["sh", "-c", "[ -f data/content.json ] || cp -r /app/data-seed/. data/; exec node server.js"]
