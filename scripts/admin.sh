#!/bin/bash
# Sistema de Administração - Onlitec Email Protection
# Script interativo para gerenciar tenants, domínios, usuários e configurações

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
DB_CONTAINER="onlitec_emailprotect_db"
DB_NAME="emailprotect"
DB_USER="emailprotect"

# Functions
print_header() {
    clear
    echo -e "${CYAN}"
    echo "=========================================="
    echo "   Onlitec Email Protection - Admin"
    echo "=========================================="
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Execute SQL query
execute_sql() {
    echo "$1" | docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -A 2>/dev/null
}

execute_sql_display() {
    echo "$1" | docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME
}

# Main Menu
show_main_menu() {
    print_header
    echo "Escolha uma opção:"
    echo ""
    echo "  1) Gerenciar Tenants (Clientes)"
    echo "  2) Gerenciar Domínios"
    echo "  3) Gerenciar Usuários/Emails"
    echo "  4) Configurar Relay"
    echo "  5) Configurar Políticas de Spam"
    echo "  6) Whitelist/Blacklist"
    echo "  7) Ver Quarentena"
    echo "  8) Ver Estatísticas"
    echo "  9) Gerar Chaves DKIM"
    echo "  0) Sair"
    echo ""
    read -p "Opção: " choice
    
    case $choice in
        1) manage_tenants ;;
        2) manage_domains ;;
        3) manage_users ;;
        4) configure_relay ;;
        5) manage_policies ;;
        6) manage_lists ;;
        7) view_quarantine ;;
        8) view_stats ;;
        9) generate_dkim_menu ;;
        0) exit 0 ;;
        *) print_error "Opção inválida!"; sleep 2; show_main_menu ;;
    esac
}

# Tenant Management
manage_tenants() {
    print_header
    echo "=== GERENCIAR TENANTS (CLIENTES) ==="
    echo ""
    echo "1) Listar tenants"
    echo "2) Criar novo tenant"
    echo "3) Ver detalhes de tenant"
    echo "4) Desativar tenant"
    echo "0) Voltar"
    echo ""
    read -p "Opção: " choice
    
    case $choice in
        1) list_tenants ;;
        2) create_tenant ;;
        3) view_tenant_details ;;
        4) deactivate_tenant ;;
        0) show_main_menu ;;
        *) print_error "Opção inválida!"; sleep 2; manage_tenants ;;
    esac
}

list_tenants() {
    print_header
    echo "=== LISTA DE TENANTS ==="
    echo ""
    
    execute_sql_display "
        SELECT 
            SUBSTRING(id::text, 1, 8) as id,
            name,
            slug,
            status,
            max_domains,
            TO_CHAR(created_at, 'DD/MM/YYYY') as criado_em
        FROM tenants
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC;
    "
    
    echo ""
    read -p "Pressione ENTER para continuar..."
    manage_tenants
}

create_tenant() {
    print_header
    echo "=== CRIAR NOVO TENANT ==="
    echo ""
    
    read -p "Nome do Cliente: " tenant_name
    read -p "Slug (identificador único, ex: acme-corp): " tenant_slug
    read -p "Máximo de domínios [10]: " max_domains
    max_domains=${max_domains:-10}
    
    read -p "Máximo de usuários [100]: " max_users
    max_users=${max_users:-100}
    
    echo ""
    print_info "Criando tenant..."
    
    result=$(execute_sql "
        INSERT INTO tenants (name, slug, max_domains, max_users, status)
        VALUES ('$tenant_name', '$tenant_slug', $max_domains, $max_users, 'active')
        RETURNING id;
    ")
    
    if [ $? -eq 0 ]; then
        print_success "Tenant criado com sucesso!"
        print_info "ID: $result"
        
        # Criar política padrão
        execute_sql "
            INSERT INTO spam_policies (tenant_id, name, is_default)
            VALUES ('$result', 'Política Padrão', true);
        " > /dev/null 2>&1
        
        print_success "Política padrão criada!"
    else
        print_error "Erro ao criar tenant!"
    fi
    
    echo ""
    read -p "Pressione ENTER para continuar..."
    manage_tenants
}

view_tenant_details() {
    print_header
    echo "=== DETALHES DO TENANT ==="
    echo ""
    
    list_tenants
    echo ""
    read -p "Digite o slug do tenant: " tenant_slug
    
    execute_sql_display "
        SELECT 
            'ID: ' || id as info,
            'Nome: ' || name as info2,
            'Status: ' || status as info3,
            'Domínios: ' || (SELECT COUNT(*) FROM domains WHERE tenant_id = t.id) || '/' || max_domains as info4,
            'Usuários: ' || (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) || '/' || max_users as info5,
            'Criado em: ' || TO_CHAR(created_at, 'DD/MM/YYYY HH24:MI') as info6
        FROM tenants t
        WHERE slug = '$tenant_slug'
        LIMIT 1;
    "
    
    echo ""
    echo "Domínios cadastrados:"
    execute_sql_display "
        SELECT domain, status, relay_host
        FROM domains
        WHERE tenant_id = (SELECT id FROM tenants WHERE slug = '$tenant_slug')
        ORDER BY domain;
    "
    
    echo ""
    read -p "Pressione ENTER para continuar..."
    manage_tenants
}

deactivate_tenant() {
    print_header
    echo "=== DESATIVAR TENANT ==="
    echo ""
    
    list_tenants
    echo ""
    read -p "Digite o slug do tenant para desativar: " tenant_slug
    read -p "Tem certeza? (s/N): " confirm
    
    if [ "$confirm" = "s" ] || [ "$confirm" = "S" ]; then
        execute_sql "UPDATE tenants SET status = 'suspended' WHERE slug = '$tenant_slug';"
        print_success "Tenant desativado!"
    else
        print_info "Operação cancelada."
    fi
    
    echo ""
    read -p "Pressione ENTER para continuar..."
    manage_tenants
}

# Domain Management
manage_domains() {
    print_header
    echo "=== GERENCIAR DOMÍNIOS ==="
    echo ""
    echo "1) Listar domínios"
    echo "2) Adicionar domínio"
    echo "3) Configurar relay de domínio"
    echo "4) Ver configuração de domínio"
    echo "0) Voltar"
    echo ""
    read -p "Opção: " choice
    
    case $choice in
        1) list_domains ;;
        2) add_domain ;;
        3) configure_domain_relay ;;
        4) view_domain_config ;;
        0) show_main_menu ;;
        *) print_error "Opção inválida!"; sleep 2; manage_domains ;;
    esac
}

list_domains() {
    print_header
    echo "=== LISTA DE DOMÍNIOS ==="
    echo ""
    
    execute_sql_display "
        SELECT 
            d.domain,
            t.name as tenant,
            d.status,
            COALESCE(d.relay_host, 'Sem relay') as relay,
            d.verified::text as verificado
        FROM domains d
        JOIN tenants t ON d.tenant_id = t.id
        WHERE d.deleted_at IS NULL
        ORDER BY d.domain;
    "
    
    echo ""
    read -p "Pressione ENTER para continuar..."
    manage_domains
}

add_domain() {
    print_header
    echo "=== ADICIONAR DOMÍNIO ==="
    echo ""
    
    # Listar tenants primeiro
    echo "Tenants disponíveis:"
    execute_sql_display "SELECT slug, name FROM tenants WHERE status = 'active' AND deleted_at IS NULL;"
    echo ""
    
    read -p "Slug do tenant: " tenant_slug
    read -p "Domínio (ex: cliente.com): " domain
    
    echo ""
    print_info "Adicionando domínio..."
    
    result=$(execute_sql "
        INSERT INTO domains (tenant_id, domain, status, verified)
        SELECT id, '$domain', 'active', false
        FROM tenants WHERE slug = '$tenant_slug'
        RETURNING id;
    ")
    
    if [ $? -eq 0 ]; then
        print_success "Domínio adicionado com sucesso!"
        print_info "ID: $result"
        echo ""
        print_warn "Próximos passos:"
        echo "  1. Configure o relay (opção 3 do menu domínios)"
        echo "  2. Gere as chaves DKIM (opção 9 do menu principal)"
        echo "  3. Configure o DNS do cliente"
    else
        print_error "Erro ao adicionar domínio!"
    fi
    
    echo ""
    read -p "Pressione ENTER para continuar..."
    manage_domains
}

configure_domain_relay() {
    print_header
    echo "=== CONFIGURAR RELAY DO DOMÍNIO ==="
    echo ""
    
    list_domains
    echo ""
    read -p "Digite o domínio: " domain
    
    echo ""
    echo "Configuração de relay:"
    read -p "Servidor de destino (ex: mail.cliente.com): " relay_host
    read -p "Porta [25]: " relay_port
    relay_port=${relay_port:-25}
    
    read -p "Usar TLS? (S/n): " use_tls
    if [ "$use_tls" = "n" ] || [ "$use_tls" = "N" ]; then
        use_tls="false"
    else
        use_tls="true"
    fi
    
    read -p "Precisa de autenticação SMTP? (s/N): " needs_auth
    
    if [ "$needs_auth" = "s" ] || [ "$needs_auth" = "S" ]; then
        read -p "Usuário SMTP: " smtp_user
        read -sp "Senha SMTP: " smtp_pass
        echo ""
        
        execute_sql "
            UPDATE domains
            SET relay_host = '$relay_host',
                relay_port = $relay_port,
                relay_use_tls = $use_tls,
                relay_username = '$smtp_user',
                relay_password = '$smtp_pass'
            WHERE domain = '$domain';
        "
    else
        execute_sql "
            UPDATE domains
            SET relay_host = '$relay_host',
                relay_port = $relay_port,
                relay_use_tls = $use_tls,
                relay_username = NULL,
                relay_password = NULL
            WHERE domain = '$domain';
        "
    fi
    
    if [ $? -eq 0 ]; then
        print_success "Relay configurado com sucesso!"
        echo ""
        print_info "Teste o relay com:"
        echo "  sudo ./scripts/test_email.sh teste@onlitec.com user@$domain $domain"
    else
        print_error "Erro ao configurar relay!"
    fi
    
    echo ""
    read -p "Pressione ENTER para continuar..."
    manage_domains
}

view_domain_config() {
    print_header
    echo "=== CONFIGURAÇÃO DO DOMÍNIO ==="
    echo ""
    
    read -p "Digite o domínio: " domain
    
    execute_sql_display "
        SELECT 
            'Domínio: ' || domain,
            'Tenant: ' || (SELECT name FROM tenants WHERE id = tenant_id),
            'Status: ' || status,
            'Relay Host: ' || COALESCE(relay_host, 'Não configurado'),
            'Relay Port: ' || COALESCE(relay_port::text, '-'),
            'TLS: ' || COALESCE(relay_use_tls::text, '-'),
            'SMTP Auth: ' || CASE WHEN relay_username IS NOT NULL THEN 'Sim' ELSE 'Não' END,
            'DKIM Configurado: ' || CASE WHEN dkim_public_key IS NOT NULL THEN 'Sim' ELSE 'Não' END,
            'Selector DKIM: ' || COALESCE(dkim_selector, 'default')
        FROM domains
        WHERE domain = '$domain';
    "
    
    echo ""
    read -p "Pressione ENTER para continuar..."
    manage_domains
}

# User Management
manage_users() {
    print_header
    echo "=== GERENCIAR USUÁRIOS/EMAILS ==="
    echo ""
    echo "1) Listar usuários"
    echo "2) Adicionar usuário"
    echo "3) Adicionar alias/forward"
    echo "0) Voltar"
    echo ""
    read -p "Opção: " choice
    
    case $choice in
        1) list_users ;;
        2) add_user ;;
        3) add_alias ;;
        0) show_main_menu ;;
        *) print_error "Opção inválida!"; sleep 2; manage_users ;;
    esac
}

list_users() {
    print_header
    echo "=== LISTA DE USUÁRIOS ==="
    echo ""
    
    execute_sql_display "
        SELECT 
            u.email,
            u.full_name as nome,
            t.name as tenant,
            u.role as papel,
            u.status
        FROM users u
        JOIN tenants t ON u.tenant_id = t.id
        WHERE u.deleted_at IS NULL
        ORDER BY u.email;
    "
    
    echo ""
    read -p "Pressione ENTER para continuar..."
    manage_users
}

add_user() {
    print_header
    echo "=== ADICIONAR USUÁRIO ==="
    echo ""
    
    echo "Tenants disponíveis:"
    execute_sql_display "SELECT slug, name FROM tenants WHERE status = 'active';"
    echo ""
    
    read -p "Slug do tenant: " tenant_slug
    read -p "Email: " email
    read -p "Nome completo: " fullname
    read -sp "Senha: " password
    echo ""
    
    # Hash password (simples md5 para exemplo, em produção usar bcrypt)
    password_hash=$(echo -n "$password" | md5sum | cut -d' ' -f1)
    
    execute_sql "
        INSERT INTO users (tenant_id, email, full_name, password_hash, role, status)
        SELECT id, '$email', '$fullname', '$password_hash', 'user', 'active'
        FROM tenants WHERE slug = '$tenant_slug';
    "
    
    if [ $? -eq 0 ]; then
        print_success "Usuário adicionado com sucesso!"
    else
        print_error "Erro ao adicionar usuário!"
    fi
    
    echo ""
    read -p "Pressione ENTER para continuar..."
    manage_users
}

add_alias() {
    print_header
    echo "=== ADICIONAR ALIAS/FORWARD ==="
    echo ""
    
    echo "Domínios disponíveis:"
    execute_sql_display "SELECT domain FROM domains WHERE status = 'active';"
    echo ""
    
    read -p "Domínio: " domain
    read -p "Email de origem (alias, ex: contato@$domain): " source_email
    read -p "Email de destino (pode ser múltiplos separados por vírgula): " dest_email
    
    execute_sql "
        INSERT INTO virtual_addresses (tenant_id, domain_id, email, destination, enabled)
        SELECT 
            t.id,
            d.id,
            '$source_email',
            '$dest_email',
            true
        FROM domains d
        JOIN tenants t ON d.tenant_id = t.id
        WHERE d.domain = '$domain';
    "
    
    if [ $? -eq 0 ]; then
        print_success "Alias/Forward adicionado com sucesso!"
    else
        print_error "Erro ao adicionar alias!"
    fi
    
    echo ""
    read -p "Pressione ENTER para continuar..."
    manage_users
}

# Relay Configuration
configure_relay() {
    configure_domain_relay
}

# Policy Management
manage_policies() {
    print_header
    echo "=== POLÍTICAS DE SPAM ==="
    echo ""
    
    execute_sql_display "
        SELECT 
            t.name as tenant,
            sp.name as politica,
            sp.reject_score as rejeitar,
            sp.quarantine_spam::text as quarentena,
            sp.enable_greylisting::text as greylisting
        FROM spam_policies sp
        JOIN tenants t ON sp.tenant_id = t.id;
    "
    
    echo ""
    read -p "Pressione ENTER para continuar..."
    show_main_menu
}

# Whitelist/Blacklist Management
manage_lists() {
    print_header
    echo "=== WHITELIST / BLACKLIST ==="
    echo ""
    echo "1) Ver whitelist"
    echo "2) Ver blacklist"
    echo "3) Adicionar à whitelist"
    echo "4) Adicionar à blacklist"
    echo "0) Voltar"
    echo ""
    read -p "Opção: " choice
    
    case $choice in
        1) view_whitelist ;;
        2) view_blacklist ;;
        3) add_to_whitelist ;;
        4) add_to_blacklist ;;
        0) show_main_menu ;;
        *) print_error "Opção inválida!"; sleep 2; manage_lists ;;
    esac
}

view_whitelist() {
    execute_sql_display "
        SELECT t.name as tenant, w.type as tipo, w.value as valor, w.comment as comentario
        FROM whitelist w
        JOIN tenants t ON w.tenant_id = t.id
        ORDER BY t.name, w.type;
    "
    echo ""
    read -p "Pressione ENTER para continuar..."
    manage_lists
}

view_blacklist() {
    execute_sql_display "
        SELECT t.name as tenant, b.type as tipo, b.value as valor, b.comment as comentario
        FROM blacklist b
        JOIN tenants t ON b.tenant_id = t.id
        ORDER BY t.name, b.type;
    "
    echo ""
    read -p "Pressione ENTER para continuar..."
    manage_lists
}

add_to_whitelist() {
    echo "Tenants:"
    execute_sql_display "SELECT slug, name FROM tenants WHERE status = 'active';"
    echo ""
    
    read -p "Slug do tenant: " tenant_slug
    echo "Tipo: 1) Email  2) Domínio  3) IP"
    read -p "Escolha: " type_choice
    
    case $type_choice in
        1) list_type="email" ;;
        2) list_type="domain" ;;
        3) list_type="ip" ;;
    esac
    
    read -p "Valor (ex: cliente@exemplo.com ou exemplo.com ou 192.168.1.1): " value
    read -p "Comentário (opcional): " comment
    
    execute_sql "
        INSERT INTO whitelist (tenant_id, type, value, comment)
        SELECT id, '$list_type', '$value', '$comment'
        FROM tenants WHERE slug = '$tenant_slug';
    "
    
    print_success "Adicionado à whitelist!"
    echo ""
    read -p "Pressione ENTER para continuar..."
    manage_lists
}

add_to_blacklist() {
    echo "Tenants:"
    execute_sql_display "SELECT slug, name FROM tenants WHERE status = 'active';"
    echo ""
    
    read -p "Slug do tenant: " tenant_slug
    echo "Tipo: 1) Email  2) Domínio  3) IP"
    read -p "Escolha: " type_choice
    
    case $type_choice in
        1) list_type="email" ;;
        2) list_type="domain" ;;
        3) list_type="ip" ;;
    esac
    
    read -p "Valor: " value
    read -p "Comentário (opcional): " comment
    
    execute_sql "
        INSERT INTO blacklist (tenant_id, type, value, comment)
        SELECT id, '$list_type', '$value', '$comment'
        FROM tenants WHERE slug = '$tenant_slug';
    "
    
    print_success "Adicionado à blacklist!"
    echo ""
    read -p "Pressione ENTER para continuar..."
    manage_lists
}

# Quarantine View
view_quarantine() {
    print_header
    echo "=== EMAILS EM QUARENTENA ==="
    echo ""
    
    execute_sql_display "
        SELECT 
            TO_CHAR(q.created_at, 'DD/MM/YY HH24:MI') as data,
            t.name as tenant,
            q.from_address as de,
            q.to_address as para,
            LEFT(q.subject, 40) as assunto,
            q.reason as motivo,
            q.status
        FROM quarantine q
        JOIN tenants t ON q.tenant_id = t.id
        WHERE q.status = 'quarantined'
        ORDER BY q.created_at DESC
        LIMIT 50;
    "
    
    echo ""
    read -p "Pressione ENTER para continuar..."
    show_main_menu
}

# Statistics View
view_stats() {
    print_header
    echo "=== ESTATÍSTICAS ==="
    echo ""
    
    echo "Últimos 7 dias:"
    execute_sql_display "
        SELECT 
            TO_CHAR(ds.date, 'DD/MM/YYYY') as data,
            t.name as tenant,
            ds.total_received as recebidos,
            ds.total_spam as spam,
            ds.total_virus as virus,
            ds.total_rejected as rejeitados
        FROM daily_stats ds
        JOIN tenants t ON ds.tenant_id = t.id
        WHERE ds.date >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY ds.date DESC, t.name;
    "
    
    echo ""
    read -p "Pressione ENTER para continuar..."
    show_main_menu
}

# DKIM Generation Menu
generate_dkim_menu() {
    print_header
    echo "=== GERAR CHAVES DKIM ==="
    echo ""
    
    echo "Domínios disponíveis:"
    execute_sql_display "SELECT domain FROM domains WHERE status = 'active' ORDER BY domain;"
    echo ""
    
    read -p "Digite o domínio: " domain
    read -p "Seletor [default]: " selector
    selector=${selector:-default}
    
    echo ""
    print_info "Gerando chaves DKIM para $domain..."
    
    /home/alfreire/docker/apps/onlitec-email/scripts/generate_dkim.sh "$domain" "$selector"
    
    echo ""
    read -p "Pressione ENTER para continuar..."
    show_main_menu
}

# Start
show_main_menu
