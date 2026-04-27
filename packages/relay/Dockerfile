# Pascal relay — stateless y-websocket router
FROM node:20-alpine AS base
WORKDIR /app

# Don't copy the monorepo's package.json (it references workspace-only
# @pascal/typescript-config). Synthesize a clean one with just the npm deps.
RUN cat > package.json <<'EOF'
{
  "name": "pascal-relay",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "dependencies": {
    "y-websocket": "1.5.4",
    "ws": "^8.20.0",
    "yjs": "^13.6.30"
  },
  "devDependencies": {
    "esbuild": "^0.28.0",
    "typescript": "5.9.3"
  }
}
EOF
RUN npm install

COPY src ./src
COPY tsconfig.json ./
RUN npx esbuild src/index.ts \
      --bundle --platform=node --format=esm --target=node18 \
      --packages=external \
      --outfile=dist/index.js \
      --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);"

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/package.json ./
EXPOSE 8080
CMD ["node", "dist/index.js"]
