#!/bin/bash

# 🚀 Hostinger KVM 2 VPS Deployment Script for Envato Reverse Proxy
# Run this script on your Hostinger Ubuntu VPS

set -e

echo "=========================================="
echo "🚀 Hostinger VPS Deployment Script"
echo "Envato Reverse Proxy Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root (use sudo)"
   exit 1
fi

# Check Ubuntu version
if ! command -v lsb_release &> /dev/null; then
    apt update && apt install -y lsb-release
fi

UBUNTU_VERSION=$(lsb_release -rs)
print_status "Detected Ubuntu version: $UBUNTU_VERSION"

if [[ ${UBUNTU_VERSION%%.*} -lt 20 ]]; then
    print_error "Ubuntu 20.04 or higher is required"
    exit 1
fi

# Update system
print_status "Updating system packages..."
apt update && apt upgrade -y

# Install essential packages
print_status "Installing essential packages..."
apt install -y \
    curl \
    wget \
    git \
    nano \
    ufw \
    fail2ban \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release

# Install Node.js 18.x LTS
print_status "Installing Node.js 18.x LTS..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Verify Node.js installation
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
print_status "Node.js installed: $NODE_VERSION"
print_status "NPM installed: $NPM_VERSION"

# Install PM2 globally
print_status "Installing PM2 globally..."
npm install -g pm2

# Install Nginx
print_status "Installing Nginx..."
apt install -y nginx

# Install Certbot for SSL
print_status "Installing Certbot..."
apt install -y certbot python3-certbot-nginx

# Create application directory
print_status "Creating application directory..."
mkdir -p /opt/envato-proxy
cd /opt/envato-proxy

# Check if files exist
if [ ! -f "package.json" ]; then
    print_warning "package.json not found!"
    print_status "Please upload all application files to /opt/envato-proxy/"
    print_status "Files needed: package.json, server.js, public/ directory"
    
    # Create basic structure if files don't exist
    print_status "Creating basic structure..."
    
    # Create package.json
    cat > package.json << 'EOF'
{
  "name": "envato-reverse-proxy",
  "version": "1.0.0",
  "description": "Envato Elements reverse proxy with auto-login",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "deploy": "pm2 restart ecosystem.config.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "http-proxy-middleware": "^2.0.6",
    "express-session": "^1.17.3",
    "body-parser": "^1.20.2",
    "cookie-parser": "^1.4.6",
    "puppeteer": "^21.0.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
EOF

    print_warning "Basic package.json created. Please upload your actual application files."
fi

# Install dependencies if package.json exists
if [ -f "package.json" ]; then
    print_status "Installing Node.js dependencies..."
    npm install
else
    print_error "No package.json found. Cannot install dependencies."
    exit 1
fi

# Install Puppeteer dependencies
print_status "Installing Puppeteer system dependencies..."
apt install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo-gobject2 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils

# Create environment file
print_status "Creating environment configuration..."
if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
# Environment Configuration for Envato Reverse Proxy
# Hostinger VPS Configuration

# Server Configuration
NODE_ENV=production
PORT=3000

# Session Secret (Change this!)
SESSION_SECRET=your-very-secure-session-secret-key-change-this-in-production

# Custom Login Credentials (Change these!)
CUSTOM_USERNAME=admin
CUSTOM_PASSWORD=your-secure-password-here

# Envato Auto-Login Credentials
ENVATO_EMAIL=kolikavi09@gmail.com
ENVATO_PASSWORD=JEf5w$!-D$nrJGR

# Domain Configuration
DOMAIN=your-domain.com

# Security Settings
SECURE_COOKIES=true
COOKIE_MAX_AGE=86400000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF
    print_warning ".env file created. Please update the values!"
fi

# Set proper permissions
print_status "Setting file permissions..."
chown -R www-data:www-data /opt/envato-proxy
chmod -R 755 /opt/envato-proxy

# Create PM2 ecosystem file
print_status "Creating PM2 ecosystem configuration..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'envato-proxy',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF

# Create systemd service
print_status "Creating systemd service..."
cat > /etc/systemd/system/envato-proxy.service << 'EOF'
[Unit]
Description=Envato Reverse Proxy
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/envato-proxy
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=envato-proxy
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

# Configure Nginx
print_status "Configuring Nginx..."
cat > /etc/nginx/sites-available/envato-proxy << 'EOF'
server {
    listen 80;
    server_name _;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Rate limiting
    limit_req zone=login burst=5 nodelay;
    limit_req_status 429;
    
    # Proxy settings
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}

# Rate limiting zone
limit_req_zone $binary_remote_addr zone=login:10m rate=10r/m;
EOF

# Enable Nginx site
print_status "Enabling Nginx site..."
ln -sf /etc/nginx/sites-available/envato-proxy /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
print_status "Testing Nginx configuration..."
nginx -t

# Setup firewall
print_status "Configuring firewall..."
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp

# Configure fail2ban
print_status "Configuring fail2ban..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
action = iptables-multiport[name=NoAuthFailures, port="http,https"]
logpath = /var/log/nginx/error.log
maxretry = 3

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
action = iptables-multiport[name=ReqLimit, port="http,https"]
logpath = /var/log/nginx/error.log
maxretry = 3
EOF

# Start and enable services
print_status "Starting services..."
systemctl daemon-reload
systemctl enable envato-proxy
systemctl enable nginx
systemctl enable fail2ban

# Start Nginx
systemctl restart nginx
systemctl restart fail2ban

# Start application with PM2
print_status "Starting application with PM2..."
cd /opt/envato-proxy
pm2 start ecosystem.config.js --env production
pm2 save

# Setup PM2 startup
pm2 startup systemd -u root --hp /root

# Create backup script
print_status "Creating backup script..."
cat > /opt/envato-proxy/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups"
APP_DIR="/opt/envato-proxy"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup
tar -czf $BACKUP_DIR/envato-proxy-$DATE.tar.gz -C $(dirname $APP_DIR) $(basename $APP_DIR)

# Keep only last 7 days of backups
find $BACKUP_DIR -name "envato-proxy-*.tar.gz" -mtime +7 -delete

echo "Backup completed: envato-proxy-$DATE.tar.gz"
EOF

chmod +x /opt/envato-proxy/backup.sh

# Add backup to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/envato-proxy/backup.sh") | crontab -

# Create health check script
print_status "Creating health check script..."
cat > /opt/envato-proxy/health-check.sh << 'EOF'
#!/bin/bash
# Health check script for Envato proxy

APP_URL="http://localhost:3000"
LOG_FILE="/var/log/envato-proxy-health.log"

# Check if the application is responding
if curl -f -s "$APP_URL" > /dev/null; then
    echo "$(date): Application is healthy" >> $LOG_FILE
else
    echo "$(date): Application is down - restarting..." >> $LOG_FILE
    pm2 restart envato-proxy
fi
EOF

chmod +x /opt/envato-proxy/health-check.sh

# Add health check to crontab (every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/envato-proxy/health-check.sh") | crontab -

# Display completion message
echo ""
echo "=========================================="
echo "🎉 Deployment Complete!"
echo "=========================================="
echo ""
echo "✅ Next steps:"
echo "1. Update .env file: sudo nano /opt/envato-proxy/.env"
echo "2. Update Nginx config: sudo nano /etc/nginx/sites-available/envato-proxy"
echo "3. Set up SSL: sudo certbot --nginx -d your-domain.com"
echo "4. Check status: pm2 status"
echo ""
echo "📍 Application location: /opt/envato-proxy/"
echo "📊 PM2 logs: pm2 logs envato-proxy"
echo "🔄 Backup location: /opt/backups/"
echo "🌐 Access: http://your-vps-ip"
echo ""
echo "🔧 Useful commands:"
echo "  pm2 restart envato-proxy"
echo "  pm2 logs envato-proxy --lines 50"
echo "  sudo systemctl status nginx"
echo "  sudo ufw status"
echo ""
echo "⚠️  IMPORTANT: Update .env file with your domain and secure credentials!"