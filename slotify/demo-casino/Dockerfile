FROM node:24-slim

RUN mkdir -p /usr/src/slotify/demo-casino

WORKDIR /usr/src/slotify/demo-casino

COPY . .

RUN npm ci --omit=dev
RUN npm run build

ARG OBFUSCATE=false
RUN if [ "$OBFUSCATE" = "true" ]; then npm run obfuscate; fi

EXPOSE 8080

CMD ["node", "lib/index.js"]