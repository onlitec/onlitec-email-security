# Rspamd proxy worker configuration
# Listens for milter connections from Postfix

bind_socket = "*:11332";
milter = yes;
timeout = 120s;
upstream "local" {
    default = yes;
    self_scan = yes;
}
