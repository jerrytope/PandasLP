#!/usr/bin/env bash
# Pandas LP: set up the app on a new AWS EC2 server, or update it. Run it again any time to
# deploy the latest code from GitHub; it only asks questions the first time.
#
#   curl -fsSL https://raw.githubusercontent.com/jerrytope/PandasLP/master/scripts/deploy/setup-server.sh -o setup.sh && sudo bash setup.sh
#
# Options:
#   --domain example.com --email you@example.com   serve on the domain with HTTPS (Let's Encrypt)
#   --reconfigure                                  ask the questions again (current answers are the defaults)
#   --skip-db                                      don't touch the database
#   --branch name                                  deploy another branch (default master)
#
# What it does: installs Node 22, nginx and the Postgres client; adds swap on small servers;
# clones the code to /opt/pandaslp/app; asks for the keys once and keeps them in
# /etc/pandaslp/pandaslp.env (readable by root and the app only); runs each database file in
# scripts/deploy/migrations.txt once against the Supabase database; builds the app; runs it as a
# systemd service behind nginx on port 80; and adds the two scheduled jobs.
# Works on Ubuntu/Debian and Amazon Linux.

set -euo pipefail

REPO="https://github.com/jerrytope/PandasLP.git"
BRANCH="master"
APP_USER="pandaslp"
BASE_DIR="/opt/pandaslp"
APP_DIR="$BASE_DIR/app"
ENV_DIR="/etc/pandaslp"
ENV_FILE="$ENV_DIR/pandaslp.env"
DB_FILE="$ENV_DIR/db.env"
LOG_DIR="/var/log/pandaslp"
PORT=3000
DOMAIN=""
CERT_EMAIL=""
RECONFIGURE=0
SKIP_DB=0

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
warn() { printf '\033[33m  ! %s\033[0m\n' "$*"; }
die() { printf '\033[31m\nERROR: %s\033[0m\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --email) CERT_EMAIL="${2:-}"; shift 2 ;;
    --reconfigure) RECONFIGURE=1; shift ;;
    --skip-db) SKIP_DB=1; shift ;;
    --branch) BRANCH="${2:-}"; shift 2 ;;
    *) die "Unknown option: $1" ;;
  esac
done

[ "$(id -u)" -eq 0 ] || die "Run it with sudo:  sudo bash setup.sh"
[ -z "$DOMAIN" ] || [ -n "$CERT_EMAIL" ] || die "--domain needs --email too (Let's Encrypt sends certificate notices there)."
# A domain given once is remembered, so a plain update keeps serving it over HTTPS.
DOMAIN_FILE="$ENV_DIR/domain.env"
if [ -z "$DOMAIN" ] && [ -f "$DOMAIN_FILE" ]; then
  DOMAIN="$(sed -n 's/^DOMAIN=//p' "$DOMAIN_FILE")"
  CERT_EMAIL="$(sed -n 's/^CERT_EMAIL=//p' "$DOMAIN_FILE")"
fi
[ -r /dev/tty ] || die "This script asks questions; run it from an interactive terminal (ssh), not a pipe."

# ---------------------------------------------------------------- the operating system
. /etc/os-release
case "${ID:-}:${ID_LIKE:-}" in
  ubuntu:*|debian:*|*:*debian*) PKG=apt ;;
  amzn:*|rhel:*|fedora:*|centos:*|*:*rhel*|*:*fedora*) PKG=dnf ;;
  *) die "Unsupported system: ${PRETTY_NAME:-unknown}. Use Ubuntu or Amazon Linux." ;;
esac

bold "1/9  Installing system packages (${PRETTY_NAME:-$ID})"
if [ "$PKG" = apt ]; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq git curl ca-certificates openssl nginx postgresql-client build-essential cron >/dev/null
else
  dnf install -y -q git curl ca-certificates openssl nginx gcc-c++ make cronie >/dev/null
  dnf install -y -q postgresql16 >/dev/null 2>&1 || dnf install -y -q postgresql15 >/dev/null 2>&1 || dnf install -y -q postgresql >/dev/null
  systemctl enable --now crond >/dev/null
fi
info "Done."

# ---------------------------------------------------------------- swap (the build needs memory)
bold "2/9  Memory"
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$MEM_MB" -lt 3500 ] && ! swapon --show | grep -q .; then
  SWAP_GB=$([ "$MEM_MB" -lt 1500 ] && echo 4 || echo 2)
  fallocate -l "${SWAP_GB}G" /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=$((SWAP_GB * 1024)) status=none
  chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  info "${MEM_MB} MB of RAM: added ${SWAP_GB} GB of swap so the build doesn't run out of memory."
else
  info "${MEM_MB} MB of RAM, swap: $(swapon --show --noheadings | awk '{print $3}' | head -1 || true). Fine."
fi

# ---------------------------------------------------------------- Node.js 22
bold "3/9  Node.js"
NODE_MAJOR=$(node -v 2>/dev/null | sed 's/^v\([0-9]*\).*/\1/' || echo 0)
if [ "${NODE_MAJOR:-0}" -lt 20 ]; then
  if [ "$PKG" = apt ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
    apt-get install -y -qq nodejs >/dev/null
  else
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - >/dev/null
    dnf install -y -q nodejs >/dev/null
  fi
fi
info "Node $(node -v), npm $(npm -v)."

# ---------------------------------------------------------------- the code
bold "4/9  Getting the code ($BRANCH)"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "$BASE_DIR" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$BASE_DIR" "$LOG_DIR" "$BASE_DIR/models"
chown "$APP_USER:$APP_USER" "$BASE_DIR" "$LOG_DIR" "$BASE_DIR/models"
as_app() { sudo -u "$APP_USER" -H "$@"; }
if [ -d "$APP_DIR/.git" ]; then
  as_app git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  # The server's copy is never edited by hand, so it is set to exactly what is on GitHub.
  as_app git -C "$APP_DIR" checkout --quiet "$BRANCH"
  as_app git -C "$APP_DIR" reset --quiet --hard "origin/$BRANCH"
else
  as_app git clone --quiet --branch "$BRANCH" "$REPO" "$APP_DIR"
fi
info "At commit $(as_app git -C "$APP_DIR" log -1 --format='%h %s')."

# ---------------------------------------------------------------- settings and keys
bold "5/9  Settings and keys"
mkdir -p "$ENV_DIR"
chmod 750 "$ENV_DIR"
chgrp "$APP_USER" "$ENV_DIR"

declare -A V=()
if [ -f "$ENV_FILE" ]; then
  while IFS= read -r line; do
    case "$line" in ''|\#*) continue ;; esac
    V["${line%%=*}"]="${line#*=}"
  done < "$ENV_FILE"
fi

# ask NAME "question" [secret|plain] [required|optional] [default]
ask() {
  local name="$1" question="$2" kind="${3:-plain}" need="${4:-optional}" def="${5:-}" cur answer shown
  cur="${V[$name]:-$def}"
  while true; do
    if [ "$kind" = secret ]; then
      shown=$([ -n "$cur" ] && echo "[keep current: ${cur:0:6}…]" || echo "")
      read -r -s -p "  $question $shown: " answer < /dev/tty; echo > /dev/tty
    else
      read -r -p "  $question${cur:+ [$cur]}: " answer < /dev/tty
    fi
    answer="${answer:-$cur}"
    if [ -z "$answer" ] && [ "$need" = required ]; then warn "This one is required."; continue; fi
    V[$name]="$answer"
    return
  done
}
gen() { [ -n "${V[$1]:-}" ] || V[$1]="$(openssl rand -hex "${2:-32}")"; }

public_ip() {
  local token
  token=$(curl -fsS -m 3 -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' 2>/dev/null || true)
  curl -fsS -m 3 ${token:+-H "X-aws-ec2-metadata-token: $token"} http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "13.63.170.64"
}

if [ -n "$DOMAIN" ]; then
  V[NEXT_PUBLIC_SITE_URL]="https://$DOMAIN"
elif [ -z "${V[NEXT_PUBLIC_SITE_URL]:-}" ]; then
  V[NEXT_PUBLIC_SITE_URL]="http://$(public_ip)"
fi

if [ ! -f "$ENV_FILE" ] || [ "$RECONFIGURE" -eq 1 ]; then
  echo
  info "Paste each value and press Enter. Hidden ones don't show while you paste."
  info "Press Enter on an optional one to skip it (you can add it later with --reconfigure)."
  echo
  info "From Supabase → your project → Project Settings → API:"
  ask NEXT_PUBLIC_SUPABASE_URL "Project URL (https://xxxx.supabase.co)" plain required
  ask NEXT_PUBLIC_SUPABASE_ANON_KEY "anon / publishable key" secret required
  ask SUPABASE_SERVICE_ROLE_KEY "service_role / secret key" secret required
  echo
  ask ANTHROPIC_API_KEY "Anthropic API key (sk-ant-…)" secret required
  ask ADMIN_EMAILS "Admin emails, comma-separated" plain required "ayoadetemitope552@gmail.com"
  ask AI_MANAGER_EMAILS "/manageai emails, comma-separated" plain required "${V[ADMIN_EMAILS]:-ayoadetemitope552@gmail.com}"
  ask NEXT_PUBLIC_SITE_URL "The address people open the app at" plain required
  echo
  info "Optional:"
  ask GMAIL_APP_PASSWORD "Gmail App Password for pandaslegalpractitioners@gmail.com (the app's emails)" secret
  ask NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY "Paystack public key (pk_…)" plain
  ask PAYSTACK_SECRET_KEY "Paystack secret key (sk_…)" secret
  ask NEXT_PUBLIC_CALENDLY_URL "Calendly booking link" plain
  ask NEXT_PUBLIC_GA_MEASUREMENT_ID "Google Analytics ID (G-…)" plain
  ask GOOGLE_REVIEW_URL "Google review link" plain
  ask TAVILY_API_KEY "Tavily API key (property agent web search)" secret
  ask NEXT_PUBLIC_PROPERTY_AGENT_V2 "Use the rebuilt Property Law Agent? true/false (keep false until the lawyer signs off)" plain required "false"
  ask GOOGLE_OAUTH_CLIENT_ID "Google OAuth client ID (brand sheets; needs a domain with HTTPS)" plain
  ask GOOGLE_OAUTH_CLIENT_SECRET "Google OAuth client secret" secret
  ask GOOGLE_BRANDS_ROOT_FOLDER_ID "Google Drive brands folder ID" plain
  ask GOOGLE_SHEET_TEMPLATE_ID "Google brand template sheet ID" plain
fi
V[GMAIL_APP_PASSWORD]="${V[GMAIL_APP_PASSWORD]:-}"; V[GMAIL_APP_PASSWORD]="${V[GMAIL_APP_PASSWORD]// /}"
gen CRON_SECRET 32
gen UNSUBSCRIBE_SECRET 32
gen GOOGLE_TOKEN_ENCRYPTION_KEY 32
gen PLUGIN_API_KEY 24
V[APP_ENV]="production"
V[TRANSFORMERS_CACHE_DIR]="$BASE_DIR/models"

umask 027
{
  echo "# Pandas LP settings. Written by scripts/deploy/setup-server.sh; change with: sudo bash setup.sh --reconfigure"
  for k in $(printf '%s\n' "${!V[@]}" | sort); do
    [ -n "${V[$k]}" ] && printf '%s=%s\n' "$k" "${V[$k]}"
  done
} > "$ENV_FILE.new"
mv "$ENV_FILE.new" "$ENV_FILE"
chown root:"$APP_USER" "$ENV_FILE"
chmod 640 "$ENV_FILE"
umask 022
# Next.js reads it at build time (NEXT_PUBLIC_* values are built into the pages) and at start.
ln -sf "$ENV_FILE" "$APP_DIR/.env.production.local"
info "Saved in $ENV_FILE."
[ -n "${V[PAYSTACK_SECRET_KEY]:-}" ] || warn "No Paystack keys: clients can't pay until you add them (sudo bash setup.sh --reconfigure)."
[ -n "${V[GMAIL_APP_PASSWORD]:-}" ] || warn "No Gmail App Password: the app's own emails (follow-ups, alerts) won't send."

# ---------------------------------------------------------------- the database
bold "6/9  Database"
if [ "$SKIP_DB" -eq 1 ]; then
  info "Skipped (--skip-db)."
else
  DB_URL=""
  [ -f "$DB_FILE" ] && DB_URL="$(sed -n 's/^SUPABASE_DB_URL=//p' "$DB_FILE")"
  while true; do
    if [ -z "$DB_URL" ]; then
      info "Supabase → your project → Connect (top bar) → \"Session pooler\" → copy the URI and put your database password in it."
      info "(Use the Session pooler, not \"Direct connection\": the direct one needs IPv6, which EC2 doesn't have by default.)"
      info "If the database password has symbols such as @ # / ?, reset it in Supabase to letters and numbers only, or the string won't work."
      read -r -s -p "  Database connection string (postgresql://…): " DB_URL < /dev/tty; echo > /dev/tty
    fi
    if psql "$DB_URL" -tAc 'select 1' >/dev/null 2>&1; then break; fi
    warn "Could not connect with that connection string. Check the password and that it is the Session pooler URI."
    DB_URL=""
  done
  umask 077; printf 'SUPABASE_DB_URL=%s\n' "$DB_URL" > "$DB_FILE"; umask 022
  info "Connected. (Connection string kept in $DB_FILE, root only.)"

  psql "$DB_URL" -q -v ON_ERROR_STOP=1 -c "create schema if not exists deploy; create table if not exists deploy.migrations (name text primary key, applied_at timestamptz not null default now()); revoke all on schema deploy from public;" >/dev/null
  APPLIED_COUNT=$(psql "$DB_URL" -tAc "select count(*) from deploy.migrations")
  HAS_CASES=$(psql "$DB_URL" -tAc "select to_regclass('public.cases') is not null")
  if [ "$APPLIED_COUNT" = 0 ] && [ "$HAS_CASES" = t ]; then
    die "This database already has the app's tables, but they weren't set up by this script. To protect existing data nothing was run. Use a new Supabase project, or run again with --skip-db."
  fi

  while IFS= read -r file; do
    case "$file" in ''|\#*) continue ;; esac
    file="${file%$'\r'}"
    done_already=$(psql "$DB_URL" -tAc "select 1 from deploy.migrations where name = '$file'")
    [ "$done_already" = 1 ] && continue
    [ -f "$APP_DIR/$file" ] || die "Missing database file in the code: $file"
    info "Running $file …"
    # One transaction per file: a file that fails changes nothing.
    psql "$DB_URL" -q -X -1 -v ON_ERROR_STOP=1 -f "$APP_DIR/$file" >/dev/null 2>"$LOG_DIR/db-last-error.log" \
      || die "$file failed. Details: $LOG_DIR/db-last-error.log. Nothing from that file was applied; fix it and run the script again."
    psql "$DB_URL" -q -c "insert into deploy.migrations (name) values ('$file')" >/dev/null
  done < "$APP_DIR/scripts/deploy/migrations.txt"
  info "Database up to date ($(psql "$DB_URL" -tAc 'select count(*) from deploy.migrations') files applied)."
fi

# ---------------------------------------------------------------- build
bold "7/9  Building the app (a few minutes; longer on a small server)"
systemctl stop pandaslp 2>/dev/null || true
BUILD_MEM=$([ "$MEM_MB" -lt 3500 ] && echo 1536 || echo 3072)
as_app bash -c "cd '$APP_DIR' && npm ci --no-audit --no-fund --loglevel=error && NODE_OPTIONS=--max-old-space-size=$BUILD_MEM npx next build" > "$LOG_DIR/build.log" 2>&1 \
  || { tail -30 "$LOG_DIR/build.log"; die "The build failed. Full log: $LOG_DIR/build.log"; }
info "Built."

# ---------------------------------------------------------------- run it
bold "8/9  Starting the app and the web server"
cat > /etc/systemd/system/pandaslp.service <<EOF
[Unit]
Description=Pandas LP (Next.js)
After=network-online.target
Wants=network-online.target

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
Environment=NODE_ENV=production
ExecStart=$APP_DIR/node_modules/.bin/next start -p $PORT -H 127.0.0.1
Restart=always
RestartSec=5
StandardOutput=append:$LOG_DIR/app.log
StandardError=append:$LOG_DIR/app.log

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now pandaslp >/dev/null 2>&1
systemctl restart pandaslp

SERVER_NAME="${DOMAIN:-_}"
cat > /etc/nginx/conf.d/pandaslp.conf <<EOF
# Pandas LP. Written by scripts/deploy/setup-server.sh.
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name $SERVER_NAME;

    # Uploads: court approvals (3 MB base64) and the brand API (5 MB).
    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        # The brand sync routes may run for up to 300 seconds.
        proxy_read_timeout 310s;
        proxy_send_timeout 310s;
    }
}
EOF
# Ubuntu's own default site also claims port 80.
rm -f /etc/nginx/sites-enabled/default
nginx -t >/dev/null 2>&1 || { nginx -t; die "The nginx settings are invalid."; }
systemctl enable --now nginx >/dev/null 2>&1
systemctl reload nginx

if [ -n "$DOMAIN" ]; then
  info "Getting an HTTPS certificate for $DOMAIN …"
  if ! command -v certbot >/dev/null; then
    if [ "$PKG" = apt ]; then
      apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
    else
      dnf install -y -q certbot python3-certbot-nginx >/dev/null 2>&1 || {
        dnf install -y -q python3-pip >/dev/null && pip3 install --quiet certbot certbot-nginx
      }
    fi
  fi
  # --reinstall: on an update the certificate already exists; put it back into the fresh nginx settings.
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$CERT_EMAIL" --redirect --reinstall \
    || die "The certificate failed. Check that $DOMAIN points to this server's IP and that port 443 is open in the AWS security group, then run the script again."
  printf 'DOMAIN=%s\nCERT_EMAIL=%s\n' "$DOMAIN" "$CERT_EMAIL" > "$DOMAIN_FILE"
  # Renewal: certbot's own timer where the package has one, otherwise this daily check.
  systemctl list-timers 2>/dev/null | grep -q certbot \
    || echo '17 3 * * * root certbot renew --quiet --deploy-hook "systemctl reload nginx"' > /etc/cron.d/pandaslp-certbot
fi

info "Waiting for the app to answer …"
for i in $(seq 1 60); do
  curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 2
  [ "$i" -eq 60 ] && { tail -30 "$LOG_DIR/app.log"; die "The app didn't start. Log: $LOG_DIR/app.log"; }
done
info "The app is running."

# ---------------------------------------------------------------- scheduled jobs
bold "9/9  Scheduled jobs"
cat > "$BASE_DIR/run-job.sh" <<EOF
#!/usr/bin/env bash
# Calls one of the app's scheduled jobs (scripts/run-scheduled-job.mjs). Run by /etc/cron.d/pandaslp.
export CRON_SECRET="\$(sed -n 's/^CRON_SECRET=//p' $ENV_FILE)"
export SITE_URL="http://127.0.0.1:$PORT"
exec node $APP_DIR/scripts/run-scheduled-job.mjs "\$1"
EOF
chmod 755 "$BASE_DIR/run-job.sh"
cat > /etc/cron.d/pandaslp <<EOF
# Pandas LP scheduled jobs (times are UTC). Written by scripts/deploy/setup-server.sh.
0 7 * * *    $APP_USER $BASE_DIR/run-job.sh follow-ups   >> $LOG_DIR/jobs.log 2>&1
*/15 * * * * $APP_USER $BASE_DIR/run-job.sh brand-sheets >> $LOG_DIR/jobs.log 2>&1
EOF
chmod 644 /etc/cron.d/pandaslp
info "Follow-ups daily at 07:00 UTC, brand sheets every 15 minutes."

SITE="$(sed -n 's/^NEXT_PUBLIC_SITE_URL=//p' "$ENV_FILE")"
bold "Done. Pandas LP is live at $SITE"
cat <<EOF

  If it doesn't open in your browser: AWS console → EC2 → this instance → Security → the
  security group → Edit inbound rules → allow HTTP (port 80) from anywhere$( [ -n "$DOMAIN" ] && echo ' and HTTPS (443)').

  In Supabase (once per project), so sign-in links work:
    Authentication → URL Configuration
      Site URL:       $SITE
      Redirect URLs:  $SITE/auth/callback
    Authentication → Emails → SMTP settings: turn on custom SMTP (for example Gmail with an
      App Password). Supabase's built-in email only sends a few sign-in emails an hour.

  Logs:      $LOG_DIR/app.log, build.log, jobs.log
  Restart:   sudo systemctl restart pandaslp
  Update:    sudo bash setup.sh            (latest code from GitHub, any new database files, rebuild)
  Domain:    sudo bash setup.sh --domain yourdomain.com --email you@example.com
  Settings:  sudo bash setup.sh --reconfigure
EOF
