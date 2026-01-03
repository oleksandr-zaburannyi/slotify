FROM node:24-slim AS build

RUN mkdir -p /usr/src/slotify/connector

WORKDIR /usr/src/slotify/connector

COPY . .

RUN apt-get update && apt-get install -y jq
RUN npm ci --omit=dev
RUN npm run build
RUN npm run delete-source

ARG OBFUSCATE=false
RUN if [ "$OBFUSCATE" = "true" ]; then npm run obfuscate; fi

FROM scratch AS main
COPY --from=build /usr/src/slotify/connector/lib/ /usr/src/slotify/connector/lib

CMD ["/usr/src/slotify/connector/lib"]