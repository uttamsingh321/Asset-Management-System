from django.urls import path
from . import views

urlpatterns = [
    # ════════════════════════════════════════════════════════════════════════════
    # COMPANY
    # ════════════════════════════════════════════════════════════════════════════
    path('companies/', views.api_companies, name='api-companies'),
    path('companies/<int:pk>/', views.api_company_detail, name='api-company-detail'),

    # ════════════════════════════════════════════════════════════════════════════
    # PLANT
    # ════════════════════════════════════════════════════════════════════════════
    path('plants/', views.api_plants, name='api-plants'),
    path('plants/<int:pk>/', views.api_plant_detail, name='api-plant-detail'),

    # ════════════════════════════════════════════════════════════════════════════
    # BUILDING
    # ════════════════════════════════════════════════════════════════════════════
    path('buildings/', views.api_buildings, name='api-buildings'),
    path('buildings/<int:pk>/', views.api_building_detail, name='api-building-detail'),

    # ════════════════════════════════════════════════════════════════════════════
    # FLOOR
    # ════════════════════════════════════════════════════════════════════════════
    path('floors/', views.api_floors, name='api-floors'),
    path('floors/<int:pk>/', views.api_floor_detail, name='api-floor-detail'),

    # ════════════════════════════════════════════════════════════════════════════
    # DEPARTMENT
    # ════════════════════════════════════════════════════════════════════════════
    path('departments/', views.api_departments, name='api-departments'),
    path('departments/<int:pk>/', views.api_department_detail, name='api-department-detail'),

    # ════════════════════════════════════════════════════════════════════════════
    # AREA
    # ════════════════════════════════════════════════════════════════════════════
    path('areas/', views.api_areas, name='api-areas'),
    path('areas/<int:pk>/', views.api_area_detail, name='api-area-detail'),

    # ════════════════════════════════════════════════════════════════════════════
    # ASSET LOCATION
    # ════════════════════════════════════════════════════════════════════════════
    path('locations/', views.api_locations, name='api-locations'),
    path('locations/<int:pk>/', views.api_location_detail, name='api-location-detail'),

    # ════════════════════════════════════════════════════════════════════════════
    # HIERARCHY TREE & DASHBOARD
    # ════════════════════════════════════════════════════════════════════════════
    path('hierarchy/tree/', views.api_hierarchy_tree, name='api-hierarchy-tree'),
    path('dashboard/', views.api_master_mapping_dashboard, name='api-master-mapping-dashboard'),
    path('audit/logs/', views.api_hierarchy_audit_logs, name='api-hierarchy-audit-logs'),

    # ════════════════════════════════════════════════════════════════════════════
    # RBAC - ROLES
    # ════════════════════════════════════════════════════════════════════════════
    path('rbac/roles/', views.api_roles, name='api-rbac-roles'),
    path('rbac/roles/<int:pk>/', views.api_role_detail, name='api-rbac-role-detail'),

    # ════════════════════════════════════════════════════════════════════════════
    # RBAC - PERMISSIONS
    # ════════════════════════════════════════════════════════════════════════════
    path('rbac/permissions/', views.api_permissions, name='api-rbac-permissions'),
    path('rbac/permissions/<int:pk>/', views.api_permission_detail, name='api-rbac-permission-detail'),

    # ════════════════════════════════════════════════════════════════════════════
    # RBAC - ROLE PERMISSION MAPPING
    # ════════════════════════════════════════════════════════════════════════════
    path('rbac/roles/<int:role_id>/permissions/', views.api_role_permissions, name='api-rbac-role-permissions'),

    # ════════════════════════════════════════════════════════════════════════════
    # RBAC - USER ROLES
    # ════════════════════════════════════════════════════════════════════════════
    path('rbac/user-roles/', views.api_user_roles, name='api-rbac-user-roles'),
    path('rbac/user-roles/<int:pk>/', views.api_user_role_detail, name='api-rbac-user-role-detail'),

    # ════════════════════════════════════════════════════════════════════════════
    # RBAC - USER HIERARCHY SCOPES
    # ════════════════════════════════════════════════════════════════════════════
    path('rbac/user-scopes/', views.api_user_scopes, name='api-rbac-user-scopes'),
    path('rbac/user-scopes/<int:pk>/', views.api_user_scope_detail, name='api-rbac-user-scope-detail'),

    # ════════════════════════════════════════════════════════════════════════════
    # RBAC - APPROVAL ASSIGNMENTS
    # ════════════════════════════════════════════════════════════════════════════
    path('rbac/approvals/', views.api_approval_assignments, name='api-rbac-approvals'),
    path('rbac/approvals/<int:pk>/', views.api_approval_assignment_detail, name='api-rbac-approval-detail'),
]