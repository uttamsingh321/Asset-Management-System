from django.db import models
from django.utils import timezone


class Company(models.Model):
    name = models.CharField(max_length=255, db_index=True)
    code = models.CharField(max_length=64, blank=True, db_index=True)
    description = models.TextField(blank=True)
    is_archived = models.BooleanField(default=False, db_index=True)
    created_by = models.CharField(max_length=128, default="Superuser")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Company"
        verbose_name_plural = "Companies"
        constraints = [
            models.UniqueConstraint(
                fields=["name"],
                condition=models.Q(is_archived=False),
                name="unique_active_company_name",
            ),
        ]

    def __str__(self):
        return self.name

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "code": self.code,
            "description": self.description,
            "isArchived": self.is_archived,
            "createdBy": self.created_by,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


class Plant(models.Model):
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="plants", db_index=True
    )
    name = models.CharField(max_length=255, db_index=True)
    code = models.CharField(max_length=64, blank=True, db_index=True)
    description = models.TextField(blank=True)
    is_archived = models.BooleanField(default=False, db_index=True)
    created_by = models.CharField(max_length=128, default="Superuser")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Plant"
        verbose_name_plural = "Plants"
        constraints = [
            models.UniqueConstraint(
                fields=["company", "name"],
                condition=models.Q(is_archived=False),
                name="unique_active_plant_name_per_company",
            ),
        ]

    def __str__(self):
        return self.company.name + " > " + self.name

    def to_dict(self):
        return {
            "id": self.id,
            "companyId": self.company_id,
            "companyName": self.company.name,
            "name": self.name,
            "code": self.code,
            "description": self.description,
            "isArchived": self.is_archived,
            "createdBy": self.created_by,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


class Building(models.Model):
    plant = models.ForeignKey(
        Plant, on_delete=models.CASCADE, related_name="buildings", db_index=True
    )
    name = models.CharField(max_length=255, db_index=True)
    code = models.CharField(max_length=64, blank=True, db_index=True)
    description = models.TextField(blank=True)
    is_archived = models.BooleanField(default=False, db_index=True)
    created_by = models.CharField(max_length=128, default="Superuser")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Building"
        verbose_name_plural = "Buildings"
        constraints = [
            models.UniqueConstraint(
                fields=["plant", "name"],
                condition=models.Q(is_archived=False),
                name="unique_active_building_name_per_plant",
            ),
        ]

    def __str__(self):
        return self.plant.name + " > " + self.name

    def to_dict(self):
        return {
            "id": self.id,
            "plantId": self.plant_id,
            "plantName": self.plant.name,
            "companyId": self.plant.company_id,
            "companyName": self.plant.company.name,
            "name": self.name,
            "code": self.code,
            "description": self.description,
            "isArchived": self.is_archived,
            "createdBy": self.created_by,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


class Floor(models.Model):
    building = models.ForeignKey(
        Building, on_delete=models.CASCADE, related_name="floors", db_index=True
    )
    name = models.CharField(max_length=255, db_index=True)
    code = models.CharField(max_length=64, blank=True, db_index=True)
    description = models.TextField(blank=True)
    is_archived = models.BooleanField(default=False, db_index=True)
    created_by = models.CharField(max_length=128, default="Superuser")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Floor"
        verbose_name_plural = "Floors"
        constraints = [
            models.UniqueConstraint(
                fields=["building", "name"],
                condition=models.Q(is_archived=False),
                name="unique_active_floor_name_per_building",
            ),
        ]

    def __str__(self):
        return self.building.name + " > " + self.name

    def to_dict(self):
        return {
            "id": self.id,
            "buildingId": self.building_id,
            "buildingName": self.building.name,
            "plantId": self.building.plant_id,
            "plantName": self.building.plant.name,
            "companyId": self.building.plant.company_id,
            "companyName": self.building.plant.company.name,
            "name": self.name,
            "code": self.code,
            "description": self.description,
            "isArchived": self.is_archived,
            "createdBy": self.created_by,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


class Department(models.Model):
    floor = models.ForeignKey(
        Floor, on_delete=models.CASCADE, related_name="departments", db_index=True
    )
    name = models.CharField(max_length=255, db_index=True)
    code = models.CharField(max_length=64, blank=True, db_index=True)
    description = models.TextField(blank=True)
    is_archived = models.BooleanField(default=False, db_index=True)
    created_by = models.CharField(max_length=128, default="Superuser")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Department"
        verbose_name_plural = "Departments"
        constraints = [
            models.UniqueConstraint(
                fields=["floor", "name"],
                condition=models.Q(is_archived=False),
                name="unique_active_department_name_per_floor",
            ),
        ]

    def __str__(self):
        return self.floor.name + " > " + self.name

    def to_dict(self):
        return {
            "id": self.id,
            "floorId": self.floor_id,
            "floorName": self.floor.name,
            "buildingId": self.floor.building_id,
            "buildingName": self.floor.building.name,
            "plantId": self.floor.building.plant_id,
            "plantName": self.floor.building.plant.name,
            "companyId": self.floor.building.plant.company_id,
            "companyName": self.floor.building.plant.company.name,
            "name": self.name,
            "code": self.code,
            "description": self.description,
            "isArchived": self.is_archived,
            "createdBy": self.created_by,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


class Area(models.Model):
    department = models.ForeignKey(
        Department, on_delete=models.CASCADE, related_name="areas", db_index=True
    )
    name = models.CharField(max_length=255, db_index=True)
    code = models.CharField(max_length=64, blank=True, db_index=True)
    description = models.TextField(blank=True)
    is_archived = models.BooleanField(default=False, db_index=True)
    created_by = models.CharField(max_length=128, default="Superuser")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Area"
        verbose_name_plural = "Areas"
        constraints = [
            models.UniqueConstraint(
                fields=["department", "name"],
                condition=models.Q(is_archived=False),
                name="unique_active_area_name_per_department",
            ),
        ]

    def __str__(self):
        return self.department.name + " > " + self.name

    def to_dict(self):
        return {
            "id": self.id,
            "departmentId": self.department_id,
            "departmentName": self.department.name,
            "floorId": self.department.floor_id,
            "floorName": self.department.floor.name,
            "buildingId": self.department.floor.building_id,
            "buildingName": self.department.floor.building.name,
            "plantId": self.department.floor.building.plant_id,
            "plantName": self.department.floor.building.plant.name,
            "companyId": self.department.floor.building.plant.company_id,
            "companyName": self.department.floor.building.plant.company.name,
            "name": self.name,
            "code": self.code,
            "description": self.description,
            "isArchived": self.is_archived,
            "createdBy": self.created_by,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


class AssetLocation(models.Model):
    area = models.ForeignKey(
        Area, on_delete=models.CASCADE, related_name="locations", db_index=True
    )
    name = models.CharField(max_length=255, db_index=True)
    code = models.CharField(max_length=64, blank=True, db_index=True)
    description = models.TextField(blank=True)
    is_archived = models.BooleanField(default=False, db_index=True)
    created_by = models.CharField(max_length=128, default="Superuser")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Asset Location"
        verbose_name_plural = "Asset Locations"
        constraints = [
            models.UniqueConstraint(
                fields=["area", "name"],
                condition=models.Q(is_archived=False),
                name="unique_active_location_name_per_area",
            ),
        ]

    def __str__(self):
        return self.area.name + " > " + self.name

    def to_dict(self):
        return {
            "id": self.id,
            "areaId": self.area_id,
            "areaName": self.area.name,
            "departmentId": self.area.department_id,
            "departmentName": self.area.department.name,
            "floorId": self.area.department.floor_id,
            "floorName": self.area.department.floor.name,
            "buildingId": self.area.department.floor.building_id,
            "buildingName": self.area.department.floor.building.name,
            "plantId": self.area.department.floor.building.plant_id,
            "plantName": self.area.department.floor.building.plant.name,
            "companyId": self.area.department.floor.building.plant.company_id,
            "companyName": self.area.department.floor.building.plant.company.name,
            "name": self.name,
            "code": self.code,
            "description": self.description,
            "isArchived": self.is_archived,
            "createdBy": self.created_by,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


class HierarchyAuditLog(models.Model):
    ACTION_CHOICES = [
        ("CREATE", "Create"),
        ("UPDATE", "Update"),
        ("ARCHIVE", "Archive"),
        ("RESTORE", "Restore"),
        ("DELETE", "Delete"),
        ("USER_CREATE", "User Create"),
        ("USER_UPDATE", "User Update"),
        ("USER_DEACTIVATE", "User Deactivate"),
        ("USER_ACTIVATE", "User Activate"),
        ("ROLE_ASSIGN", "Role Assign"),
        ("ROLE_REVOKE", "Role Revoke"),
        ("SCOPE_ASSIGN", "Scope Assign"),
        ("APPROVAL_ASSIGN", "Approval Assign"),
        ("LOGIN", "Login"),
        ("LOGIN_FAILURE", "Login Failure"),
        ("IMPORT", "Import"),
        ("EXPORT", "Export"),
    ]

    user_id = models.CharField(max_length=64, db_index=True)
    user_name = models.CharField(max_length=128)
    role = models.CharField(max_length=64)
    action = models.CharField(max_length=32, choices=ACTION_CHOICES, db_index=True)
    entity_type = models.CharField(max_length=64, db_index=True)
    entity_id = models.CharField(max_length=64, db_index=True)
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    reason = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    client_ip = models.GenericIPAddressField(null=True, blank=True)
    hostname = models.CharField(max_length=255, blank=True)
    device_type = models.CharField(max_length=32, blank=True)
    os = models.CharField(max_length=64, blank=True)
    browser = models.CharField(max_length=64, blank=True)
    user_agent = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-timestamp"]
        verbose_name = "Hierarchy Audit Log"
        verbose_name_plural = "Hierarchy Audit Logs"

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "userId": self.user_id,
            "userName": self.user_name,
            "role": self.role,
            "action": self.action,
            "entityType": self.entity_type,
            "entityId": self.entity_id,
            "oldValue": self.old_value,
            "newValue": self.new_value,
            "reason": self.reason,
            "ipAddress": self.ip_address,
            "clientIp": self.client_ip,
            "hostname": self.hostname,
            "deviceType": self.device_type,
            "os": self.os,
            "browser": self.browser,
            "userAgent": self.user_agent,
        }


class Role(models.Model):
    name = models.CharField(max_length=128, unique=True, db_index=True)
    code = models.CharField(max_length=64, unique=True, db_index=True)
    description = models.TextField(blank=True)
    is_system = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True, db_index=True)
    created_by = models.CharField(max_length=128, default="Superuser")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Role"
        verbose_name_plural = "Roles"

    def __str__(self):
        return self.name

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "code": self.code,
            "description": self.description,
            "isSystem": self.is_system,
            "isActive": self.is_active,
            "createdBy": self.created_by,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


class Permission(models.Model):
    name = models.CharField(max_length=128, db_index=True)
    code = models.CharField(max_length=64, unique=True, db_index=True)
    module = models.CharField(max_length=64, db_index=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_by = models.CharField(max_length=128, default="Superuser")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["module", "name"]
        verbose_name = "Permission"
        verbose_name_plural = "Permissions"
        constraints = [
            models.UniqueConstraint(
                fields=["module", "name"],
                name="unique_permission_per_module",
            ),
        ]

    def __str__(self):
        return self.module + " > " + self.name

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "code": self.code,
            "module": self.module,
            "description": self.description,
            "isActive": self.is_active,
            "createdBy": self.created_by,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class RolePermission(models.Model):
    role = models.ForeignKey(
        Role, on_delete=models.CASCADE, related_name="role_permissions", db_index=True
    )
    permission = models.ForeignKey(
        Permission, on_delete=models.CASCADE, related_name="role_permissions", db_index=True
    )
    granted_by = models.CharField(max_length=128, default="Superuser")
    granted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("role", "permission")]
        verbose_name = "Role Permission"
        verbose_name_plural = "Role Permissions"

    def to_dict(self):
        return {
            "id": self.id,
            "roleId": self.role_id,
            "roleName": self.role.name,
            "permissionId": self.permission_id,
            "permissionName": self.permission.name,
            "permissionCode": self.permission.code,
            "module": self.permission.module,
            "grantedBy": self.granted_by,
            "grantedAt": self.granted_at.isoformat() if self.granted_at else None,
        }


class UserRole(models.Model):
    user_id = models.CharField(max_length=64, db_index=True)
    user_name = models.CharField(max_length=128)
    email = models.EmailField(blank=True)
    role = models.ForeignKey(
        Role, on_delete=models.CASCADE, related_name="user_roles", db_index=True
    )
    is_active = models.BooleanField(default=True, db_index=True)
    assigned_by = models.CharField(max_length=128, default="Superuser")
    assigned_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["user_id"]
        verbose_name = "User Role"
        verbose_name_plural = "User Roles"
        constraints = [
            models.UniqueConstraint(
                fields=["user_id", "role"],
                condition=models.Q(is_active=True),
                name="unique_active_user_role",
            ),
        ]

    def __str__(self):
        return self.user_id + " > " + self.role.name

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "userName": self.user_name,
            "email": self.email,
            "roleId": self.role_id,
            "roleName": self.role.name,
            "roleCode": self.role.code,
            "isActive": self.is_active,
            "assignedBy": self.assigned_by,
            "assignedAt": self.assigned_at.isoformat() if self.assigned_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


class UserHierarchyScope(models.Model):
    user_id = models.CharField(max_length=64, db_index=True)
    user_name = models.CharField(max_length=128)
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="user_scopes",
        null=True, blank=True, db_index=True
    )
    plant = models.ForeignKey(
        Plant, on_delete=models.CASCADE, related_name="user_scopes",
        null=True, blank=True, db_index=True
    )
    building = models.ForeignKey(
        Building, on_delete=models.CASCADE, related_name="user_scopes",
        null=True, blank=True, db_index=True
    )
    floor = models.ForeignKey(
        Floor, on_delete=models.CASCADE, related_name="user_scopes",
        null=True, blank=True, db_index=True
    )
    department = models.ForeignKey(
        Department, on_delete=models.CASCADE, related_name="user_scopes",
        null=True, blank=True, db_index=True
    )
    area = models.ForeignKey(
        Area, on_delete=models.CASCADE, related_name="user_scopes",
        null=True, blank=True, db_index=True
    )
    is_active = models.BooleanField(default=True, db_index=True)
    assigned_by = models.CharField(max_length=128, default="Superuser")
    assigned_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["user_id"]
        verbose_name = "User Hierarchy Scope"
        verbose_name_plural = "User Hierarchy Scopes"
        constraints = [
            models.UniqueConstraint(
                fields=["user_id"],
                condition=models.Q(is_active=True),
                name="unique_active_user_scope",
            ),
        ]

    def __str__(self):
        return self.user_id + " scope"

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "userName": self.user_name,
            "companyId": self.company_id,
            "companyName": self.company.name if self.company else None,
            "plantId": self.plant_id,
            "plantName": self.plant.name if self.plant else None,
            "buildingId": self.building_id,
            "buildingName": self.building.name if self.building else None,
            "floorId": self.floor_id,
            "floorName": self.floor.name if self.floor else None,
            "departmentId": self.department_id,
            "departmentName": self.department.name if self.department else None,
            "areaId": self.area_id,
            "areaName": self.area.name if self.area else None,
            "isActive": self.is_active,
            "assignedBy": self.assigned_by,
            "assignedAt": self.assigned_at.isoformat() if self.assigned_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


class ApprovalAssignment(models.Model):
    APPROVAL_TYPE_CHOICES = [
        ("Finance", "Finance"),
        ("Asset Purchase", "Asset Purchase"),
        ("Asset Disposal", "Asset Disposal"),
        ("Asset Issue", "Asset Issue"),
        ("Asset Return", "Asset Return"),
        ("Asset Request", "Asset Request"),
        ("Plant Head", "Plant Head"),
        ("Final Approval", "Final Approval"),
    ]

    user_id = models.CharField(max_length=64, db_index=True)
    user_name = models.CharField(max_length=128)
    approval_type = models.CharField(max_length=64, choices=APPROVAL_TYPE_CHOICES, db_index=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    assigned_by = models.CharField(max_length=128, default="Superuser")
    assigned_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["user_id", "approval_type"]
        verbose_name = "Approval Assignment"
        verbose_name_plural = "Approval Assignments"
        constraints = [
            models.UniqueConstraint(
                fields=["user_id", "approval_type"],
                condition=models.Q(is_active=True),
                name="unique_active_user_approval",
            ),
        ]

    def __str__(self):
        return self.user_id + " > " + self.approval_type

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "userName": self.user_name,
            "approvalType": self.approval_type,
            "description": self.description,
            "isActive": self.is_active,
            "assignedBy": self.assigned_by,
            "assignedAt": self.assigned_at.isoformat() if self.assigned_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
