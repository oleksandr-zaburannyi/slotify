FROM node:24-slim

RUN mkdir -p /usr/src/slotify/back-office

WORKDIR /usr/src/slotify/back-office

COPY . .

RUN npm ci --omit=dev
RUN npm run build

EXPOSE 8080

CMD ["sh", "-c", "sh ./script/passEnvVariables.sh && node index.ts"]