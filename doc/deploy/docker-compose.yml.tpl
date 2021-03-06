version: '3.3'

services:
  lookout:
    image: "srcd/lookout:latest"
    network_mode: "host"
    depends_on:
      - postgres
      - dummy
    environment:
      GITHUB_USER: ${GITHUB_USER:-}
      GITHUB_TOKEN: ${GITHUB_TOKEN:-}
    ports:
      - "10301:10301"
    entrypoint: ["/bin/sh"]
    # sleep because container with db is up but the db itself doesn't accept connections yet
    command: ["-c", "sleep 5 && lookoutd migrate && lookoutd serve"]
    volumes:
      - ./config.yml:/config.yml
  bblfsh:
    image: "bblfsh/bblfshd:v2.10.0"
    ports:
    - "9432:9432"
    privileged: true
    entrypoint: ["/bin/sh"]
    command:
    - "-c"
    - "bblfshd & sleep 5 && bblfshctl driver install javascript \
       bblfsh/javascript-driver:v1.2.0 && tail -f /dev/null"
  postgres:
    image: "postgres:alpine"
    restart: always
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: lookout