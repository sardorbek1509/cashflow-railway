// PM2 Ecosystem Config
// Usage: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'cashflow-game',
      script: './server/server.js',
      instances: 1,            // Use 'max' for cluster mode (note: socket.io needs sticky sessions for multi-instance)
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
