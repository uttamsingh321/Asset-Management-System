import time
from django.test import TestCase
from django.urls import reverse

class MeridianDashboardTests(TestCase):
    def test_dashboard_renders_successfully(self):
        start_time = time.perf_counter()
        response = self.client.get(reverse('dashboard'))
        duration_ms = (time.perf_counter() - start_time) * 1000

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Meridian · Executive dashboard")
        self.assertContains(response, "Fleet health")
        # Rule 2: load/render time must be less than 100ms
        self.assertLess(duration_ms, 100.0, f"Render duration was {duration_ms:.2f}ms, expected < 100ms")
