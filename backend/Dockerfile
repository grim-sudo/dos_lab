FROM node:20-slim

# Debian-based (node slim uses debian bookworm under the hood)
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
