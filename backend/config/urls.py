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
]
