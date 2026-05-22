module.exports = {
  apps: [
    {
      name: "edtech-backend",
      script: "./src/server.js",
      interpreter: "node",
      node_args: "--experimental-vm-modules",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env_production: {
        NODE_ENV: "production",
        PORT: 8787,
      },
      // Reinicia se usar mais de 400 MB (proteção para t2.micro com 1 GB RAM)
      max_memory_restart: "400M",
      // Reinicia automaticamente em caso de crash
      restart_delay: 3000,
      max_restarts: 10,
      // Logs
      out_file: "/var/log/edtech/backend-out.log",
      error_file: "/var/log/edtech/backend-error.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
