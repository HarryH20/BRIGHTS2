workers = 2
threads = 2
bind = "0.0.0.0:5000"
timeout = 120

# Replace the default "gunicorn" Server header to reduce version fingerprinting
server_software = "server"
