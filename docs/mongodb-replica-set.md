# MongoDB replica set for P2-08

P2-08 writes the stock balance, part usage, and inventory transaction together. MongoDB multi-document transactions require a replica set. The checked-in production Compose file currently starts standalone MongoDB; do not deploy P2-08 transaction code to that deployment until the production database is converted and verified.

## Local development

The development `docker-compose.yml` starts a single-node replica set named `rs0` and initializes it on a new MongoDB data volume. The example URI is:

```text
mongodb://127.0.0.1:27017/fixxer?replicaSet=rs0
```

Start MongoDB from the backend directory:

```sh
docker compose up -d mongo
docker compose ps mongo
```

The health check becomes healthy only after the node is writable primary. Verify the replica set:

```sh
docker compose exec mongo mongosh --quiet --eval 'printjson(rs.status().members.map(m => ({ name: m.name, stateStr: m.stateStr })))'
```

Expected state: the sole member is `PRIMARY`.

For an existing local data volume, the initialization script is not rerun automatically. Initiate the single-node set once, then restart the API with the replica-set URI:

```sh
docker compose exec mongo mongosh --quiet --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
docker compose exec mongo mongosh --quiet --eval 'printjson(rs.status().members.map(m => ({ name: m.name, stateStr: m.stateStr })))'
```

If the set was already initialized, verify its member address instead of initiating it again. Do not remove the local volume to enable transactions; that would delete local database data.

## Production deployment requirement

Production has not been verified and the checked-in `deploy/docker-compose.prod.yml` currently starts a standalone `mongod`. Before deploying P2-08:

1. Back up the production database and test a restore.
2. Plan a maintenance window and update MongoDB startup to use `--replSet rs0`.
3. Initialize the existing data directory with a single-member replica set whose advertised hostname is reachable from both the MongoDB host and the API process. The example production API runs on the host and MongoDB is published on loopback, so verify the chosen member address from that topology; do not blindly reuse a hostname that only resolves inside Docker.
4. Add `replicaSet=rs0` to the production `MONGO_URI`, preserving any existing authentication and TLS options.
5. Restart MongoDB and the API, then verify `rs.status()` reports one `PRIMARY` member and run a transaction smoke check before enabling P2-08.

The existing production Compose file and production environment are intentionally not changed by the local setup. A standalone server will reject transaction operations; P2-08 must not silently fall back to non-atomic stock and ledger writes.
