#!/usr/bin/env bash
# One-time bootstrap for a fresh Ubuntu 24.04 EC2 instance (arm64 t4g or x86 t3).
# Usage:  sudo DOMAIN=example.com EMAIL=you@example.com \
#              BACKEND_REPO=git@github.com:you/fixer-backend.git \
#              FRONTEND_REPO=git@github.com:you/fixer-frontend.git \
#              bash setup-ec2.sh
set -euo pipefail
: "${DOMAIN:?set DOMAIN}"; : "${EMAIL:?set EMAIL}"
: "${BACKEND_REPO:?set BACKEND_REPO}"; : "${FRONTEND_REPO:?set FRONTEND_REPO}"
APP_USER=${SUDO_USER:-ubuntu}

echo "==> System packages"
apt-get update -y && apt-get upgrade -y
apt-get install -y ca-certificates curl git nginx ufw unzip

echo "==> 4 GB swap (a 2 GB box needs it for next build / nest build)"
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
sysctl -w vm.swappiness=10

echo "==> Kernel setting required by Elasticsearch"
echo 'vm.max_map_count=262144' > /etc/sysctl.d/99-elasticsearch.conf
echo 'vm.swappiness=10' >> /etc/sysctl.d/99-elasticsearch.conf
sysctl --system

echo "==> Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker "$APP_USER"
fi

echo "==> Node 20 + PM2"
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm i -g pm2

echo "==> Directories"
mkdir -p /opt/fixxer/data/{mongo,es} /opt/fixxer/backups /var/log/fixxer
chown -R 1000:0 /opt/fixxer/data/es          # ES container runs as uid 1000
chown -R "$APP_USER":"$APP_USER" /opt/fixxer /var/log/fixxer
chown -R 1000:0 /opt/fixxer/data/es

echo "==> Clone repos (add this box's deploy key to GitHub first)"
sudo -u "$APP_USER" bash -c "
  cd /opt/fixxer
  [ -d fixer-backend ]  || git clone '$BACKEND_REPO'  fixer-backend
  [ -d fixer-frontend ] || git clone '$FRONTEND_REPO' fixer-frontend
"

echo "==> Firewall (also keep the AWS security group to 22/80/443)"
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable

echo "==> Nginx"
sed "s/example.com/$DOMAIN/g" /opt/fixxer/fixer-backend/deploy/nginx/fixxer.conf > /etc/nginx/sites-available/fixxer
ln -sf /etc/nginx/sites-available/fixxer /etc/nginx/sites-enabled/fixxer
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> TLS (DNS A record for $DOMAIN must already point at this Elastic IP)"
snap install --classic certbot || true
ln -sf /snap/bin/certbot /usr/bin/certbot
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" -m "$EMAIL" --agree-tos --non-interactive --redirect || \
  echo "!! certbot failed — fix DNS and rerun: certbot --nginx -d $DOMAIN -d www.$DOMAIN"

echo "==> PM2 on boot"
sudo -u "$APP_USER" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" | tail -1 | bash || true

cat <<MSG

Bootstrap done. Next:
  1. Log out/in (docker group), then create:
       /opt/fixxer/fixer-backend/.env           (from deploy/env.backend.production.example)
       /opt/fixxer/fixer-frontend/.env.production (from deploy/env.frontend.production.example)
  2. Deploy:  bash /opt/fixxer/fixer-backend/deploy/deploy.sh
  3. Seed:    ADMIN_PHONE=... ADMIN_PASSWORD=... bash /opt/fixxer/fixer-backend/deploy/seed-fresh.sh
MSG
