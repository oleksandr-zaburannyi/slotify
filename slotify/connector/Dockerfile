FROM node:24-slim AS build

RUN mkdir -p /usr/src/slotify/connector

WORKDIR /usr/src/slotify/connector

COPY . .

RUN apt-get update && apt-get install -y jq
RUN npm ci --omit=dev
RUN npm run build

FROM scratch AS main
COPY --from=build /usr/src/slotify/connector/lib/ /usr/src/slotify/connector/lib

CMD ["/usr/src/slotify/connector/lib"]