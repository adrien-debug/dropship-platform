# Audit Infrastructure Dropship Platform

**Date**: 2026-04-08  
**GPU2**: 100.110.74.114 (user: comput3)  
**Railway**: dropship-backend-backup  
**Cloudflare Tunnel**: a635771b-c3ac-4945-bbf2-113d59fe0b90

---

## 1. État GPU2

### Ressources Système
- **Uptime**: 8 jours, 22h
- **Load Average**: 9.25, 6.95, 6.21 (élevé, mais acceptable pour un serveur avec GPU)
- **RAM**: 13 GiB utilisés / 251 GiB (5% utilisation) ✅
- **Disque**: 171 GB utilisés / 1.8 TB (11% utilisation) ✅
- **Swap**: 0 B utilisés / 8 GiB ✅

### Processus Node.js Actifs
| Process | Port | Status | Uptime |
|---------|------|--------|--------|
| next-server (three-pieces) | 3102 | ✅ Running | Depuis Apr 5 |
| next-server (one-piece-vault-four) | 3115 | ✅ Running | Depuis Apr 5 |
| next-server (admin) | 3200 | ✅ Running | Depuis Apr 7 |
| openclaw-dropship API | 3849 | ✅ Running | Depuis Apr 7 |
| medusa backend | 9000 | ✅ Running | Depuis Apr 5 |

**⚠️ PROBLÈME**: Port 3100 (shop.hearst.app) n'a aucun processus actif → 502 Bad Gateway

### Conteneurs Docker
| Conteneur | Image | Status | Uptime | CPU | RAM |
|-----------|-------|--------|--------|-----|-----|
| openclaw-dropship | - | ✅ Healthy | 20h | 0.65% | 66 MB |
| dropship-medusa | dropship-medusa:v1 | ✅ Running | 3 days | 0.03% | 347 MB |
| medusa-postgres | postgres:17-alpine | ✅ Running | 3 days | 0.00% | 51 MB |
| medusa-redis | redis:7-alpine | ✅ Running | 3 days | 1.38% | 4.9 MB |
| coolify | - | ✅ Healthy | 27h | 48.50% | 395 MB |
| coolify-proxy | - | ✅ Healthy | 3 days | 3.99% | 26 MB |
| coolify-db | postgres:15-alpine | ✅ Healthy | 3 days | 3.61% | 107 MB |
| coolify-redis | redis:7-alpine | ✅ Healthy | 3 days | 3.18% | 7.2 MB |
| gpu2-vllm-embeddings | - | ✅ Running | 3 days | 1.62% | 1.7 GB |
| gpu2-vllm-coding | - | ✅ Running | 27h | 1.70% | 2.7 GB |
| gpu2-vllm-fast | - | ✅ Running | 3 days | 1.62% | 2.2 GB |

**✅ Restart Policies**: Tous les conteneurs critiques ont `unless-stopped`

### Sites Déployés
| Site | Taille | Status |
|------|--------|--------|
| three-pieces | 613 MB | ✅ Running (port 3102) |
| one-piece-vault-four | 615 MB | ✅ Running (port 3115) |
| gamerpro | 112 KB | ⚠️ Pas de node_modules |
| glowshop | 2.7 MB | ⚠️ Pas de node_modules |
| shop-anime | 112 KB | ⚠️ Pas de node_modules |
| sportzone | 2.7 MB | ⚠️ Pas de node_modules |

**⚠️ PROBLÈME**: 4 sites n'ont pas de node_modules installés (gamerpro, glowshop, shop-anime, sportzone)

### Ports Ouverts
- **54 ports en écoute** (mix de services locaux et Docker)
- Ports publics: 22 (SSH), 80 (HTTP), 443 (HTTPS), 8080, 9000, 9090
- Ports Next.js: 3102, 3115, 3200
- Port API: 3849

---

## 2. Cloudflare Tunnel

### Configuration
```yaml
tunnel: a635771b-c3ac-4945-bbf2-113d59fe0b90
ingress:
  - hostname: api.hearst.app → http://localhost:3849
  - hostname: admin.hearst.app → http://localhost:3200
  - hostname: medusa.hearst.app → http://localhost:9000
  - hostname: shop.hearst.app → http://localhost:3100 ❌ (port inactif)
```

### Status Service
- **Service**: cloudflared.service
- **Status**: ✅ Active (running)
- **Uptime**: Depuis Apr 7 01:44:41
- **Restart Policy**: `on-failure` avec RestartSec=5s
- **Auto-start**: ✅ Enabled
- **Connections**: 4 tunnels actifs (dxb01, nrt15, nrt16)

**⚠️ LOGS**: Plusieurs erreurs de connexion avant stabilisation:
```
ERR failed to run the datagram handler error="context canceled"
ERR failed to serve tunnel connection error="control stream encountered a failure"
```
Mais le tunnel est maintenant stable avec 4 connexions enregistrées.

### Tests URLs Publiques
| URL | HTTP Status | Latence | SSL | Problème |
|-----|-------------|---------|-----|----------|
| https://admin.hearst.app | 307 (redirect /login) | 702ms | ✅ Valid | ✅ OK |
| https://medusa.hearst.app | 404 | 795ms | ✅ Valid | ⚠️ Pas de route `/` |
| https://api.hearst.app | 404 | 109ms | ✅ Valid | ⚠️ Pas de route `/` |
| https://shop.hearst.app | 502 Bad Gateway | - | ✅ Valid | ❌ Port 3100 inactif |

### Certificats SSL
- **Émetteur**: Google Trust Services (WE1)
- **Validité**: 18 mars 2026 → 16 juin 2026 ✅
- **Domaine**: hearst.app (wildcard)
- **Renouvellement**: Automatique via Cloudflare

### Health Checks
| Service | Endpoint | Status |
|---------|----------|--------|
| Admin | http://localhost:3200 | ✅ 307 redirect |
| Medusa | http://localhost:9000/health | ✅ "OK" |
| API | http://localhost:3849/health | ✅ JSON {"status":"ok"} |

---

## 3. Railway

### Configuration
- **Projet**: dropship-backend-backup
- **Environment**: production
- **Service**: openclaw-dropship
- **Status**: ✅ Running
- **URL Publique**: openclaw-dropship-production.up.railway.app

### Build Config (`railway.json`)
```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npm run build --filter=@dropship/admin"
  },
  "deploy": {
    "startCommand": "npm run start --filter=@dropship/admin",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**⚠️ PROBLÈME**: Le build command cible `@dropship/admin` mais le service Railway déploie `openclaw-dropship` (API backend)

### Variables d'Environnement
```
CJ_API_KEY: CJ5297664@api@c0cfed2116704b3da956b525654dca9c
MEDUSA_API_KEY: sk_359a57f8dbf9d0b437abb5232f7f576627ca25fa31e4a770883eef0a4236aae7
MEDUSA_URL: http://100.110.74.114:9000
RAILWAY_PUBLIC_DOMAIN: openclaw-dropship-production.up.railway.app
```

### Logs Récents
```
Starting Container
[openclaw-dropship] Server running on port 8080
[openclaw-dropship] Health: http://localhost:8080/health
```

### Test Health Check
```bash
curl https://openclaw-dropship-production.up.railway.app/health
# {"status":"degraded","checks":{"medusa":"down","cj":"up","supabase":"up"}}
```

**⚠️ PROBLÈME**: Railway ne peut pas joindre Medusa (http://100.110.74.114:9000) → "medusa":"down"

### Deployment cd8d2156
- **Status**: Aucun log disponible pour ce deployment ID
- **Hypothèse**: Build bloqué ou deployment ID invalide

---

## 4. Scripts de Déploiement

### `deploy-storefront.sh`
- ✅ Utilise Docker avec image `onepeace-storefront:v5`
- ✅ Vérifie si le port est déjà utilisé
- ✅ Restart policy: `unless-stopped`
- ⚠️ **PROBLÈME**: L'image `onepeace-storefront:v5` n'existe pas sur GPU2
  ```bash
  docker images | grep onepeace
  # Aucun résultat
  ```

### `setup-golden-template.sh`
- ❌ **MANQUANT**: Le golden template n'existe pas sur GPU2
  ```bash
  ls /home/comput3/golden-template
  # Golden template not found
  ```

### `prewarm-slots.sh`
- ❌ **MANQUANT**: Aucun slot pré-warmé
  ```bash
  ls /home/comput3/slots
  # Slots directory not found
  ```

**⚠️ IMPACT**: Impossible de déployer rapidement de nouveaux sites avec les scripts actuels

---

## 5. Base de Données

### Medusa PostgreSQL
- **Conteneur**: medusa-postgres (postgres:17-alpine)
- **Status**: ✅ Running (3 days)
- **RAM**: 51 MB
- **Tables**: 100+ tables Medusa
- **Produits**: 4 produits en DB
- **Connexion**: ✅ Accessible depuis GPU2

### Redis
- **Conteneur**: medusa-redis (redis:7-alpine)
- **Status**: ✅ Running (3 days)
- **RAM**: 4.9 MB
- **Auth**: ⚠️ NOAUTH (authentification requise mais pas configurée)

### Backups
- ❌ **MANQUANT**: Aucun répertoire de backup trouvé
- ❌ **MANQUANT**: Aucun cron de backup DB
- ⚠️ **RISQUE CRITIQUE**: Aucune sauvegarde automatique

---

## 6. Sécurité

### Firewall
```bash
sudo ufw status
# Status: inactive
```
❌ **CRITIQUE**: Firewall désactivé → tous les ports sont exposés

### Clés SSH
- ✅ Permissions correctes: `-rw------- authorized_keys`
- ✅ 1 seule clé autorisée

### Secrets
- ✅ Secrets dans variables d'environnement (pas de .env committé)
- ⚠️ Secrets exposés dans `/home/comput3/openclaw-dropship/start.sh` (world-readable)
- ⚠️ Redis sans authentification

### Permissions Fichiers
- ✅ Sites: `comput3:comput3` avec permissions standard
- ✅ Cloudflared credentials: `-r--------` (root only)

---

## 7. Résilience

### Auto-Restart
| Service | Restart Policy | Status |
|---------|----------------|--------|
| cloudflared | on-failure (5s delay) | ✅ Enabled |
| dropship-medusa | unless-stopped | ✅ Enabled |
| openclaw-dropship | unless-stopped | ✅ Enabled |
| medusa-postgres | unless-stopped | ✅ Enabled |
| medusa-redis | unless-stopped | ✅ Enabled |

### Crontab
```bash
@reboot /home/comput3/openclaw-dropship/start.sh >> /home/comput3/openclaw-dropship/server.log 2>&1 &
```
✅ openclaw-dropship démarre au boot

### Processus Zombies
- ⚠️ **19 processus zombies** (defunct) détectés
- Principalement des processus Node.js

---

## 8. Bugs Trouvés

### Critiques (P0)
1. ❌ **shop.hearst.app en 502**: Port 3100 n'a aucun processus actif
2. ❌ **Firewall désactivé**: Tous les ports exposés publiquement
3. ❌ **Aucun backup DB**: Risque de perte de données
4. ❌ **Golden template manquant**: Scripts de déploiement inutilisables
5. ❌ **Image Docker manquante**: `onepeace-storefront:v5` introuvable

### Importants (P1)
6. ⚠️ **Railway ne peut pas joindre Medusa**: Health check "degraded"
7. ⚠️ **Redis sans auth**: NOAUTH error
8. ⚠️ **Secrets exposés**: start.sh lisible par tous
9. ⚠️ **19 processus zombies**: Fuite de ressources
10. ⚠️ **4 sites sans node_modules**: Déploiements incomplets

### Mineurs (P2)
11. ⚠️ **Cloudflare Tunnel logs**: Erreurs de connexion intermittentes
12. ⚠️ **Admin logs**: JSON parsing errors dans `/tmp/admin.log`
13. ⚠️ **Medusa logs**: 404 sur `/metrics` (monitoring)
14. ⚠️ **Load average élevé**: 9.25 (mais acceptable)

---

## 9. Recommandations

### Immédiates (24h)
1. **Déployer shop.hearst.app sur port 3100**
   ```bash
   ssh comput3@100.110.74.114 "cd ~/sites/shop && PORT=3100 nohup npx next start -p 3100 > /tmp/shop.log 2>&1 &"
   ```

2. **Activer le firewall**
   ```bash
   sudo ufw default deny incoming
   sudo ufw default allow outgoing
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

3. **Setup backups DB**
   ```bash
   # Créer script backup
   cat > /home/comput3/backup-db.sh <<'EOF'
   #!/bin/bash
   DATE=$(date +%Y%m%d_%H%M%S)
   docker exec medusa-postgres pg_dump -U medusa medusa | gzip > /home/comput3/backups/medusa_$DATE.sql.gz
   find /home/comput3/backups -name "medusa_*.sql.gz" -mtime +7 -delete
   EOF
   chmod +x /home/comput3/backup-db.sh
   
   # Ajouter au crontab
   crontab -e
   # 0 2 * * * /home/comput3/backup-db.sh
   ```

4. **Sécuriser Redis**
   ```bash
   # Ajouter auth dans docker-compose
   REDIS_PASSWORD=$(openssl rand -base64 32)
   # Redémarrer avec --requirepass
   ```

### Court terme (1 semaine)
5. **Créer golden template**
   ```bash
   bash scripts/setup-golden-template.sh
   bash scripts/prewarm-slots.sh 5
   ```

6. **Builder image Docker storefront**
   ```bash
   cd apps/storefront
   docker build -t onepeace-storefront:v5 .
   ```

7. **Nettoyer processus zombies**
   ```bash
   # Identifier parents et restart services
   ps aux | grep defunct
   ```

8. **Sécuriser start.sh**
   ```bash
   chmod 700 /home/comput3/openclaw-dropship/start.sh
   # Migrer secrets vers .env
   ```

### Moyen terme (1 mois)
9. **Setup monitoring**
   - Prometheus + Grafana pour métriques
   - Alertes sur CPU/RAM/Disk
   - Uptime monitoring pour URLs publiques

10. **Optimiser Railway**
    - Corriger `railway.json` (build vs deploy mismatch)
    - Exposer Medusa via Cloudflare Tunnel pour Railway
    - Setup CI/CD avec GitHub Actions

11. **Documentation**
    - Runbook pour incidents
    - Procédures de déploiement
    - Architecture diagram

---

## 10. Métriques de Performance

### Latences
| Endpoint | Latence Moyenne | Status |
|----------|-----------------|--------|
| admin.hearst.app | 702ms | ⚠️ Lent |
| medusa.hearst.app | 795ms | ⚠️ Lent |
| api.hearst.app | 109ms | ✅ Rapide |

**Recommandation**: Ajouter cache Redis pour admin et medusa

### Utilisation Ressources
- **CPU**: Load average élevé (9.25) mais pas de bottleneck
- **RAM**: 5% utilisés → excellente marge
- **Disque**: 11% utilisés → excellente marge
- **Network**: Cloudflare Tunnel stable après warm-up

---

## Conclusion

### Points Forts ✅
- Infrastructure GPU2 stable (8 jours uptime)
- Cloudflare Tunnel opérationnel avec SSL valide
- Conteneurs Docker avec restart policies
- RAM et disque largement disponibles
- Medusa et API backend fonctionnels

### Points Critiques ❌
- shop.hearst.app en 502 (port 3100 inactif)
- Firewall désactivé
- Aucun backup automatique
- Scripts de déploiement non fonctionnels
- Secrets exposés

### Score Global: 6/10
- **Disponibilité**: 7/10 (3/4 URLs fonctionnelles)
- **Sécurité**: 3/10 (firewall off, secrets exposés)
- **Résilience**: 7/10 (auto-restart OK, mais pas de backups)
- **Performance**: 6/10 (latences élevées)
- **Maintenabilité**: 5/10 (scripts cassés, docs manquantes)

**Prochaine étape**: Appliquer les recommandations immédiates (24h) pour passer à 8/10.
