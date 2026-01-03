#!/usr/bin/env bash

if [ ! "$(docker ps -a | grep redis)" ]; then
  docker run --name redis -d -p $REDIS_PORT:$REDIS_PORT redis
elif [ ! "$(docker ps | grep redis)" ]; then
  docker start redis
  timeout 30s bash -c "until docker exec redis redis-cli ping | grep -q \"PONG\"; do sleep 5; done"
fi

docker logs -f --since 0m redis