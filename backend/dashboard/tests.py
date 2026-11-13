import time
import json
from django.test import TestCase, Client
from django.urls import reverse
from django.utils import timezone

from .models import Asset, AuditLog, UserSession
from .device_detector import parse_device_and_browser, _detect_device_type, _detect_os, _detect_browser


class BackendAPITests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_rule_1_zero_dummy_data_by_default(self):
        # Database must start with 0 dummy records
        self.assertEqual(Asset.objects.count(), 0)
        self.assertEqual(AuditLog.objects.count(), 0)
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

        # Automatically generated ASSET_CREATE audit log
        self.assertEqual(AuditLog.objects.filter(action="ASSET_CREATE").count(), 1)
        log = AuditLog.objects.filter(action="ASSET_CREATE").first()
        self.assertEqual(log.entity_id, "AST-2026-TEST")

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

        # Automatically generated ASSET_DELETE audit log
        self.assertEqual(AuditLog.objects.filter(action="ASSET_DELETE").count(), 1)


class DeviceDetectorUnitTests(TestCase):
    def test_device_type_detection(self):
        # 1. Desktop
        desktop_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        self.assertEqual(_detect_device_type(desktop_ua, "?0"), "Desktop")

        # 2. Laptop (e.g. MacBook or ThinkPad)
        macbook_ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) MacBookPro18,1 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        self.assertEqual(_detect_device_type(macbook_ua, "?0"), "Laptop")

        chromebook_ua = "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        self.assertEqual(_detect_device_type(chromebook_ua, "?0"), "Laptop")

        # 3. Tablet (e.g. iPad, Galaxy Tab)
        ipad_ua = "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
        self.assertEqual(_detect_device_type(ipad_ua, "?0"), "Tablet")

        android_tab_ua = "Mozilla/5.0 (Linux; Android 13; SM-T870) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
        self.assertEqual(_detect_device_type(android_tab_ua, "?0"), "Tablet")

        # 4. Mobile (e.g. iPhone, Android Mobile)
        iphone_ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1"
        self.assertEqual(_detect_device_type(iphone_ua, "?1"), "Mobile")

        android_mobile_ua = "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36"
        self.assertEqual(_detect_device_type(android_mobile_ua, "?1"), "Mobile")

    def test_os_and_browser_detection(self):
        win_chrome_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        self.assertIn("Windows", _detect_os(win_chrome_ua))
        self.assertIn("Chrome", _detect_browser(win_chrome_ua))

        mac_safari_ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15"
        self.assertIn("macOS", _detect_os(mac_safari_ua))
        self.assertIn("Safari", _detect_browser(mac_safari_ua))

        win_edge_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.2365.92"
        self.assertIn("Edge", _detect_browser(win_edge_ua))

        linux_firefox_ua = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0"
        self.assertIn("Linux", _detect_os(linux_firefox_ua))
        self.assertIn("Firefox", _detect_browser(linux_firefox_ua))


class AuditAndDeviceTrackingTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_immutable_audit_log_constraints(self):
        """
        Verify that an AuditLog row once saved CANNOT be updated or deleted.
        """
        log = AuditLog.objects.create(
            user_id="USR-001",
            user_name="Security Officer",
            role="Auditor",
            session_id="SES-TEST-001",
            action="LOGIN",
            entity_type="Session",
            entity_id="SES-TEST-001",
            client_ip="192.168.1.50",
            device_type="Desktop",
            os="Windows 11",
            browser="Chrome 122",
        )
        self.assertIsNotNone(log.id)

        # 1. Update attempt must raise PermissionError
        log.user_name = "Tampered Name"
        with self.assertRaises(PermissionError):
            log.save()

        # 2. Individual delete attempt must raise PermissionError
        with self.assertRaises(PermissionError):
            log.delete()

        # 3. Bulk delete attempt must raise PermissionError
        with self.assertRaises(PermissionError):
            AuditLog.objects.filter(id=log.id).delete()

        # 4. Bulk update attempt must raise PermissionError
        with self.assertRaises(PermissionError):
            AuditLog.objects.filter(id=log.id).update(user_name="Hacked")

    def test_session_login_and_logout_lifecycle(self):
        """
        Verify user login session creation, device detection, and logout timestamp tracking.
        """
        login_payload = {
            "userId": "USR-101",
            "userName": "Uttam Singh",
            "role": "Administrator",
            "authMethod": "MFA-Biometric",
        }
        res_login = self.client.post(
            reverse('api-session-login'),
            data=json.dumps(login_payload),
            content_type="application/json",
            HTTP_USER_AGENT="Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1",
            HTTP_SEC_CH_UA_MOBILE="?1",
            HTTP_X_FORWARDED_FOR="203.0.113.195",
        )
        self.assertEqual(res_login.status_code, 201)
        login_data = res_login.json()
        session_id = login_data["session"]["sessionId"]
        self.assertEqual(login_data["session"]["deviceType"], "Mobile")
        self.assertIn("iOS", login_data["session"]["os"])
        self.assertEqual(login_data["session"]["clientIp"], "203.0.113.195")

        # Verify LOGIN audit log exists
        login_log = AuditLog.objects.get(action="LOGIN", session_id=session_id)
        self.assertEqual(login_log.user_name, "Uttam Singh")
        self.assertEqual(login_log.device_type, "Mobile")
        self.assertIsNotNone(login_log.login_timestamp)

        # Now Logout
        res_logout = self.client.post(
            reverse('api-session-logout'),
            data=json.dumps({"sessionId": session_id}),
            content_type="application/json",
            HTTP_X_FORWARDED_FOR="203.0.113.195",
        )
        self.assertEqual(res_logout.status_code, 200)

        # Verify session is inactive and has logout timestamp
        session = UserSession.objects.get(session_id=session_id)
        self.assertFalse(session.is_active)
        self.assertIsNotNone(session.logout_timestamp)

        # Verify LOGOUT audit log was stored
        logout_log = AuditLog.objects.get(action="LOGOUT", session_id=session_id)
        self.assertIsNotNone(logout_log.logout_timestamp)
        self.assertEqual(logout_log.user_id, "USR-101")

    def test_all_required_audit_actions(self):
        """
        Verify every specified action: login, asset creation, update, import,
        export, transfer, approval, and deletion.
        """
        session_id = "SES-COMPLIANCE-999"

        # 1. ASSET_IMPORT
        import_res = self.client.post(
            reverse('api-audit-log'),
            data=json.dumps({
                "action": "ASSET_IMPORT",
                "userId": "USR-OP-5",
                "userName": "Uttam Singh",
                "role": "Inventory Manager",
                "sessionId": session_id,
                "entityType": "BatchImport",
                "entityId": "IMP-2026-XLSX",
                "details": {"rowCount": 15000, "filename": "factory_assets_q1.xlsx", "categoriesCount": 8},
            }),
            content_type="application/json",
            HTTP_USER_AGENT="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
        )
        self.assertEqual(import_res.status_code, 201)

        # 2. ASSET_CREATE
        create_res = self.client.post(
            reverse('api-assets'),
            data=json.dumps({
                "assetCode": "AST-CNC-850",
                "name": "Haas CNC Vertical Mill VMC 850",
                "category": "Machinery",
                "department": "Plant Engineering",
                "plant": "Pune Plant Block A",
                "status": "Active",
                "purchaseCost": 75000.0,
                "currentValue": 75000.0,
                "submitter": "Uttam Singh",
                "userId": "USR-OP-5",
                "userName": "Uttam Singh",
                "role": "Inventory Manager",
                "sessionId": session_id,
            }),
            content_type="application/json",
        )
        self.assertEqual(create_res.status_code, 201)
        created_asset_id = create_res.json()["id"]

        # 3. ASSET_UPDATE
        update_res = self.client.put(
            reverse('api-asset-detail', kwargs={"pk": created_asset_id}),
            data=json.dumps({
                "status": "Maintenance",
                "remarks": "Scheduled 6-month hydraulic fluid inspection",
                "userId": "USR-OP-5",
                "userName": "Uttam Singh",
                "role": "Inventory Manager",
                "sessionId": session_id,
            }),
            content_type="application/json",
        )
        self.assertEqual(update_res.status_code, 200)

        # 4. ASSET_TRANSFER
        transfer_res = self.client.post(
            reverse('api-audit-transfer'),
            data=json.dumps({
                "assetCode": "AST-CNC-850",
                "fromDepartment": "Plant Engineering",
                "toDepartment": "Tooling & Fabrication",
                "fromLocation": "Pune Plant Block A",
                "toLocation": "Pune Plant Block C - Bay 4",
                "newAssignee": "Rajesh Kumar",
                "reason": "Production line expansion",
                "userId": "USR-OP-5",
                "userName": "Uttam Singh",
                "role": "Inventory Manager",
                "sessionId": session_id,
            }),
            content_type="application/json",
        )
        self.assertEqual(transfer_res.status_code, 201)

        # 5. ASSET_APPROVAL
        approval_res = self.client.post(
            reverse('api-audit-approval'),
            data=json.dumps({
                "assetCode": "AST-CNC-850",
                "decision": "Approved",
                "approvalType": "Inter-Department Transfer",
                "comments": "Approved based on Q4 tooling budget clearance",
                "userId": "USR-DIR-1",
                "userName": "Dr. V. Rao",
                "role": "VP Operations",
                "sessionId": session_id,
            }),
            content_type="application/json",
        )
        self.assertEqual(approval_res.status_code, 201)

        # 6. ASSET_EXPORT
        export_res = self.client.post(
            reverse('api-audit-log'),
            data=json.dumps({
                "action": "ASSET_EXPORT",
                "userId": "USR-AUDIT-2",
                "userName": "Compliance Officer",
                "role": "Auditor",
                "sessionId": session_id,
                "entityType": "Report",
                "entityId": "EXP-CSV-ALL",
                "details": {"format": "CSV", "exportedCount": 1},
            }),
            content_type="application/json",
        )
        self.assertEqual(export_res.status_code, 201)

        # 7. ASSET_DELETE
        delete_res = self.client.delete(reverse('api-asset-detail', kwargs={"pk": created_asset_id}))
        self.assertEqual(delete_res.status_code, 200)

        # Query all logs and check that all required actions were logged
        logs_res = self.client.get(reverse('api-audit-logs'))
        self.assertEqual(logs_res.status_code, 200)
        logs_data = logs_res.json()

        logged_actions = set(l["action"] for l in logs_data["auditLogs"])
        expected_actions = {
            "ASSET_IMPORT",
            "ASSET_CREATE",
            "ASSET_UPDATE",
            "ASSET_TRANSFER",
            "ASSET_APPROVAL",
            "ASSET_EXPORT",
            "ASSET_DELETE",
        }
        for act in expected_actions:
            self.assertIn(act, logged_actions, f"Action {act} was not found in audit logs")

        # Test querying with specific filters (action, device_type, search)
        filter_res = self.client.get(reverse('api-audit-logs') + "?action=ASSET_IMPORT")
        self.assertEqual(filter_res.json()["totalCount"], 1)
        self.assertEqual(filter_res.json()["auditLogs"][0]["details"]["filename"], "factory_assets_q1.xlsx")
