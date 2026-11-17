from django.db import models
from django.utils import timezone

class Asset(models.Model):
    STATUS_CHOICES = [
        ("Active", "Active"),
        ("Maintenance", "Maintenance"),
        ("Reserved", "Reserved"),
        ("Retired", "Retired"),
    ]

    CATEGORY_CHOICES = [
        ("Fixed Assets", "Fixed Assets"),
        ("Accessories", "Accessories"),
        ("Tools", "Tools"),
        ("Fixtures", "Fixtures"),
        ("Fixed Asset", "Fixed Asset"),
        ("General Equipment", "General Equipment"),
        ("IT Hardware", "IT Hardware"),
        ("Networking", "Networking"),
        ("Vehicles", "Vehicles"),
        ("Office Equipment", "Office Equipment"),
        ("Audio/Visual", "Audio/Visual"),
        ("Machinery", "Machinery"),
        ("Industrial", "Industrial"),
    ]

    # Core Identifiers
    tag = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=64, choices=CATEGORY_CHOICES, default="Fixed Assets")
    department = models.CharField(max_length=128, default="Operations")
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="Active")
    purchase_date = models.DateField(auto_now_add=True)
    purchase_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    current_value = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    assigned_to = models.CharField(max_length=128, blank=True)
    location = models.CharField(max_length=255, blank=True)

    # Basic Information
    asset_code = models.CharField(max_length=64, blank=True)
    serial_number = models.CharField(max_length=128, blank=True)
    current_category = models.CharField(max_length=128, blank=True)
    previous_category = models.CharField(max_length=128, blank=True)
    current_description = models.TextField(blank=True)
    previous_description = models.TextField(blank=True)

    # Location
    company = models.CharField(max_length=64, blank=True, default="IIPL")
    plant = models.CharField(max_length=128, blank=True)
    building = models.CharField(max_length=128, blank=True)
    floor = models.CharField(max_length=64, blank=True)
    current_location = models.CharField(max_length=255, blank=True)

    # Ownership & Personnel in Charge
    current_department = models.CharField(max_length=128, blank=True)
    submitter = models.CharField(max_length=128, blank=True)
    submitter_id = models.CharField(max_length=64, blank=True)
    submitter_department = models.CharField(max_length=128, blank=True)
    in_charge_id = models.CharField(max_length=64, blank=True)
    in_charge_name = models.CharField(max_length=128, blank=True)

    # Asset Status
    asset_condition = models.CharField(max_length=128, blank=True)
    movement_reason = models.CharField(max_length=255, blank=True)
    remarks = models.TextField(blank=True)

    # Media (Base64 data URLs)
    asset_photo = models.TextField(blank=True)
    asset_code_photo = models.TextField(blank=True)
    id_card_picture = models.TextField(blank=True)

    # QR Label Print Control & Governance
    print_count = models.IntegerField(default=0)
    first_printed_at = models.DateTimeField(null=True, blank=True)
    first_printed_by = models.CharField(max_length=128, blank=True)
    last_printed_at = models.DateTimeField(null=True, blank=True)
    last_printed_by = models.CharField(max_length=128, blank=True)
    last_printed_user_id = models.CharField(max_length=64, blank=True)

    # Metadata
    metadata_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.tag or self.asset_code} - {self.name}"

    def to_dict(self, include_photos: bool = True, reprint_map: dict = None):
        is_padget = bool(
            (self.company and any(k in self.company.lower() for k in ["padget", "9500", "5030"])) or
            (self.plant and any(k in str(self.plant).upper() for k in ["9502", "9503", "9504", "9505", "9506", "SECTOR 63"])) or
            (self.building and any(b in self.building.upper() for b in ["D197", "D198", "D199"])) or
            (self.location and any(b in self.location.upper() for b in ["D197", "D198", "D199", "PADGET"]))
        )
        resolved_company = "Padget" if is_padget else (self.company or "IIPL")
        resolved_company_code = "9500" if is_padget else "5020"
        resolved_building = self.building or ("D197" if is_padget else "C39")

        return {
            "id": str(self.id),
            "assetTag": self.tag or self.asset_code,
            "assetCode": self.asset_code or self.tag,
            "serialNumber": self.serial_number,
            "name": self.name or self.current_description,
            "category": self.category or self.current_category,
            "currentCategory": self.current_category,
            "previousCategory": self.previous_category,
            "currentDescription": self.current_description,
            "previousDescription": self.previous_description,
            "company": resolved_company,
            "companyCode": resolved_company_code,
            "plant": self.plant,
            "building": resolved_building,
            "floor": self.floor or "1st Floor",
            "currentLocation": self.current_location,
            "department": self.department or self.current_department,
            "currentDepartment": self.current_department or self.department,
            "submitter": self.submitter,
            "submitterId": self.submitter_id,
            "submitterDepartment": self.submitter_department,
            "inChargeId": self.in_charge_id,
            "inChargeName": self.in_charge_name,
            "whoInCharge": f"{self.in_charge_id} · {self.in_charge_name}" if (self.in_charge_id and self.in_charge_name) else (self.in_charge_name or self.assigned_to or self.submitter),
            "status": self.status,
            "assetCondition": self.asset_condition,
            "movementReason": self.movement_reason,
            "remarks": self.remarks,
            "assetPhoto": self.asset_photo if include_photos else "",
            "assetCodePhoto": self.asset_code_photo if include_photos else "",
            "idCardPicture": self.id_card_picture if include_photos else "",
            "date": str(self.metadata_date or self.purchase_date),
            "purchaseDate": str(self.purchase_date),
            "purchaseCost": float(self.purchase_cost),
            "currentValue": float(self.current_value),
            "assignedTo": self.assigned_to or self.submitter,
            "location": self.location or self.current_location,
            "printCount": getattr(self, "print_count", 0),
            "firstPrintedAt": self.first_printed_at.isoformat() if getattr(self, "first_printed_at", None) else None,
            "firstPrintedBy": getattr(self, "first_printed_by", ""),
            "lastPrintedAt": self.last_printed_at.isoformat() if getattr(self, "last_printed_at", None) else None,
            "lastPrintedBy": getattr(self, "last_printed_by", ""),
            "reprintStatus": self.get_reprint_status(reprint_map=reprint_map),
            "updatedAt": self.updated_at.isoformat() if self.updated_at else "",
        }

    def get_reprint_status(self, reprint_map: dict = None) -> str:
        """
        Computes the current QR print governance badge status:
        'Not Printed' | 'Printed' | 'Reprint Pending' | 'Approved' | 'Rejected'
        """
        count = getattr(self, "print_count", 0)
        if reprint_map is not None:
            status = reprint_map.get(self.asset_code) or reprint_map.get(str(self.id))
            if status:
                return status
            return "Printed" if count > 0 else "Not Printed"

        # Fast path: unprinted asset with 0 print count is always "Not Printed"
        if count == 0:
            return "Not Printed"

        # Check reprint request status for single printed asset
        try:
            req = ReprintRequest.objects.filter(
                models.Q(asset_code=self.asset_code) | models.Q(asset_id=str(self.id))
            ).order_by("-requested_at").first()
            if req:
                if req.status == "pending":
                    return "Reprint Pending"
                if req.status == "approved" and not req.is_used:
                    return "Approved"
                if req.status == "rejected":
                    return "Rejected"
        except Exception:
            pass

        return "Printed"


class AuditLogQuerySet(models.QuerySet):
    """
    Immutable QuerySet protecting audit logs from bulk updates or deletions.
    """
    def update(self, **kwargs):
        raise PermissionError("Audit logs are strictly immutable and cannot be updated.")

    def delete(self):
        raise PermissionError("Audit logs are strictly immutable and cannot be deleted.")


class AuditLogManager(models.Manager):
    def get_queryset(self):
        return AuditLogQuerySet(self.model, using=self._db)


class AuditLog(models.Model):
    """
    Comprehensive, immutable audit log for security, compliance, and device tracking.
    Captures every login, logout, asset creation, update, import, export, transfer, approval, and deletion.
    """
    ACTION_CHOICES = [
        ("LOGIN", "User Login"),
        ("LOGOUT", "User Logout"),
        ("ASSET_CREATE", "Asset Creation"),
        ("ASSET_UPDATE", "Asset Update"),
        ("ASSET_IMPORT", "Batch Asset Import"),
        ("ASSET_EXPORT", "Asset Registry Export"),
        ("ASSET_TRANSFER", "Asset Custody Transfer"),
        ("ASSET_APPROVAL", "Asset Action Approval"),
        ("ASSET_DELETE", "Asset Deletion"),
        ("USER_CREATE", "User Creation & RBAC"),
        ("USER_UPDATE", "User Update & Password Reset"),
        ("USER_DELETE", "User Deactivation"),
        ("STOCK_COUNT_START", "Stock Count Started"),
        ("STOCK_COUNT_SCAN_SUCCESS", "Stock Count QR Scan Authorized"),
        ("STOCK_COUNT_SCAN_REJECTED", "Stock Count QR Scan Rejected"),
        ("STOCK_COUNT_VERIFIED", "Stock Count Asset Verified"),
        ("STOCK_COUNT_VARIANCE", "Stock Count Variance Recorded"),
        ("STOCK_COUNT_COMPLETE", "Stock Count Completed"),
        ("TRANSFER_CREATE", "Transfer Request Created"),
        ("TRANSFER_APPROVE_LEVEL_1", "Transfer Level 1 Approved"),
        ("TRANSFER_APPROVE_LEVEL_2", "Transfer Level 2 Approved"),
        ("TRANSFER_APPROVE_LEVEL_3", "Transfer Level 3 Approved"),
        ("TRANSFER_REJECT", "Transfer Request Rejected"),
        ("TRANSFER_COMPLETE", "Transfer Request Completed"),
    ]

    DEVICE_CHOICES = [
        ("Desktop", "Desktop Workstation"),
        ("Laptop", "Laptop Computer"),
        ("Tablet", "Tablet Device"),
        ("Mobile", "Mobile Smartphone"),
    ]

    # User Identifiers
    user_id = models.CharField(max_length=128, db_index=True)
    user_name = models.CharField(max_length=255)
    role = models.CharField(max_length=64, default="Employee")

    # Session Identifiers
    session_id = models.CharField(max_length=128, db_index=True)
    login_timestamp = models.DateTimeField(null=True, blank=True)
    logout_timestamp = models.DateTimeField(null=True, blank=True)

    # Event Timing
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    # Action & Entity
    action = models.CharField(max_length=64, choices=ACTION_CHOICES, db_index=True)
    entity_type = models.CharField(max_length=64, default="Asset")
    entity_id = models.CharField(max_length=128, blank=True, db_index=True)
    details = models.JSONField(default=dict, blank=True)

    # Network & Device Tracking Telemetry
    client_ip = models.CharField(max_length=64)
    hostname = models.CharField(max_length=255, blank=True)
    device_type = models.CharField(max_length=32, choices=DEVICE_CHOICES)
    os = models.CharField(max_length=64)
    browser = models.CharField(max_length=64)
    user_agent = models.TextField(blank=True)

    objects = AuditLogManager()

    class Meta:
        ordering = ["-timestamp"]
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"
        indexes = [
            models.Index(fields=["action", "timestamp"]),
            models.Index(fields=["user_id", "timestamp"]),
            models.Index(fields=["device_type", "timestamp"]),
            models.Index(fields=["session_id"]),
        ]

    def save(self, *args, **kwargs):
        """
        Enforce immutability: Once created, an audit log can never be modified.
        """
        if self.pk is not None:
            raise PermissionError("Audit logs are strictly immutable and cannot be updated.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """
        Enforce immutability: Audit logs cannot be deleted for compliance.
        """
        raise PermissionError("Audit logs are strictly immutable and cannot be deleted.")

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "userName": self.user_name,
            "role": self.role,
            "sessionId": self.session_id,
            "action": self.action,
            "entityType": self.entity_type,
            "entityId": self.entity_id,
            "details": self.details,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "loginTimestamp": self.login_timestamp.isoformat() if self.login_timestamp else None,
            "logoutTimestamp": self.logout_timestamp.isoformat() if self.logout_timestamp else None,
            "clientIp": self.client_ip,
            "hostname": self.hostname,
            "deviceType": self.device_type,
            "os": self.os,
            "browser": self.browser,
            "userAgent": self.user_agent,
        }


class UserSession(models.Model):
    """
    Maintains authenticated sessions with device telemetry and login/logout lifecycle.
    """
    session_id = models.CharField(max_length=128, primary_key=True)
    user_id = models.CharField(max_length=128, db_index=True)
    user_name = models.CharField(max_length=255)
    role = models.CharField(max_length=64, default="Employee")

    login_timestamp = models.DateTimeField(auto_now_add=True)
    logout_timestamp = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    client_ip = models.CharField(max_length=64)
    hostname = models.CharField(max_length=255, blank=True)
    device_type = models.CharField(max_length=32)
    os = models.CharField(max_length=64)
    browser = models.CharField(max_length=64)
    user_agent = models.TextField(blank=True)

    class Meta:
        ordering = ["-login_timestamp"]

    def to_dict(self):
        return {
            "sessionId": self.session_id,
            "userId": self.user_id,
            "userName": self.user_name,
            "role": self.role,
            "loginTimestamp": self.login_timestamp.isoformat() if self.login_timestamp else None,
            "logoutTimestamp": self.logout_timestamp.isoformat() if self.logout_timestamp else None,
            "isActive": self.is_active,
            "clientIp": self.client_ip,
            "hostname": self.hostname,
            "deviceType": self.device_type,
            "os": self.os,
            "browser": self.browser,
        }


class AppUser(models.Model):
    """
    Department-based Role-Based Access Control (RBAC) User model.
    Superuser sets passwords manually upon user creation (no random passwords generated)
    so credentials can be handed directly to department staff.
    """
    DEPARTMENT_CHOICES = [
        ("IT", "IT & Systems"),
        ("Production", "Production & SMT"),
        ("Maintenance", "Maintenance & Calibration"),
        ("Store", "Warehouse & Store"),
        ("Finance", "Finance & Accounts"),
        ("Quality", "Quality & Audit"),
        ("Operations", "Operations & Facilities"),
        ("Administration", "Administration & HR"),
    ]

    ROLE_CHOICES = [
        ("Admin", "Superuser / Administrator"),
        ("Plant Manager", "Plant Manager"),
        ("Maintenance", "Maintenance Specialist"),
        ("Store", "Store / Warehouse Keeper"),
        ("Auditor", "Internal Auditor"),
        ("Viewer", "Viewer (Read Only)"),
        ("Employee", "Department Employee"),
    ]

    user_id = models.CharField(max_length=64, unique=True, db_index=True)
    name = models.CharField(max_length=128)
    email = models.EmailField(blank=True)
    department = models.CharField(max_length=64, default="IT")
    role = models.CharField(max_length=64, default="Employee")
    password = models.CharField(max_length=128)
    is_superuser = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    failed_login_attempts = models.IntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    lockout_reason = models.CharField(max_length=255, blank=True)
    created_by = models.CharField(max_length=128, default="Superuser")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["department", "name"]
        verbose_name = "App User"
        verbose_name_plural = "App Users"

    def __str__(self):
        return f"{self.user_id} - {self.name} ({self.department} · {self.role})"

    def to_dict(self, include_password=False):
        data = {
            "id": self.id,
            "userId": self.user_id,
            "name": self.name,
            "email": self.email,
            "department": self.department,
            "role": self.role,
            "isSuperuser": self.is_superuser,
            "isActive": self.is_active,
            "failedLoginAttempts": self.failed_login_attempts,
            "lockedUntil": self.locked_until.isoformat() if self.locked_until else None,
            "isLocked": bool(self.locked_until and self.locked_until > timezone.now()),
            "lockoutReason": self.lockout_reason,
            "createdBy": self.created_by,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
        if include_password:
            data["password"] = self.password
        return data


class ReprintRequest(models.Model):
    """
    Enterprise QR Print Control Workflow:
    Normal users must submit a request with mandatory reason for duplicate printing.
    HOD reviews and approves/rejects.
    Approval grants exactly ONE print authorization.
    """
    STATUS_CHOICES = [
        ("pending", "Reprint Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]

    id = models.CharField(max_length=64, primary_key=True)
    asset_id = models.CharField(max_length=64, db_index=True)
    asset_code = models.CharField(max_length=64, db_index=True)
    asset_name = models.CharField(max_length=255, blank=True)
    department = models.CharField(max_length=128, blank=True)
    requested_by = models.CharField(max_length=128)
    requester_user_id = models.CharField(max_length=64, db_index=True)
    requester_dept = models.CharField(max_length=128, blank=True)
    reason = models.CharField(max_length=255)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="pending", db_index=True)
    requested_at = models.DateTimeField(default=timezone.now, db_index=True)

    reviewed_by = models.CharField(max_length=128, blank=True)
    reviewer_user_id = models.CharField(max_length=64, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True)

    is_used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)
    used_by = models.CharField(max_length=128, blank=True)
    used_user_id = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ["-requested_at"]
        verbose_name = "Reprint Request"
        verbose_name_plural = "Reprint Requests"

    def to_dict(self):
        return {
            "id": self.id,
            "assetId": self.asset_id,
            "assetCode": self.asset_code,
            "assetName": self.asset_name,
            "department": self.department,
            "requestedBy": self.requested_by,
            "requesterUserId": self.requester_user_id,
            "requesterDept": self.requester_dept,
            "reason": self.reason,
            "notes": self.notes,
            "status": self.status,
            "requestedAt": self.requested_at.isoformat() if self.requested_at else None,
            "reviewedBy": self.reviewed_by,
            "reviewerUserId": self.reviewer_user_id,
            "reviewedAt": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "reviewNotes": self.review_notes,
            "isUsed": self.is_used,
            "usedAt": self.used_at.isoformat() if self.used_at else None,
            "usedBy": self.used_by,
            "usedUserId": self.used_user_id,
        }


class ReprintAuditLog(models.Model):
    """
    Complete audit trail for QR printing:
    Print Count, Printed By, Printed Date & Time, Request Reason, Approval Status, Approved By.
    """
    ACTION_CHOICES = [
        ("FIRST_PRINT", "First Print"),
        ("REPRINT", "Re-print Executed"),
        ("REQUEST_SUBMITTED", "Reprint Request Submitted"),
        ("APPROVED", "Reprint Approved by HOD"),
        ("REJECTED", "Reprint Rejected by HOD"),
        ("BLOCKED_ATTEMPT", "Unauthorized Print Blocked"),
    ]

    asset_code = models.CharField(max_length=64, db_index=True)
    asset_id = models.CharField(max_length=64, blank=True)
    action = models.CharField(max_length=64, choices=ACTION_CHOICES, db_index=True)
    print_count = models.IntegerField(default=0)
    actor_name = models.CharField(max_length=128)
    actor_user_id = models.CharField(max_length=64, db_index=True)
    actor_role = models.CharField(max_length=64, blank=True)
    reason = models.CharField(max_length=255, blank=True)
    approval_status = models.CharField(max_length=32, blank=True)
    approved_by = models.CharField(max_length=128, blank=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-timestamp"]
        verbose_name = "Reprint Audit Log"
        verbose_name_plural = "Reprint Audit Logs"

    def to_dict(self):
        return {
            "id": self.id,
            "assetCode": self.asset_code,
            "assetId": self.asset_id,
            "action": self.action,
            "printCount": self.print_count,
            "printedBy": self.actor_name,
            "printedUserId": self.actor_user_id,
            "actorRole": self.actor_role,
            "printedDateTime": self.timestamp.isoformat() if self.timestamp else None,
            "requestReason": self.reason,
            "approvalStatus": self.approval_status,
            "approvedBy": self.approved_by,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "details": self.details,
        }


class PasswordResetRequest(models.Model):
    """
    Enterprise Password Reset Governance Workflow:
    When an employee clicks "Forgot password?", a request is submitted.
    Super User is notified with the employee's name, user_id, department, plant, and timestamp.
    Super User sets the new password directly from the governance center / notifications.
    """
    STATUS_CHOICES = [
        ("pending", "Pending Super User Reset"),
        ("completed", "Completed / Reset"),
        ("rejected", "Rejected"),
    ]

    id = models.CharField(max_length=64, primary_key=True)
    user_id = models.CharField(max_length=64, db_index=True)
    user_name = models.CharField(max_length=128)
    department = models.CharField(max_length=128, blank=True)
    plant = models.CharField(max_length=128, blank=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="pending", db_index=True)
    requested_at = models.DateTimeField(default=timezone.now, db_index=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.CharField(max_length=128, blank=True)
    resolver_user_id = models.CharField(max_length=64, blank=True)
    new_password_set = models.BooleanField(default=False)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-requested_at"]
        verbose_name = "Password Reset Request"
        verbose_name_plural = "Password Reset Requests"

    def to_dict(self):
        return {
            "id": self.id,
            "requestId": self.id,
            "userId": self.user_id,
            "userName": self.user_name,
            "department": self.department,
            "plant": self.plant,
            "status": self.status,
            "requestedAt": self.requested_at.isoformat() if self.requested_at else None,
            "resolvedAt": self.resolved_at.isoformat() if self.resolved_at else None,
            "resolvedBy": self.resolved_by,
            "resolverUserId": self.resolver_user_id,
            "newPasswordSet": self.new_password_set,
            "notes": self.notes,
        }




