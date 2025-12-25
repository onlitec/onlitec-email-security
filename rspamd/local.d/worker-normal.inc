# Rspamd Normal Worker Configuration

# Bind to all interfaces
bind_socket = "*:11333";

# Milter protocol
milter = yes;

# Task timeout
task_timeout = 8s;

# Max tasks
max_tasks = 0;

# Upstream configuration
upstream "local" {
  default = yes;
  hosts = "localhost";
}
