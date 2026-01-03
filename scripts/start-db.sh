#!/usr/bin/env bash

if [ ! "$(docker ps -a | grep postgres)" ]; then
  docker run -d --name postgres -e POSTGRES_PASSWORD=$DB_PASSWORD -e POSTGRES_USER=$DB_USERNAME -e POSTGRES_DB=$DB_DATABASE -p $DB_PORT:$DB_PORT postgres
elif [ ! "$(docker ps | grep postgres)" ]; then
  docker start postgres
  timeout 30s bash -c "until docker exec postgres pg_isready; do sleep 5; done"
fi

docker logs -f --since 0m postgres