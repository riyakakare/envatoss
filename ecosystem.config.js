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
      PORT: 3000,
      SESSION_SECRET: 'dev-secret-key-change-in-production'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      SESSION_SECRET: process.env.SESSION_SECRET || 'your-production-secret-key',
      CUSTOM_USERNAME: process.env.CUSTOM_USERNAME || 'admin',
      CUSTOM_PASSWORD: process.env.CUSTOM_PASSWORD || 'secure-password',
      ENVATO_EMAIL: process.env.ENVATO_EMAIL || 'kolikavi09@gmail.com',
      ENVATO_PASSWORD: process.env.ENVATO_PASSWORD || 'JEf5w$!-D$nrJGR'
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }],

  deploy: {
    production: {
      user: 'ubuntu',
      host: 'your-vps-ip',
      ref: 'origin/main',
      repo: 'your-git-repo-url',
      path: '/opt/envato-proxy',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt update && apt install -y git nodejs npm'
    }
  }
};