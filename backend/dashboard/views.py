import json
import time
import uuid
from datetime import datetime, timezone
from django.http import JsonResponse, HttpRequest, HttpResponseNotAllowed
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q, Count
from django.utils import timezone as dj_timezone

from .models import Asset, AuditLog, UserSession
from .device_detector import parse_device_and_browser


def record_audit_log(
    request: HttpRequest,
    action: str,
    user_id: str = "USR-ADMIN",
    user_name: str = "Uttam Singh",
    role: str = "Administrator",
    session_id: str = "",
    entity_type: str = "Asset",
    entity_id: str = "",
    details: dict = None,
    login_ts=None,
    logout_ts=None,
) -> AuditLog:
    """
    Central helper to record immutable audit logs with automatic device telemetry.
    """
    telemetry = parse_device_and_browser(request)

    # Allow client override if explicit in header or payload
    if not session_id:
        session_id = request.META.get('HTTP_X_SESSION_ID') or f"SES-{uuid.uuid4().hex[:12].upper()}"

    # Lookup session for login/logout timestamps if available
    session = UserSession.objects.filter(session_id=session_id).first()
    if session:
        if not login_ts:
            login_ts = session.login_timestamp
        if not logout_ts:
            logout_ts = session.logout_timestamp
        if not user_id or user_id == "USR-ADMIN":
            user_id = session.user_id
        if not user_name or user_name == "Uttam Singh":
            user_name = session.user_name
        if not role or role == "Administrator":
            role = session.role

    # Check client header device override if present
    device_override = request.META.get('HTTP_X_DEVICE_TYPE')
    if device_override in ["Desktop", "Laptop", "Tablet", "Mobile"]:
        telemetry["device_type"] = device_override

    audit_entry = AuditLog.objects.create(
        user_id=user_id or "USR-100",
        user_name=user_name or "System User",
        role=role or "Employee",
        session_id=session_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details or {},
        client_ip=telemetry["client_ip"],
        hostname=telemetry["hostname"],
        device_type=telemetry["device_type"],
        os=telemetry["os"],
        browser=telemetry["browser"],
        user_agent=telemetry["user_agent"],
        login_timestamp=login_ts,
        logout_timestamp=logout_ts,
    )
    return audit_entry


def api_health(request: HttpRequest) -> JsonResponse:
    start = time.perf_counter()
    duration_ms = (time.perf_counter() - start) * 1000
    return JsonResponse({
        "status": "healthy",
        "service": "Meridian Asset Management API",
        "responseTimeMs": round(duration_ms, 3),
        "sub100ms": duration_ms < 100.0,
    })


@csrf_exempt
def api_assets(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        assets = Asset.objects.all().order_by("-created_at")
        return JsonResponse({"assets": [a.to_dict() for a in assets], "count": assets.count()})

    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            tag = data.get("assetCode") or data.get("assetTag") or f"AST-{int(time.time())}"
            name = data.get("currentDescription") or data.get("name") or tag
            category = data.get("currentCategory") or data.get("category") or "IT Hardware"
            department = data.get("currentDepartment") or data.get("department") or "Operations"

            asset = Asset.objects.create(
                tag=tag,
                name=name,
                category=category,
                department=department,
                status=data.get("status", "Active"),
                purchase_cost=data.get("purchaseCost", 0.0),
                current_value=data.get("currentValue", 0.0),
                assigned_to=data.get("submitter") or data.get("assignedTo", ""),
                location=data.get("currentLocation") or data.get("plant") or data.get("location", ""),
                # Extended fields
                asset_code=data.get("assetCode", tag),
                serial_number=data.get("serialNumber", ""),
                current_category=category,
                previous_category=data.get("previousCategory", ""),
                current_description=data.get("currentDescription", name),
                previous_description=data.get("previousDescription", ""),
                plant=data.get("plant", ""),
                building=data.get("building", ""),
                floor=data.get("floor", ""),
                current_location=data.get("currentLocation", ""),
                current_department=department,
                submitter=data.get("submitter", ""),
                asset_condition=data.get("assetCondition", "Good"),
                movement_reason=data.get("movementReason", ""),
                remarks=data.get("remarks", ""),
                asset_photo=data.get("assetPhoto", ""),
                asset_code_photo=data.get("assetCodePhoto", ""),
                id_card_picture=data.get("idCardPicture", ""),
            )

            # Auto-log ASSET_CREATE audit event
            user_id = data.get("userId") or request.META.get('HTTP_X_USER_ID', 'USR-ADMIN')
            user_name = data.get("userName") or request.META.get('HTTP_X_USER_NAME', 'Uttam Singh')
            role = data.get("role") or request.META.get('HTTP_X_USER_ROLE', 'Administrator')
            session_id = data.get("sessionId") or request.META.get('HTTP_X_SESSION_ID', '')

            record_audit_log(
                request=request,
                action="ASSET_CREATE",
                user_id=user_id,
                user_name=user_name,
                role=role,
                session_id=session_id,
                entity_type="Asset",
                entity_id=asset.asset_code or asset.tag,
                details={
                    "assetCode": asset.asset_code,
                    "name": asset.name,
                    "category": asset.category,
                    "department": asset.department,
                    "plant": asset.plant,
                    "status": asset.status,
                }
            )

            return JsonResponse(asset.to_dict(), status=201)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    return HttpResponseNotAllowed(["GET", "POST"])


@csrf_exempt
def api_asset_detail(request: HttpRequest, pk: int) -> JsonResponse:
    try:
        asset = Asset.objects.get(pk=pk)
    except Asset.DoesNotExist:
        return JsonResponse({"error": "Asset not found"}, status=404)

    if request.method == "GET":
        return JsonResponse(asset.to_dict())

    elif request.method in ["PUT", "PATCH"]:
        try:
            data = json.loads(request.body)
            old_details = {
                "name": asset.name,
                "category": asset.category,
                "status": asset.status,
                "department": asset.department,
                "location": asset.location,
            }

            for field, val in data.items():
                if hasattr(asset, field):
                    setattr(asset, field, val)
            asset.save()

            # Record ASSET_UPDATE audit event
            record_audit_log(
                request=request,
                action="ASSET_UPDATE",
                user_id=data.get("userId", "USR-ADMIN"),
                user_name=data.get("userName", "Uttam Singh"),
                role=data.get("role", "Administrator"),
                session_id=data.get("sessionId", ""),
                entity_type="Asset",
                entity_id=asset.asset_code or asset.tag,
                details={"previous": old_details, "updated": data}
            )
            return JsonResponse(asset.to_dict())
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    elif request.method == "DELETE":
        asset_code = asset.asset_code or asset.tag
        asset_name = asset.name
        asset.delete()

        # Record ASSET_DELETE audit event
        record_audit_log(
            request=request,
            action="ASSET_DELETE",
            user_id=request.META.get('HTTP_X_USER_ID', 'USR-ADMIN'),
            user_name=request.META.get('HTTP_X_USER_NAME', 'Uttam Singh'),
            role=request.META.get('HTTP_X_USER_ROLE', 'Administrator'),
            session_id=request.META.get('HTTP_X_SESSION_ID', ''),
            entity_type="Asset",
            entity_id=asset_code,
            details={"deletedAssetCode": asset_code, "name": asset_name}
        )

        return JsonResponse({"message": f"Asset {pk} deleted successfully"})

    return HttpResponseNotAllowed(["GET", "PUT", "PATCH", "DELETE"])


@csrf_exempt
def api_audit_log(request: HttpRequest) -> JsonResponse:
    """
    Endpoint to record audit actions from frontend or other services:
    LOGIN, LOGOUT, ASSET_CREATE, ASSET_UPDATE, ASSET_IMPORT, ASSET_EXPORT,
    ASSET_TRANSFER, ASSET_APPROVAL, ASSET_DELETE.
    """
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    try:
        data = json.loads(request.body)
        action = data.get("action", "ASSET_UPDATE").upper()
        user_id = data.get("userId") or request.META.get('HTTP_X_USER_ID', 'USR-ADMIN')
        user_name = data.get("userName") or request.META.get('HTTP_X_USER_NAME', 'Uttam Singh')
        role = data.get("role") or request.META.get('HTTP_X_USER_ROLE', 'Administrator')
        session_id = data.get("sessionId") or request.META.get('HTTP_X_SESSION_ID', '')
        entity_type = data.get("entityType", "Asset")
        entity_id = data.get("entityId", "")
        details = data.get("details", {})

        entry = record_audit_log(
            request=request,
            action=action,
            user_id=user_id,
            user_name=user_name,
            role=role,
            session_id=session_id,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
        )
        return JsonResponse({"status": "logged", "auditLog": entry.to_dict()}, status=201)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@csrf_exempt
def api_audit_logs(request: HttpRequest) -> JsonResponse:
    """
    Query immutable audit logs with comprehensive filtering and device telemetry.
    """
    if request.method != "GET":
        return HttpResponseNotAllowed(["GET"])

    qs = AuditLog.objects.all().order_by("-timestamp")

    # Filters
    action = request.GET.get("action")
    if action:
        qs = qs.filter(action=action.upper())

    device_type = request.GET.get("device_type")
    if device_type:
        qs = qs.filter(device_type=device_type)

    user_id = request.GET.get("user_id")
    if user_id:
        qs = qs.filter(user_id=user_id)

    role = request.GET.get("role")
    if role:
        qs = qs.filter(role=role)

    session_id = request.GET.get("session_id")
    if session_id:
        qs = qs.filter(session_id=session_id)

    search = request.GET.get("search")
    if search:
        qs = qs.filter(
            Q(user_name__icontains=search)
            | Q(user_id__icontains=search)
            | Q(entity_id__icontains=search)
            | Q(action__icontains=search)
            | Q(client_ip__icontains=search)
            | Q(hostname__icontains=search)
            | Q(browser__icontains=search)
            | Q(os__icontains=search)
        )

    # Date range filters
    date_from = request.GET.get("date_from")
    if date_from:
        try:
            dt_from = datetime.fromisoformat(date_from)
            qs = qs.filter(timestamp__gte=dt_from)
        except ValueError:
            pass

    date_to = request.GET.get("date_to")
    if date_to:
        try:
            dt_to = datetime.fromisoformat(date_to)
            qs = qs.filter(timestamp__lte=dt_to)
        except ValueError:
            pass

    total_count = qs.count()

    # Pagination
    try:
        limit = min(int(request.GET.get("limit", 50)), 500)
    except ValueError:
        limit = 50

    try:
        offset = max(int(request.GET.get("offset", 0)), 0)
    except ValueError:
        offset = 0

    page_logs = qs[offset : offset + limit]

    # Metrics Breakdown
    action_counts = dict(
        AuditLog.objects.values("action")
        .annotate(cnt=Count("id"))
        .values_list("action", "cnt")
    )
    device_counts = dict(
        AuditLog.objects.values("device_type")
        .annotate(cnt=Count("id"))
        .values_list("device_type", "cnt")
    )

    return JsonResponse({
        "totalCount": total_count,
        "limit": limit,
        "offset": offset,
        "auditLogs": [l.to_dict() for l in page_logs],
        "actionBreakdown": action_counts,
        "deviceBreakdown": device_counts,
    })


@csrf_exempt
def api_session_login(request: HttpRequest) -> JsonResponse:
    """
    Handles user login, registers session, auto-detects device, and records LOGIN audit event.
    """
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    try:
        data = json.loads(request.body) if request.body else {}
        user_id = data.get("userId") or "USR-101"
        user_name = data.get("userName") or "Uttam Singh"
        role = data.get("role") or "Administrator"
        session_id = data.get("sessionId") or f"SES-{uuid.uuid4().hex[:12].upper()}"

        telemetry = parse_device_and_browser(request)

        # Allow client header override
        client_device = request.META.get('HTTP_X_DEVICE_TYPE') or data.get("deviceType")
        if client_device in ["Desktop", "Laptop", "Tablet", "Mobile"]:
            telemetry["device_type"] = client_device

        session = UserSession.objects.create(
            session_id=session_id,
            user_id=user_id,
            user_name=user_name,
            role=role,
            is_active=True,
            client_ip=telemetry["client_ip"],
            hostname=telemetry["hostname"],
            device_type=telemetry["device_type"],
            os=telemetry["os"],
            browser=telemetry["browser"],
            user_agent=telemetry["user_agent"],
        )

        # Log LOGIN event
        audit_entry = record_audit_log(
            request=request,
            action="LOGIN",
            user_id=user_id,
            user_name=user_name,
            role=role,
            session_id=session_id,
            entity_type="Session",
            entity_id=session_id,
            details={"authMethod": data.get("authMethod", "SSO/Password"), "loginTime": session.login_timestamp.isoformat()},
            login_ts=session.login_timestamp,
        )

        return JsonResponse({
            "status": "authenticated",
            "session": session.to_dict(),
            "auditLogId": audit_entry.id,
        }, status=201)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@csrf_exempt
def api_session_logout(request: HttpRequest) -> JsonResponse:
    """
    Handles user logout, closes session, records logout timestamp, and logs LOGOUT audit event.
    """
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    try:
        data = json.loads(request.body) if request.body else {}
        session_id = data.get("sessionId") or request.META.get('HTTP_X_SESSION_ID')

        session = None
        if session_id:
            session = UserSession.objects.filter(session_id=session_id).first()

        now = dj_timezone.now()
        if session:
            session.logout_timestamp = now
            session.is_active = False
            session.save()
            user_id = session.user_id
            user_name = session.user_name
            role = session.role
            login_ts = session.login_timestamp
        else:
            user_id = data.get("userId", "USR-101")
            user_name = data.get("userName", "Uttam Singh")
            role = data.get("role", "Administrator")
            login_ts = None
            session_id = session_id or f"SES-{uuid.uuid4().hex[:12].upper()}"

        audit_entry = record_audit_log(
            request=request,
            action="LOGOUT",
            user_id=user_id,
            user_name=user_name,
            role=role,
            session_id=session_id,
            entity_type="Session",
            entity_id=session_id,
            details={"logoutTime": now.isoformat()},
            login_ts=login_ts,
            logout_ts=now,
        )

        return JsonResponse({
            "status": "logged_out",
            "sessionId": session_id,
            "logoutTimestamp": now.isoformat(),
            "auditLogId": audit_entry.id,
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@csrf_exempt
def api_audit_transfer(request: HttpRequest) -> JsonResponse:
    """
    Records an ASSET_TRANSFER event (custody, location, or department shift).
    """
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    try:
        data = json.loads(request.body)
        asset_code = data.get("assetCode") or data.get("entityId")
        if not asset_code:
            return JsonResponse({"error": "assetCode is required"}, status=400)

        # Update physical asset if exists in DB
        asset = Asset.objects.filter(Q(asset_code=asset_code) | Q(tag=asset_code)).first()
        from_dept = data.get("fromDepartment", "")
        to_dept = data.get("toDepartment", "")
        from_loc = data.get("fromLocation", "")
        to_loc = data.get("toLocation", "")
        new_submitter = data.get("newAssignee", "")

        if asset:
            if not from_dept:
                from_dept = asset.department
            if not from_loc:
                from_loc = asset.location
            if to_dept:
                asset.department = to_dept
                asset.current_department = to_dept
            if to_loc:
                asset.location = to_loc
                asset.current_location = to_loc
            if new_submitter:
                asset.assigned_to = new_submitter
                asset.submitter = new_submitter
            asset.save()

        entry = record_audit_log(
            request=request,
            action="ASSET_TRANSFER",
            user_id=data.get("userId", "USR-ADMIN"),
            user_name=data.get("userName", "Uttam Singh"),
            role=data.get("role", "Administrator"),
            session_id=data.get("sessionId", ""),
            entity_type="Asset",
            entity_id=asset_code,
            details={
                "assetCode": asset_code,
                "fromDepartment": from_dept,
                "toDepartment": to_dept,
                "fromLocation": from_loc,
                "toLocation": to_loc,
                "newAssignee": new_submitter,
                "reason": data.get("reason", "Internal transfer request"),
            }
        )

        return JsonResponse({"status": "transferred", "auditLog": entry.to_dict()}, status=201)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@csrf_exempt
def api_audit_approval(request: HttpRequest) -> JsonResponse:
    """
    Records an ASSET_APPROVAL event (procurement, retirement, transfer authorization).
    """
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    try:
        data = json.loads(request.body)
        asset_code = data.get("assetCode") or data.get("entityId", "")
        decision = data.get("decision", "Approved")  # Approved / Rejected
        approval_type = data.get("approvalType", "Custody Transfer")

        entry = record_audit_log(
            request=request,
            action="ASSET_APPROVAL",
            user_id=data.get("userId", "USR-ADMIN"),
            user_name=data.get("userName", "Uttam Singh"),
            role=data.get("role", "Administrator"),
            session_id=data.get("sessionId", ""),
            entity_type="Asset",
            entity_id=asset_code,
            details={
                "assetCode": asset_code,
                "decision": decision,
                "approvalType": approval_type,
                "comments": data.get("comments", "Authorized by compliance officer"),
            }
        )

        return JsonResponse({"status": "recorded", "auditLog": entry.to_dict()}, status=201)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


def api_metrics(request: HttpRequest) -> JsonResponse:
    assets = Asset.objects.all()
    total_val = sum(float(a.current_value) for a in assets)
    active = assets.filter(status="Active").count()
    maintenance = assets.filter(status="Maintenance").count()
    reserved = assets.filter(status="Reserved").count()
    retired = assets.filter(status="Retired").count()

    return JsonResponse({
        "totalAssets": assets.count(),
        "totalValuation": total_val,
        "activeCount": active,
        "maintenanceCount": maintenance,
        "reservedCount": reserved,
        "retiredCount": retired,
        "totalAuditEvents": AuditLog.objects.count(),
    })
