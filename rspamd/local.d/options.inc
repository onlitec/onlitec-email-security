# Rspamd Options Configuration
# Multi-tenant email filtering

# DNS settings
dns {
    timeout = 1s;
    sockets = 16;
    retransmits = 5;
}

# Local networks (trusted)
local_addrs = "127.0.0.0/8, ::1, 172.30.0.0/16";

# Enable experimental features
enable_experimental = false;

# Hashing algorithm
hashing = "mumhash";

# Check all filters
check_all_filters = true;

# Enable monitoring
enable_stats = true;

# Variable defaults
filters = "chartable,dkim,spf,surbl,regexp,fuzzy_check";
