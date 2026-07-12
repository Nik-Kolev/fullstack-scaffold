# ---- deps: install once, reused by the build stage ----
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: generate the Prisma client + compile TypeScript ----
FROM deps AS build
WORKDIR /app
COPY . .
RUN npx prisma generate
RUN npm run build
RUN rm -rf ./dist/__tests__

# ---- runtime: shared by the server and worker services (see docker-compose.yml) ----
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/dist ./dist
# tsc doesn't copy non-.ts files — the generated Prisma client is plain .js/.wasm.
COPY --from=build /app/src/generated/prisma ./dist/generated/prisma
# seed.ts and create-admin.ts run via tsx against source, not dist/.
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
