#!/bin/bash

function run_tests() {
  echo "Installing dependencies"
  npm install --prefix "$1"

  echo "Running tests"
  if npm test --prefix "$1" -- --coverage --testTimeout=20000; then
    echo "Tests passed"
  else
    echo "Test failed"
    exit 1
  fi
  echo "----------------------------------------"
}

function build_docker() {
  version=$(cat "$1"/package.json | jq -r ".version")
  image="$2":v"$version"

  exists=$(docker pull "$image" >/dev/null 2>&1 && echo 1 || echo 0)
  if [ "$exists" -eq 0 ]; then
    echo "$image" to be deployed
      echo "Building & pushing"
      DOCKER_BUILDKIT=1 docker buildx build --platform linux/amd64 --push -t "$image" "$1"
  else
    echo "$image" alread exists
  fi
  echo "----------------------------------------"
}


run_tests ../slotify/adapter
run_tests ../slotify/promo
run_tests ../slotify/demo-casino
run_tests ../slotify/back-office
run_tests ../slotify/rgs
run_tests ../slotify/rng
run_tests ../slotify/connector
run_tests ../slotify/shared
run_tests ../slotify/gdk

build_docker ../slotify/adapter ghcr.io/slotify/adapter
build_docker ../slotify/promo ghcr.io/slotify/promo
build_docker ../slotify/demo-casino ghcr.io/slotify/demo-casino
build_docker ../slotify/back-office ghcr.io/slotify/back-office
build_docker ../slotify/rgs ghcr.io/slotify/rgs
build_docker ../slotify/rng ghcr.io/slotify/rng
build_docker ../slotify/connector ghcr.io/slotify/connector
build_docker ../slotify/websocket ghcr.io/slotify/websocket
