import time
import json
from django.test import TestCase, Client
from django.urls import reverse
from .models import Asset

class BackendAPITests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_rule_1_zero_dummy_data_by_default(self):
        # Database must start with 0 dummy records
        self.assertEqual(Asset.objects.count(), 0)
        res = self.client.get(reverse('api-assets'))
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["count"], 0)
        self.assertEqual(len(data["assets"]), 0)

    def test_rule_2_sub_100ms_response_time(self):
        start = time.perf_counter()
        res = self.client.get(reverse('api-health'))
        duration_ms = (time.perf_counter() - start) * 1000

        self.assertEqual(res.status_code, 200)
        self.assertLess(duration_ms, 100.0, f"Health check took {duration_ms:.2f}ms, expected < 100ms")

    def test_create_and_delete_asset(self):
        post_data = {
            "assetTag": "AST-2026-TEST",
            "name": "High Performance Server Node",
            "category": "IT Hardware",
            "department": "Engineering",
            "status": "Active",
            "purchaseCost": 4500.0,
            "currentValue": 4500.0,
            "assignedTo": "DevOps Fleet",
            "location": "Data Center Rack 4",
        }
        res = self.client.post(
            reverse('api-assets'),
            data=json.dumps(post_data),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 201)
        created = res.json()
        self.assertEqual(created["name"], "High Performance Server Node")

        # Metrics check
        res_metrics = self.client.get(reverse('api-metrics'))
        metrics = res_metrics.json()
        self.assertEqual(metrics["totalAssets"], 1)
        self.assertEqual(metrics["totalValuation"], 4500.0)

        # Delete check
        pk = created["id"]
        res_del = self.client.delete(reverse('api-asset-detail', kwargs={"pk": pk}))
        self.assertEqual(res_del.status_code, 200)
        self.assertEqual(Asset.objects.count(), 0)
