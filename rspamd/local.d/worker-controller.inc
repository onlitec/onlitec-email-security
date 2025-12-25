# Rspamd Controller Worker Configuration
# Web interface and API

# Bind to all interfaces
bind_socket = "*:11334";

# Password for web interface (change in production!)
password = "$2$khzykhyzpemgr4kxz1fdbo9e4qajkmgf";  # changeme123

# Enable password for stats
enable_password = "$2$khzykhyzpemgr4kxz1fdbo9e4qajkmgf";  # changeme123

# Secure IP (admin functions)
# secure_ip = "127.0.0.1";
# secure_ip = "::1";

# Static files path
static_dir = "${WWWDIR}";
