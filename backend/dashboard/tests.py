import time
import json
from django.test import TestCase, Client
from django.urls import reverse
from django.utils import timezone

from .models import Asset, AuditLog, UserSession, AppUser, ReprintRequest, ReprintAuditLog, PasswordResetRequest
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


class RBACUserManagementTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_superuser_creates_user_with_explicit_password_by_department(self):
        # 1. Superuser creates a Maintenance specialist
        payload = {
            "userId": "MNT-101",
            "name": "Rajesh Kumar",
            "department": "Maintenance",
            "role": "Maintenance",
            "password": "PlantMntSecurePass#2026",
            "createdBy": "Superuser",
        }
        res = self.client.post(
            reverse('api-users'),
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["user"]["userId"], "MNT-101")
        self.assertEqual(data["user"]["department"], "Maintenance")
        self.assertEqual(data["user"]["role"], "Maintenance")
        self.assertEqual(data["user"]["password"], "PlantMntSecurePass#2026")

        # 2. Check audit log for USER_CREATE
        user_audit = AuditLog.objects.filter(action="USER_CREATE", entity_id="MNT-101").first()
        self.assertIsNotNone(user_audit)
        self.assertTrue(user_audit.details.get("passwordSetBySuperuser"))

        # 3. Test department filtering
        res_dep = self.client.get(reverse('api-users') + "?department=Maintenance")
        self.assertEqual(res_dep.status_code, 200)
        self.assertEqual(len(res_dep.json()["users"]), 1)

        res_other = self.client.get(reverse('api-users') + "?department=Finance")
        self.assertEqual(len(res_other.json()["users"]), 0)

        # 4. Authenticate using the exact password set by Superuser
        auth_res = self.client.post(
            reverse('api-user-login'),
            data=json.dumps({
                "userId": "MNT-101",
                "password": "PlantMntSecurePass#2026",
            }),
            content_type="application/json",
        )
        self.assertEqual(auth_res.status_code, 200)
        self.assertEqual(auth_res.json()["status"], "authenticated")
        self.assertEqual(auth_res.json()["user"]["department"], "Maintenance")

        # 5. Wrong password rejected
        wrong_auth = self.client.post(
            reverse('api-user-login'),
            data=json.dumps({
                "userId": "MNT-101",
                "password": "WrongPassword",
            }),
            content_type="application/json",
        )
        self.assertEqual(wrong_auth.status_code, 401)

    def test_random_password_disabled_password_is_mandatory(self):
        # Attempt to create user without password must be rejected
        payload = {
            "userId": "PROD-201",
            "name": "Sunil Verma",
            "department": "Production",
            "role": "Employee",
            # No password provided
        }
        res = self.client.post(
            reverse('api-users'),
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Password must be explicitly set by Superuser", res.json()["error"])

    def test_superuser_updates_user_password_and_department(self):
        # Create initial user
        self.client.post(
            reverse('api-users'),
            data=json.dumps({
                "userId": "STR-301",
                "name": "Pooja Sharma",
                "department": "Store",
                "role": "Store",
                "password": "InitialStorePass1",
            }),
            content_type="application/json",
        )

        # Superuser updates department to Finance and changes password manually
        update_res = self.client.put(
            reverse('api-user-detail', kwargs={"user_id": "STR-301"}),
            data=json.dumps({
                "department": "Finance",
                "role": "Auditor",
                "password": "NewManualSuperuserPass2026",
            }),
            content_type="application/json",
        )
        self.assertEqual(update_res.status_code, 200)
        updated = update_res.json()["user"]
        self.assertEqual(updated["department"], "Finance")
        self.assertEqual(updated["role"], "Auditor")
        self.assertEqual(updated["password"], "NewManualSuperuserPass2026")

        # Old password fails
        old_auth = self.client.post(
            reverse('api-user-login'),
            data=json.dumps({"userId": "STR-301", "password": "InitialStorePass1"}),
            content_type="application/json",
        )
        self.assertEqual(old_auth.status_code, 401)

        # New password succeeds
        new_auth = self.client.post(
            reverse('api-user-login'),
            data=json.dumps({"userId": "STR-301", "password": "NewManualSuperuserPass2026"}),
            content_type="application/json",
        )
        self.assertEqual(new_auth.status_code, 200)

    def test_security_lockout_after_five_failed_attempts_and_superuser_unlock(self):
        """
        Verify:
        1. 5 consecutive failed login attempts locks account for 15 minutes.
        2. AuditLog records IP and failure reasons.
        3. Non-superuser cannot access security audit endpoints (403 Forbidden).
        4. Superuser can inspect security login audit and unlock the locked user.
        """
        AppUser.objects.create(
            user_id="SMT-LOCK-1",
            name="Ramesh Yadav",
            department="Production",
            role="Employee",
            password="CorrectPassword123",
            is_active=True,
        )

        # 4 consecutive failed attempts -> account still not locked, but counts attempts
        for attempt in range(1, 5):
            res = self.client.post(
                reverse('api-user-login'),
                data=json.dumps({"userId": "SMT-LOCK-1", "password": f"WrongPass{attempt}"}),
                content_type="application/json",
                REMOTE_ADDR="192.168.10.45",
            )
            self.assertEqual(res.status_code, 401)
            self.assertEqual(res.json()["failedAttempts"], attempt)
            self.assertEqual(res.json()["attemptsRemaining"], 5 - attempt)

        # 5th failed attempt -> account is LOCKED
        lock_res = self.client.post(
            reverse('api-user-login'),
            data=json.dumps({"userId": "SMT-LOCK-1", "password": "WrongPass5"}),
            content_type="application/json",
            REMOTE_ADDR="192.168.10.45",
        )
        self.assertEqual(lock_res.status_code, 403)
        self.assertTrue(lock_res.json()["isLocked"])

        # Subsequent attempt even with CORRECT password is rejected while locked
        blocked_res = self.client.post(
            reverse('api-user-login'),
            data=json.dumps({"userId": "SMT-LOCK-1", "password": "CorrectPassword123"}),
            content_type="application/json",
            REMOTE_ADDR="192.168.10.45",
        )
        self.assertEqual(blocked_res.status_code, 403)
        self.assertTrue(blocked_res.json()["isLocked"])

        # Non-superuser receives 403 on security audit endpoint
        non_su_res = self.client.get(reverse('api-security-login-audit'))
        self.assertEqual(non_su_res.status_code, 403)

        # Superuser can access security audit endpoint
        su_res = self.client.get(
            reverse('api-security-login-audit'),
            HTTP_X_SUPERUSER="true",
            HTTP_X_USER_ID="USR-ADMIN",
        )
        self.assertEqual(su_res.status_code, 200)
        data = su_res.json()
        self.assertGreaterEqual(data["lockedAccountsCount"], 1)
        self.assertGreaterEqual(data["totalSecurityLogs"], 5)

        # Superuser manually unlocks the user
        unlock_res = self.client.post(
            reverse('api-security-unlock-user', kwargs={"user_id": "SMT-LOCK-1"}),
            HTTP_X_SUPERUSER="true",
            HTTP_X_USER_ID="USR-ADMIN",
        )
        self.assertEqual(unlock_res.status_code, 200)
        self.assertEqual(unlock_res.json()["status"], "unlocked")

        # Now login succeeds with correct password
        success_res = self.client.post(
            reverse('api-user-login'),
            data=json.dumps({"userId": "SMT-LOCK-1", "password": "CorrectPassword123"}),
            content_type="application/json",
            REMOTE_ADDR="192.168.10.45",
        )
        self.assertEqual(success_res.status_code, 200)

    def test_secure_qr_print_control_workflow(self):
        """
        Verify the complete secure QR print control and HOD approval workflow:
        1. Default single-print rule allows 1st print.
        2. Direct duplicate print by normal user is blocked (403 Forbidden).
        3. Request reprint without mandatory reason fails (400 Bad Request).
        4. Request reprint with valid reason succeeds with status 'pending'.
        5. Normal employee cannot approve reprint (403 Forbidden).
        6. HOD approves request -> exactly 1 print unlocked.
        7. Normal user performs reprint -> succeeds, print count = 2.
        8. Normal user tries 3rd print -> immediately locked again (403 Forbidden).
        9. Complete audit trail records all print actions, actor, date/time, reason, and approval status.
        """
        # Create an asset
        asset = Asset.objects.create(
            tag="AST-PRINT-TEST-1",
            asset_code="5000507",
            name="Volumetric air tightness test equipment",
            department="Production",
            status="Active",
            print_count=0,
        )

        # 1. First print: Allowed
        res_print_1 = self.client.post(
            reverse('api-record-label-print'),
            data=json.dumps({
                "assetCode": "5000507",
                "assetId": str(asset.id),
                "userName": "Ramesh Kumar",
                "userId": "EMP-PRD-01",
                "role": "Employee",
                "department": "Production",
            }),
            content_type="application/json"
        )
        self.assertEqual(res_print_1.status_code, 200)
        self.assertEqual(res_print_1.json()["printCount"], 1)
        self.assertEqual(res_print_1.json()["status"], "Printed")

        asset.refresh_from_db()
        self.assertEqual(asset.print_count, 1)
        self.assertEqual(asset.first_printed_by, "Ramesh Kumar")

        # 2. Second print attempt without permit: Strictly blocked with 403 Forbidden
        res_print_blocked = self.client.post(
            reverse('api-record-label-print'),
            data=json.dumps({
                "assetCode": "5000507",
                "assetId": str(asset.id),
                "userName": "Ramesh Kumar",
                "userId": "EMP-PRD-01",
                "role": "Employee",
                "department": "Production",
            }),
            content_type="application/json"
        )
        self.assertEqual(res_print_blocked.status_code, 403)
        self.assertEqual(res_print_blocked.json()["status"], "LOCKED")
        self.assertEqual(res_print_blocked.json()["printCount"], 1)

        # 3. Request reprint without mandatory reason: Returns 400 Bad Request
        res_req_no_reason = self.client.post(
            reverse('api-reprint-requests'),
            data=json.dumps({
                "assetCode": "5000507",
                "assetId": str(asset.id),
                "userName": "Ramesh Kumar",
                "userId": "EMP-PRD-01",
                "department": "Production",
                "reason": "   ",  # Blank reason
            }),
            content_type="application/json"
        )
        self.assertEqual(res_req_no_reason.status_code, 400)
        self.assertIn("mandatory reason", res_req_no_reason.json()["error"].lower())

        # 4. Request reprint with valid reason: Successfully created with status 'pending'
        res_req_valid = self.client.post(
            reverse('api-reprint-requests'),
            data=json.dumps({
                "assetCode": "5000507",
                "assetId": str(asset.id),
                "assetName": asset.name,
                "userName": "Ramesh Kumar",
                "userId": "EMP-PRD-01",
                "department": "Production",
                "reason": "Label Damaged / Scratched",
                "notes": "Physical sticker tore during maintenance calibration on SMT line 2.",
            }),
            content_type="application/json"
        )
        self.assertEqual(res_req_valid.status_code, 201)
        req_data = res_req_valid.json()["request"]
        req_id = req_data["id"]
        self.assertEqual(req_data["status"], "pending")
        self.assertEqual(req_data["reason"], "Label Damaged / Scratched")

        # 5. Normal employee tries to approve: Denied (403 Forbidden)
        res_unauth_approve = self.client.post(
            reverse('api-reprint-request-action', kwargs={"request_id": req_id}),
            data=json.dumps({
                "action": "approve",
                "userId": "EMP-PRD-02",
                "userName": "Normal Worker",
                "role": "Employee",
            }),
            content_type="application/json"
        )
        self.assertEqual(res_unauth_approve.status_code, 403)

        # 6. HOD approves the request
        res_hod_approve = self.client.post(
            reverse('api-reprint-request-action', kwargs={"request_id": req_id}),
            data=json.dumps({
                "action": "approve",
                "userId": "HOD-PRD-01",
                "userName": "Manish Chauhan (HOD)",
                "role": "Department Head (HOD)",
                "notes": "Approved replacement label for line 2 calibration.",
            }),
            content_type="application/json"
        )
        self.assertEqual(res_hod_approve.status_code, 200)
        self.assertEqual(res_hod_approve.json()["request"]["status"], "approved")

        # 7. Normal user prints reprint: Succeeds, print count becomes 2
        res_reprint = self.client.post(
            reverse('api-record-label-print'),
            data=json.dumps({
                "assetCode": "5000507",
                "assetId": str(asset.id),
                "userName": "Ramesh Kumar",
                "userId": "EMP-PRD-01",
                "role": "Employee",
                "department": "Production",
            }),
            content_type="application/json"
        )
        self.assertEqual(res_reprint.status_code, 200)
        self.assertEqual(res_reprint.json()["printCount"], 2)
        self.assertTrue(res_reprint.json()["isReprint"])

        asset.refresh_from_db()
        self.assertEqual(asset.print_count, 2)

        # 8. Permit is consumed: third print attempt is immediately locked again
        res_print_3_blocked = self.client.post(
            reverse('api-record-label-print'),
            data=json.dumps({
                "assetCode": "5000507",
                "assetId": str(asset.id),
                "userName": "Ramesh Kumar",
                "userId": "EMP-PRD-01",
                "role": "Employee",
                "department": "Production",
            }),
            content_type="application/json"
        )
        self.assertEqual(res_print_3_blocked.status_code, 403)
        self.assertEqual(res_print_3_blocked.json()["status"], "LOCKED")

        # 9. Audit trail verification: Complete history preserved
        res_history = self.client.get(
            reverse('api-reprint-history', kwargs={"asset_code": "5000507"})
        )
        self.assertEqual(res_history.status_code, 200)
        history_data = res_history.json()
        self.assertEqual(history_data["printCount"], 2)
        self.assertEqual(history_data["firstPrintedBy"], "Ramesh Kumar")
        self.assertEqual(history_data["lastPrintedBy"], "Ramesh Kumar")
        self.assertGreaterEqual(len(history_data["history"]), 4)  # first print, blocked attempt, req submitted, approved, reprint, blocked attempt

    def test_password_reset_governance_workflow(self):
        # 1. Create employee user and superuser
        emp = AppUser.objects.create(
            user_id="19102709",
            name="Arbind Kumar Singh",
            department="Production",
            role="Employee",
            password="OldSecretPassword123",
            is_active=True
        )
        admin = AppUser.objects.create(
            user_id="USR-ADMIN",
            name="Super User",
            department="IT",
            role="Admin",
            password="AdminPassword2026!",
            is_superuser=True
        )

        # 2. Superuser self-reset attempt is blocked
        res_admin_block = self.client.post(
            reverse('api-password-reset-request'),
            data=json.dumps({"userId": "USR-ADMIN"}),
            content_type="application/json"
        )
        self.assertEqual(res_admin_block.status_code, 403)

        # 3. Employee requests password reset
        res_req = self.client.post(
            reverse('api-password-reset-request'),
            data=json.dumps({
                "userId": "19102709",
                "plant": "Noida Plant",
                "notes": "Forgot password on morning shift",
            }),
            content_type="application/json"
        )
        self.assertEqual(res_req.status_code, 201)
        req_data = res_req.json()
        self.assertTrue(req_data["success"])
        self.assertEqual(req_data["request"]["userName"], "Arbind Kumar Singh")
        self.assertEqual(req_data["request"]["status"], "pending")
        req_id = req_data["request"]["id"]

        # 4. Superuser queries pending password reset requests
        res_list = self.client.get(reverse('api-password-reset-requests'), {"status": "pending"})
        self.assertEqual(res_list.status_code, 200)
        requests = res_list.json()["requests"]
        self.assertEqual(len(requests), 1)
        self.assertEqual(requests[0]["userId"], "19102709")

        # 5. Non-superuser cannot resolve request (unauthorized)
        res_unauth = self.client.post(
            reverse('api-password-reset-resolve', kwargs={"request_id": req_id}),
            data=json.dumps({
                "userId": "SOME-EMP",
                "userName": "Normal Emp",
                "role": "Employee",
                "newPassword": "HackedPassword123",
            }),
            content_type="application/json"
        )
        self.assertEqual(res_unauth.status_code, 403)

        # 6. Superuser sets new password
        res_resolve = self.client.post(
            reverse('api-password-reset-resolve', kwargs={"request_id": req_id}),
            data=json.dumps({
                "userId": "USR-ADMIN",
                "userName": "Super User",
                "role": "Admin",
                "newPassword": "NewStrongPassword2026!",
            }),
            content_type="application/json"
        )
        self.assertEqual(res_resolve.status_code, 200)
        self.assertTrue(res_resolve.json()["success"])

        # 7. Verify AppUser password updated and request marked completed
        emp.refresh_from_db()
        self.assertEqual(emp.password, "NewStrongPassword2026!")

        reset_req = PasswordResetRequest.objects.get(id=req_id)
        self.assertEqual(reset_req.status, "completed")
        self.assertEqual(reset_req.resolved_by, "Super User")
        self.assertTrue(reset_req.new_password_set)




