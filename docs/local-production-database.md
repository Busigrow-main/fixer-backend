# Run the backend locally against the deployed database

Local `npm run start:dev` reads `MONGO_URI` from `.env`. That value points at the MongoDB running on the Azure VM, database `fixxer`. The database is not exposed on the public IP. This Mac reaches it through an SSH tunnel on port `27018`.

Writes from your laptop, including creates, updates, and seed scripts, change the live database.

## 1. Confirm MongoDB on the VM

SSH in:

```bash
ssh -i ~/Downloads/Busigrow-Fixxer_key.pem azureuser@135.222.40.140
```

On the VM:

```bash
ss -ltn | grep 27017
```

Expected:

```text
LISTEN 0      4096       127.0.0.1:27017      0.0.0.0:*
```

If that line is missing, from `/opt/busigrow`:

```bash
docker compose up -d mongo
ss -ltn | grep 27017
```

Leave the containers running. Disconnect from this SSH session with `exit` when you are done checking.

## 2. Open the tunnel on your Mac

In a terminal on your Mac, run this and leave the window open. A blank terminal after a few seconds means the tunnel is up. Ctrl-C closes it.

```bash
ssh -i ~/Downloads/Busigrow-Fixxer_key.pem -N -L 27018:127.0.0.1:27017 azureuser@135.222.40.140
```

## 3. Point the local backend at that tunnel

From the backend repo:

```bash
cd /Users/misanthropic/codebase/fixer-backend
cp .env.example .env
```

`.env.example` already sets:

```text
MONGO_URI=mongodb://127.0.0.1:27018/fixxer
```

If `.env` already exists, set that line and do not replace the rest of the file. Fill `JWT_SECRET` before you run with `NODE_ENV=production`. Development can start without it.

## 4. Start the API

The tunnel terminal must still be open.

```bash
npm install
npm run start:dev
```

The API listens on port `3000` unless `PORT` is set. Check it against the deployed data:

```bash
curl -sS http://127.0.0.1:3000/api/v1/services
```

The same URI works in MongoDB Compass while the tunnel is open: `mongodb://127.0.0.1:27018/fixxer`.

## 5. Each later session

1. Start the tunnel command from step 2 and leave it open.
2. In another terminal, `npm run start:dev`.

The server on the VM keeps using `mongodb://mongo:27017/fixxer` inside Docker. Do not change that URI to `127.0.0.1:27018`.
