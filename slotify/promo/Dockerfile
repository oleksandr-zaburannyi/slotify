FROM node:24-slim

RUN mkdir -p /usr/src/slotify/promo

WORKDIR /usr/src/slotify/promo

COPY . .

RUN npm ci --omit=dev
RUN npm run build

EXPOSE 8080

CMD ["node", "lib/index.js"]