from django.contrib import admin
from .models import Asset, AuditLog, UserSession

@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = ("asset_code", "name", "category", "department", "status", "location")
    search_fields = ("asset_code", "tag", "name", "serial_number", "department")
    list_filter = ("status", "category", "department")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = (
        "timestamp",
        "action",
        "user_name",
        "user_id",
        "role",
        "device_type",
        "os",
        "browser",
        "client_ip",
        "entity_id",
    )
    search_fields = ("user_name", "user_id", "entity_id", "client_ip", "session_id")
    list_filter = ("action", "device_type", "role")
    readonly_fields = [f.name for f in AuditLog._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(UserSession)
class UserSessionAdmin(admin.ModelAdmin):
    list_display = (
        "session_id",
        "user_name",
        "user_id",
        "role",
        "is_active",
        "login_timestamp",
        "logout_timestamp",
        "device_type",
        "client_ip",
    )
    list_filter = ("is_active", "device_type", "role")
    readonly_fields = [f.name for f in UserSession._meta.fields]
