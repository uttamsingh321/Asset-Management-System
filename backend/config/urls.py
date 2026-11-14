from django.contrib import admin
from django.urls import path
from dashboard.views import (
    api_health,
    api_assets,
    api_asset_detail,
    api_metrics,
    api_audit_log,
    api_audit_logs,
    api_session_login,
    api_session_logout,
    api_audit_transfer,
    api_audit_approval,
    api_users,
    api_user_detail,
    api_user_login,
    api_security_login_audit,
    api_unlock_user,
    api_stock_count_tasks,
    api_stock_count_validate_scan,
    api_stock_count_verify,
    api_transfers,
    api_transfer_action,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', api_health, name='api-health'),
    path('api/assets/', api_assets, name='api-assets'),
    path('api/assets/<int:pk>/', api_asset_detail, name='api-asset-detail'),
    path('api/metrics/', api_metrics, name='api-metrics'),
    # Comprehensive Audit & Device Tracking endpoints
    path('api/audit/log/', api_audit_log, name='api-audit-log'),
    path('api/audit/logs/', api_audit_logs, name='api-audit-logs'),
    path('api/audit/session/login/', api_session_login, name='api-session-login'),
    path('api/audit/session/logout/', api_session_logout, name='api-session-logout'),
    path('api/audit/transfer/', api_audit_transfer, name='api-audit-transfer'),
    path('api/audit/approval/', api_audit_approval, name='api-audit-approval'),
    # Department RBAC & User Management (Superuser manual password control)
    path('api/users/', api_users, name='api-users'),
    path('api/users/<str:user_id>/', api_user_detail, name='api-user-detail'),
    path('api/users/auth/login/', api_user_login, name='api-user-login'),
    path('api/users/login/', api_user_login, name='api-user-login-alias'),
    # Superuser-Only Security & Lockout Control
    path('api/security/login-audit/', api_security_login_audit, name='api-security-login-audit'),
    path('api/security/unlock-user/<str:user_id>/', api_unlock_user, name='api-security-unlock-user'),
    # Stock Count QR Audit Workflow
    path('api/stock-count/tasks/', api_stock_count_tasks, name='api-stock-count-tasks'),
    path('api/stock-count/validate-scan/', api_stock_count_validate_scan, name='api-stock-count-validate-scan'),
    path('api/stock-count/verify/', api_stock_count_verify, name='api-stock-count-verify'),
    # Asset Transfer Approval Workflow (Sequential RBAC)
    path('api/transfers/', api_transfers, name='api-transfers'),
    path('api/transfers/<str:transfer_id>/action/', api_transfer_action, name='api-transfer-action'),
]
