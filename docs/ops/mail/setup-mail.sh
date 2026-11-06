#!/usr/bin/env bash
# Mailserver fuer lasstreffen.at auf dem Hetzner-Server (idempotent).
#
#   Postfaecher: office@ und support@lasstreffen.at (Dovecot, Maildir unter
#              /var/vmail, je 2 GB Quota). Weiteres Postfach: Name in BOXES.
#   Empfang:   Postfix auf Port 25, Zustellung per LMTP an Dovecot
#   Abruf:     IMAPS 993
#   Versand:   Submission 465/587 (Anmeldung mit dem Postfach, Absender nur die
#              eigene Adresse), weiter ueber das
#              Brevo-SMTP-Relay: Hetzner sperrt ausgehend Port 25, und Brevo
#              signiert mit dem DKIM-Schluessel der Domain (brevo1/brevo2._domainkey).
#   TLS:       Zertifikat fuer mail.lasstreffen.at holt Caddy (Site-Block im
#              Caddyfile), lt-mail-cert.timer kopiert es nach /etc/lt-mail/tls.
#
# Aufruf auf dem Server:  ssh root@157.180.42.4 'bash -s' < docs/ops/mail/setup-mail.sh
# Pakete vorher: postfix (Auswahl "No configuration"), dovecot-imapd, dovecot-lmtpd.
# Die Passwoerter erzeugt das Skript je Postfach einmal und legt sie nur auf dem
# Server ab: /root/<name>-mail-zugang.txt (0600). Sie werden nie ausgegeben.
set -euo pipefail

DOMAIN=lasstreffen.at
HOST=mail.lasstreffen.at
BOXES="office support"           # je Name ein Postfach <name>@$DOMAIN
ALIAS_TO=office@lasstreffen.at   # Ziel fuer postmaster@, abuse@, kontakt@, contact@
TLS=/etc/lt-mail/tls
CADDY_CERTS=/var/lib/docker/volumes/supabase_caddy_data/_data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/$HOST

step() { printf '\n== %s\n' "$*"; }

dpkg -s postfix dovecot-imapd dovecot-lmtpd >/dev/null 2>&1 || {
  echo "Pakete fehlen: postfix dovecot-imapd dovecot-lmtpd"; exit 1; }

# ------------------------------------------------------------------ Nutzer
step "Systemnutzer vmail"
id vmail >/dev/null 2>&1 || useradd --system --user-group --home-dir /var/vmail \
  --no-create-home --shell /usr/sbin/nologin vmail
install -d -o vmail -g vmail -m 0750 /var/vmail
VMAIL_UID=$(id -u vmail)
echo "  vmail uid=$VMAIL_UID"

# --------------------------------------------------------------------- TLS
step "TLS-Zertifikat"
install -d -m 0755 /etc/lt-mail "$TLS"
if [ ! -s "$TLS/fullchain.pem" ]; then
  # Uebergang, bis Caddy das echte Zertifikat hat (lt-mail-cert-sync tauscht es aus)
  openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=$HOST" \
    -addext "subjectAltName=DNS:$HOST" \
    -keyout "$TLS/privkey.pem" -out "$TLS/fullchain.pem" 2>/dev/null
  chmod 600 "$TLS/privkey.pem"
  echo "  selbstsigniertes Uebergangszertifikat erzeugt"
else
  echo "  vorhanden: $(openssl x509 -in "$TLS/fullchain.pem" -noout -issuer -enddate | tr '\n' ' ')"
fi

cat > /usr/local/sbin/lt-mail-cert-sync <<EOF
#!/bin/sh
# Kopiert das Caddy-Zertifikat fuer $HOST nach $TLS und laedt Postfix und
# Dovecot neu, wenn es sich geaendert hat. Aufruf: lt-mail-cert.timer.
set -eu
SRC="$CADDY_CERTS"
[ -s "\$SRC/$HOST.crt" ] && [ -s "\$SRC/$HOST.key" ] || { echo "noch kein Caddy-Zertifikat fuer $HOST"; exit 0; }
if cmp -s "\$SRC/$HOST.crt" "$TLS/fullchain.pem" && cmp -s "\$SRC/$HOST.key" "$TLS/privkey.pem"; then
  echo "Zertifikat unveraendert"; exit 0
fi
install -m 0600 "\$SRC/$HOST.key" "$TLS/privkey.pem.neu"
install -m 0644 "\$SRC/$HOST.crt" "$TLS/fullchain.pem.neu"
mv "$TLS/privkey.pem.neu" "$TLS/privkey.pem"
mv "$TLS/fullchain.pem.neu" "$TLS/fullchain.pem"
systemctl reload postfix dovecot
echo "Zertifikat uebernommen: \$(openssl x509 -in "$TLS/fullchain.pem" -noout -enddate)"
EOF
chmod 0755 /usr/local/sbin/lt-mail-cert-sync

cat > /etc/systemd/system/lt-mail-cert.service <<'EOF'
[Unit]
Description=Caddy-Zertifikat fuer mail.lasstreffen.at an Postfix/Dovecot uebergeben

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/lt-mail-cert-sync
EOF
cat > /etc/systemd/system/lt-mail-cert.timer <<'EOF'
[Unit]
Description=Taeglich das Mail-Zertifikat aus Caddy uebernehmen

[Timer]
OnCalendar=*-*-* 04:40:00
OnBootSec=5min
Persistent=true

[Install]
WantedBy=timers.target
EOF

# -------------------------------------------------------------- Postfaecher
step "Postfaecher"
for NAME in $BOXES; do
  ADDR="$NAME@$DOMAIN"
  ZUGANG="/root/$NAME-mail-zugang.txt"
  if grep -q "^$ADDR:" /etc/dovecot/users 2>/dev/null; then
    echo "  $ADDR vorhanden (Passwort unveraendert)"
    continue
  fi
  PW=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | cut -c1-28)
  HASH=$(printf '%s' "$PW" | openssl passwd -6 -stdin)
  ( umask 077
    printf '%s:{SHA512-CRYPT}%s\n' "$ADDR" "$HASH" >> /etc/dovecot/users
    cat > "$ZUGANG" <<EOF
Postfach $ADDR (angelegt $(date +%F))

Benutzername:  $ADDR
Passwort:      $PW

Empfang (IMAP):  $HOST   Port 993   SSL/TLS
Versand (SMTP):  $HOST   Port 465   SSL/TLS   (oder 587 mit STARTTLS)
                 Anmeldung mit demselben Benutzernamen und Passwort

Passwort aendern: neuen Hash mit
  printf '%s' 'NEUES-PASSWORT' | openssl passwd -6 -stdin
in /etc/dovecot/users eintragen ({SHA512-CRYPT} davor lassen), kein Neustart noetig.
EOF
  )
  unset PW HASH
  echo "  $ADDR angelegt, Zugangsdaten in $ZUGANG"
done
chown root:dovecot /etc/dovecot/users
chmod 0640 /etc/dovecot/users

# ----------------------------------------------------------------- Dovecot
step "Dovecot"
[ -e /etc/dovecot/dovecot.conf.ubuntu ] || cp -a /etc/dovecot/dovecot.conf /etc/dovecot/dovecot.conf.ubuntu
cat > /etc/dovecot/dovecot.conf <<EOF
# lasstreffen.at: virtuelle Postfaecher, IMAPS + LMTP. Erzeugt von
# docs/ops/mail/setup-mail.sh (Repo). Die conf.d-Beispiele von Ubuntu werden
# bewusst nicht eingebunden; Original: dovecot.conf.ubuntu.
dovecot_config_version = 2.4.0
dovecot_storage_version = 2.4.0
!include_try /usr/share/dovecot/protocols.d/*.protocol

listen = *
hostname = $HOST
postmaster_address = postmaster@$DOMAIN

ssl = required
ssl_server_cert_file = $TLS/fullchain.pem
ssl_server_key_file = $TLS/privkey.pem
ssl_min_protocol = TLSv1.2

mail_driver = maildir
mail_home = /var/vmail/%{user | domain}/%{user | username}
mail_path = ~/Maildir
mail_uid = vmail
mail_gid = vmail
first_valid_uid = $VMAIL_UID
last_valid_uid = $VMAIL_UID

auth_mechanisms = plain login
auth_username_format = %{user | lower}

passdb passwd-file {
  passwd_file_path = /etc/dovecot/users
}
# static: Ort und Rechte fuer alle gleich; ob es das Postfach gibt, prueft
# Dovecot dabei ueber die passdb (die Datei fuehrt nur Name und Hash).
userdb static {
  fields {
    uid = vmail
    gid = vmail
    home = /var/vmail/%{user | domain}/%{user | username}
  }
}

service imap-login {
  inet_listener imap {
    port = 0
  }
  inet_listener imaps {
    port = 993
    ssl = yes
  }
}
service lmtp {
  unix_listener /var/spool/postfix/private/dovecot-lmtp {
    mode = 0600
    user = postfix
    group = postfix
  }
}
service auth {
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
}

namespace inbox {
  inbox = yes
  separator = /
  mailbox Drafts {
    special_use = \\Drafts
    auto = subscribe
  }
  mailbox Sent {
    special_use = \\Sent
    auto = subscribe
  }
  mailbox Trash {
    special_use = \\Trash
    auto = subscribe
  }
  mailbox Junk {
    special_use = \\Junk
    auto = subscribe
  }
  mailbox Archive {
    special_use = \\Archive
    auto = subscribe
  }
}

# Die Platte des Servers ist knapp (Postgres-PANIC bei voller Platte, 2026-09):
# das Postfach darf sie nicht fuellen.
mail_plugins {
  quota = yes
}
quota "Postfach" {
  storage_size = 2G
}
protocol imap {
  mail_plugins {
    imap_quota = yes
  }
}
EOF
doveconf -n >/dev/null
echo "  Konfiguration gueltig"

# ----------------------------------------------------------------- Postfix
step "Postfix"
[ -e /etc/aliases ] || printf 'postmaster: root\n' > /etc/aliases
# Systempost an root gab es bisher nicht (kein MTA): weiter verwerfen.
grep -q '^root:' /etc/aliases || printf 'root: /dev/null\n' >> /etc/aliases

: > /etc/postfix/vmailbox
: > /etc/postfix/sender_login
for NAME in $BOXES; do
  printf '%s OK\n' "$NAME@$DOMAIN" >> /etc/postfix/vmailbox
  # jedes Postfach sendet nur unter der eigenen Adresse
  printf '%s %s\n' "$NAME@$DOMAIN" "$NAME@$DOMAIN" >> /etc/postfix/sender_login
done
cat > /etc/postfix/virtual <<EOF
postmaster@$DOMAIN $ALIAS_TO
abuse@$DOMAIN $ALIAS_TO
kontakt@$DOMAIN $ALIAS_TO
contact@$DOMAIN $ALIAS_TO
EOF

# Brevo-Relay: dieselben SMTP-Zugangsdaten, mit denen Supabase-Auth versendet.
python3 - <<'EOF'
import os, re
env = {}
for line in open("/opt/supabase/.env"):
    m = re.match(r"^(SMTP_(?:HOST|PORT|USER|PASS))=(.*)$", line.strip())
    if m:
        env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
missing = [k for k in ("SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS") if not env.get(k)]
if missing:
    raise SystemExit("fehlt in /opt/supabase/.env: " + ", ".join(missing))
fd = os.open("/etc/postfix/sasl_passwd", os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
with os.fdopen(fd, "w") as f:
    f.write("[%s]:%s %s:%s\n" % (env["SMTP_HOST"], env["SMTP_PORT"], env["SMTP_USER"], env["SMTP_PASS"]))
open("/etc/postfix/relayhost", "w").write("[%s]:%s\n" % (env["SMTP_HOST"], env["SMTP_PORT"]))
EOF
RELAY=$(cat /etc/postfix/relayhost); rm -f /etc/postfix/relayhost
chmod 0600 /etc/postfix/sasl_passwd

cat > /etc/postfix/main.cf <<EOF
# lasstreffen.at: Postfach-Domain $DOMAIN, Versand ueber Brevo. Erzeugt von
# docs/ops/mail/setup-mail.sh (Repo), Aenderungen dort nachziehen.
compatibility_level = 3.10
smtpd_banner = \$myhostname ESMTP
biff = no
append_dot_mydomain = no
readme_directory = no

myhostname = $HOST
mydomain = $DOMAIN
myorigin = \$myhostname
mydestination = \$myhostname, lasstreffen-prod, localhost.localdomain, localhost
mynetworks = 127.0.0.0/8
inet_interfaces = all
inet_protocols = ipv4
alias_maps = hash:/etc/aliases
alias_database = hash:/etc/aliases

# Postfach-Domain: nur eingetragene Adressen, alles andere 550 beim Empfang
virtual_mailbox_domains = $DOMAIN
virtual_mailbox_maps = hash:/etc/postfix/vmailbox
virtual_alias_maps = hash:/etc/postfix/virtual
virtual_transport = lmtp:unix:private/dovecot-lmtp

# TLS (Schluessel zuerst, dann Kette)
smtpd_tls_chain_files = $TLS/privkey.pem, $TLS/fullchain.pem
smtpd_tls_security_level = may
smtpd_tls_auth_only = yes
smtpd_tls_loglevel = 1
smtp_tls_CApath = /etc/ssl/certs

# Anmeldung nur auf den Submission-Ports (master.cf), geprueft von Dovecot
smtpd_sasl_type = dovecot
smtpd_sasl_path = private/auth
smtpd_sasl_auth_enable = no
smtpd_sender_login_maps = hash:/etc/postfix/sender_login

# Ausgehend: Hetzner sperrt Port 25, deshalb alles ueber das Brevo-Relay
relayhost = $RELAY
smtp_sasl_auth_enable = yes
smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd
smtp_sasl_security_options = noanonymous
smtp_sasl_tls_security_options = noanonymous
smtp_tls_security_level = encrypt

# Annahme
smtpd_helo_required = yes
disable_vrfy_command = yes
smtpd_relay_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_unauth_destination
smtpd_recipient_restrictions = reject_non_fqdn_recipient, reject_unknown_recipient_domain
smtpd_sender_restrictions = reject_non_fqdn_sender, reject_unknown_sender_domain
smtpd_client_auth_rate_limit = 20
smtpd_recipient_limit = 50
message_size_limit = 26214400
mailbox_size_limit = 0
EOF

# Tabellen erst jetzt: postmap und postalias lesen main.cf
postalias /etc/aliases
for m in vmailbox virtual sender_login sasl_passwd; do postmap "/etc/postfix/$m"; done
chmod 0600 /etc/postfix/sasl_passwd.db 2>/dev/null || true

for svc in submission submissions; do
  postconf -M "$svc/inet=$svc inet n - n - - smtpd"
  postconf -P "$svc/inet/syslog_name=postfix/$svc"
  postconf -P "$svc/inet/smtpd_sasl_auth_enable=yes"
  postconf -P "$svc/inet/smtpd_tls_security_level=encrypt"
  postconf -P "$svc/inet/smtpd_client_restrictions=permit_sasl_authenticated,reject"
  postconf -P "$svc/inet/smtpd_sender_restrictions=reject_sender_login_mismatch"
  postconf -P "$svc/inet/smtpd_relay_restrictions=permit_sasl_authenticated,reject"
done
postconf -P "submissions/inet/smtpd_tls_wrappermode=yes"
postfix check
echo "  Konfiguration gueltig, Relay $RELAY"

# ---------------------------------------------------------------- fail2ban
step "fail2ban"
if command -v fail2ban-client >/dev/null 2>&1; then
  cat > /etc/fail2ban/jail.d/lt-mail.conf <<'EOF'
# Anmeldeversuche am Postfach (IMAP und Submission)
[dovecot]
enabled = true

[postfix-sasl]
enabled = true
EOF
  if fail2ban-client -t >/dev/null 2>&1; then
    fail2ban-client reload >/dev/null && echo "  Jails dovecot + postfix-sasl aktiv"
  else
    rm -f /etc/fail2ban/jail.d/lt-mail.conf
    echo "  Konfigurationstest fehlgeschlagen, Jails nicht angelegt"
  fi
fi

# ------------------------------------------------------------------ Start
step "Dienste"
systemctl daemon-reload
systemctl enable --now lt-mail-cert.timer >/dev/null 2>&1
/usr/local/sbin/lt-mail-cert-sync 2>&1 | sed 's/^/  /' || true
systemctl enable dovecot postfix >/dev/null 2>&1
systemctl restart dovecot
systemctl restart postfix
sleep 2
systemctl is-active dovecot postfix | tr '\n' ' '; echo
ss -tlnH | awk '{print $4}' | grep -E ':(25|465|587|993|143)$' | sort -u | tr '\n' ' '; echo
for NAME in $BOXES; do
  printf '  %s -> %s\n' "$NAME@$DOMAIN" "$(doveadm user -f home "$NAME@$DOMAIN")"
done
