from django.db import models

class Asset(models.Model):
    STATUS_CHOICES = [
        ("Active", "Active"),
        ("Maintenance", "Maintenance"),
        ("Reserved", "Reserved"),
        ("Retired", "Retired"),
    ]

    CATEGORY_CHOICES = [
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
    category = models.CharField(max_length=64, choices=CATEGORY_CHOICES, default="IT Hardware")
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
    plant = models.CharField(max_length=128, blank=True)
    building = models.CharField(max_length=128, blank=True)
    floor = models.CharField(max_length=64, blank=True)
    current_location = models.CharField(max_length=255, blank=True)

    # Ownership
    current_department = models.CharField(max_length=128, blank=True)
    submitter = models.CharField(max_length=128, blank=True)

    # Asset Status
    asset_condition = models.CharField(max_length=128, blank=True)
    movement_reason = models.CharField(max_length=255, blank=True)
    remarks = models.TextField(blank=True)

    # Media (Base64 data URLs)
    asset_photo = models.TextField(blank=True)
    asset_code_photo = models.TextField(blank=True)
    id_card_picture = models.TextField(blank=True)

    # Metadata
    metadata_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.tag or self.asset_code} - {self.name}"

    def to_dict(self):
        return {
            "id": self.id,
            "assetTag": self.tag or self.asset_code,
            "assetCode": self.asset_code or self.tag,
            "serialNumber": self.serial_number,
            "name": self.name or self.current_description,
            "category": self.category or self.current_category,
            "currentCategory": self.current_category,
            "previousCategory": self.previous_category,
            "currentDescription": self.current_description,
            "previousDescription": self.previous_description,
            "plant": self.plant,
            "building": self.building,
            "floor": self.floor,
            "currentLocation": self.current_location,
            "department": self.department or self.current_department,
            "currentDepartment": self.current_department,
            "submitter": self.submitter,
            "status": self.status,
            "assetCondition": self.asset_condition,
            "movementReason": self.movement_reason,
            "remarks": self.remarks,
            "assetPhoto": self.asset_photo,
            "assetCodePhoto": self.asset_code_photo,
            "idCardPicture": self.id_card_picture,
            "date": str(self.metadata_date or self.purchase_date),
            "purchaseDate": str(self.purchase_date),
            "purchaseCost": float(self.purchase_cost),
            "currentValue": float(self.current_value),
            "assignedTo": self.assigned_to or self.submitter,
            "location": self.location or self.current_location,
        }
