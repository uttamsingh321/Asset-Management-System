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
    ]

    tag = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=64, choices=CATEGORY_CHOICES, default="IT Hardware")
    department = models.CharField(max_length=128)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="Active")
    purchase_date = models.DateField(auto_now_add=True)
    purchase_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    current_value = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    assigned_to = models.CharField(max_length=128, blank=True)
    location = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.tag} - {self.name}"

    def to_dict(self):
        return {
            "id": self.id,
            "assetTag": self.tag,
            "name": self.name,
            "category": self.category,
            "department": self.department,
            "status": self.status,
            "purchaseDate": str(self.purchase_date),
            "purchaseCost": float(self.purchase_cost),
            "currentValue": float(self.current_value),
            "assignedTo": self.assigned_to,
            "location": self.location,
        }
