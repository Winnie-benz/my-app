module.exports = {
  apps: [
    {
      name:         'owndays-server',
      cwd:          './server',
      script:       'npm',
      args:         'run start',
      watch:        false,
      autorestart:  true,
      restart_delay: 3000,
      max_restarts: 10,
      env_production: {
        NODE_ENV: 'production',
        PORT:     3001,
      },
    },
  ],
}
