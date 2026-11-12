// PM2 process file — run from /opt/fixxer:  pm2 start fixer-backend/deploy/ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'fixxer-api',
      cwd: '/opt/fixxer/fixer-backend',
      script: 'dist/main.js',
      instances: 1,              // keep 1: @Cron jobs (ops queue sync) must not run twice
      exec_mode: 'fork',
      max_memory_restart: '450M',
      node_args: '--max-old-space-size=384',
      env: { NODE_ENV: 'production' }, // everything else comes from fixer-backend/.env
      out_file: '/var/log/fixxer/api.out.log',
      error_file: '/var/log/fixxer/api.err.log',
      time: true,
    },
    {
      name: 'fixxer-web',
      cwd: '/opt/fixxer/fixer-frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000 -H 127.0.0.1',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '450M',
      env: { NODE_ENV: 'production', NODE_OPTIONS: '--max-old-space-size=384' },
      out_file: '/var/log/fixxer/web.out.log',
      error_file: '/var/log/fixxer/web.err.log',
      time: true,
    },
  ],
};
