
import json
from datetime import datetime, timezone
from django.http import JsonResponse, HttpRequest, HttpResponseNotAllowed
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q, Count, ProtectedError
from django.utils import timezone as dj_timezone

from .models import (
    Company, Plant, Building, Floor, Department, Area, AssetLocation,
    HierarchyAuditLog, Role, Permission, RolePermission, UserRole,
    UserHierarchyScope, ApprovalAssignment,
)


def _is_superuser(request: HttpRequest) -> bool:
    if request.headers.get("X-Superuser") == "true":
        return True
    if request.headers.get("X-User-Role") in ("Superuser", "Super User"):
        return True
    if request.GET.get("superuser") == "true":
        return True
    req_user_id = request.headers.get("X-User-Id")
    if req_user_id:
        try:
            from dashboard.models import AppUser
            u = AppUser.objects.filter(user_id=req_user_id).first()
            if u and u.is_superuser:
                return True
        except Exception:
            pass
    return False


def _require_superuser(request: HttpRequest) -> JsonResponse | None:
    if not _is_superuser(request):
        return JsonResponse(
            {"error": "ACCESS FORBIDDEN: Super User access required."}, status=403
        )
    return None


def _client_meta(request: HttpRequest) -> dict:
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    client_ip = None
    if x_forwarded_for:
        client_ip = x_forwarded_for.split(",")[0].strip()
    else:
        client_ip = request.META.get("REMOTE_ADDR")
    return {
        "client_ip": client_ip,
        "hostname": request.META.get("REMOTE_HOST", ""),
        "device_type": request.META.get("HTTP_X_DEVICE_TYPE", "Desktop"),
        "os": request.META.get("HTTP_X_OS", ""),
        "browser": request.META.get("HTTP_X_BROWSER", ""),
        "user_agent": request.META.get("HTTP_USER_AGENT", ""),
    }


def _record_audit(
    request: HttpRequest,
    action: str,
    user_id: str,
    user_name: str,
    role: str,
    entity_type: str,
    entity_id: str,
    old_value: dict = None,
    new_value: dict = None,
    reason: str = "",
) -> HierarchyAuditLog:
    meta = _client_meta(request)
    return HierarchyAuditLog.objects.create(
        user_id=user_id or "USR-SUPERUSER",
        user_name=user_name or "Superuser",
        role=role or "Superuser",
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=old_value,
        new_value=new_value,
        reason=reason,
        ip_address=meta["client_ip"],
        client_ip=meta["client_ip"],
        hostname=meta["hostname"],
        device_type=meta["device_type"],
        os=meta["os"],
        browser=meta["browser"],
        user_agent=meta["user_agent"],
    )


def _get_user_id(request: HttpRequest) -> str:
    return (
        request.headers.get("X-User-Id")
        or request.headers.get("X-User-ID")
        or request.GET.get("user_id")
        or "USR-SUPERUSER"
    )


def _get_user_name(request: HttpRequest) -> str:
    return (
        request.headers.get("X-User-Name")
        or request.GET.get("user_name")
        or "Superuser"
    )


def _get_user_role(request: HttpRequest) -> str:
    return (
        request.headers.get("X-User-Role")
        or request.GET.get("user_role")
        or "Superuser"
    )


# COMPANY CRUD
@csrf_exempt
def api_companies(request: HttpRequest) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    if request.method == "GET":
        include_archived = request.GET.get("includeArchived") == "true"
        qs = Company.objects.all()
        if not include_archived:
            qs = qs.filter(is_archived=False)
        search = request.GET.get("search", "")
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search))
        qs = qs.order_by("-created_at")
        return JsonResponse({
            "companies": [c.to_dict() for c in qs],
            "count": qs.count(),
        })
    elif request.method == "POST":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        name = (data.get("name") or "").strip()
        code = (data.get("code") or "").strip()
        description = data.get("description", "") or ""
        if not name:
            return JsonResponse({"error": "Company name is required"}, status=400)
        if Company.objects.filter(name=name, is_archived=False).exists():
            return JsonResponse({"error": "Company already exists"}, status=409)
        company = Company.objects.create(
            name=name, code=code, description=description,
            created_by=_get_user_id(request),
        )
        _record_audit(request, "CREATE", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "Company", str(company.id),
            None, company.to_dict(), reason=data.get("reason", ""))
        return JsonResponse({"company": company.to_dict()}, status=201)
    return HttpResponseNotAllowed(["GET", "POST"])


@csrf_exempt
def api_company_detail(request: HttpRequest, pk: int) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    try:
        company = Company.objects.get(pk=pk)
    except Company.DoesNotExist:
        return JsonResponse({"error": "Company not found"}, status=404)
    if request.method == "GET":
        return JsonResponse({"company": company.to_dict()})
    elif request.method == "PATCH":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        old_value = company.to_dict()
        if "name" in data:
            new_name = (data["name"] or "").strip()
            if new_name and new_name != company.name:
                if Company.objects.filter(name=new_name, is_archived=False).exclude(pk=pk).exists():
                    return JsonResponse({"error": "Company already exists"}, status=409)
                company.name = new_name
        if "code" in data:
            company.code = data["code"] or ""
        if "description" in data:
            company.description = data["description"] or ""
        company.save()
        _record_audit(request, "UPDATE", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "Company", str(company.id),
            old_value, company.to_dict(), reason=data.get("reason", ""))
        return JsonResponse({"company": company.to_dict()})
    elif request.method == "POST":
        action = (request.GET.get("action") or "").lower()
        if action == "archive":
            if company.is_archived:
                return JsonResponse({"error": "Company already archived"}, status=400)
            if company.plants.filter(is_archived=False).exists():
                return JsonResponse({"error": "Cannot archive: Company has active plants"}, status=400)
            company.is_archived = True
            company.save()
            _record_audit(request, "ARCHIVE", _get_user_id(request), _get_user_name(request),
                _get_user_role(request), "Company", str(company.id),
                None, {"isArchived": True}, reason=request.GET.get("reason", ""))
            return JsonResponse({"company": company.to_dict(), "status": "archived"})
        elif action == "restore":
            if not company.is_archived:
                return JsonResponse({"error": "Company is not archived"}, status=400)
            company.is_archived = False
            company.save()
            _record_audit(request, "RESTORE", _get_user_id(request), _get_user_name(request),
                _get_user_role(request), "Company", str(company.id),
                None, {"isArchived": False}, reason=request.GET.get("reason", ""))
            return JsonResponse({"company": company.to_dict(), "status": "restored"})
        elif action == "delete":
            if company.plants.exists():
                return JsonResponse({"error": "Cannot delete: Company has plants"}, status=400)
            old_value = company.to_dict()
            company.delete()
            _record_audit(request, "DELETE", _get_user_id(request), _get_user_name(request),
                _get_user_role(request), "Company", str(company.id),
                old_value, None, reason=request.GET.get("reason", ""))
            return JsonResponse({"status": "deleted", "id": pk})
    return HttpResponseNotAllowed(["GET", "PATCH", "POST"])



# PLANT CRUD
@csrf_exempt
def api_plants(request: HttpRequest) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    if request.method == "GET":
        company_id = request.GET.get("companyId")
        include_archived = request.GET.get("includeArchived") == "true"
        qs = Plant.objects.all()
        if company_id:
            qs = qs.filter(company_id=company_id)
        if not include_archived:
            qs = qs.filter(is_archived=False)
        search = request.GET.get("search", "")
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search))
        qs = qs.select_related("company").order_by("-created_at")
        return JsonResponse({
            "plants": [p.to_dict() for p in qs],
            "count": qs.count(),
        })
    elif request.method == "POST":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        company_id = data.get("companyId")
        name = (data.get("name") or "").strip()
        code = (data.get("code") or "").strip()
        description = data.get("description", "") or ""
        if not company_id:
            return JsonResponse({"error": "Company is required"}, status=400)
        if not name:
            return JsonResponse({"error": "Plant name is required"}, status=400)
        try:
            company = Company.objects.get(pk=company_id, is_archived=False)
        except Company.DoesNotExist:
            return JsonResponse({"error": "Parent Company not found or archived"}, status=404)
        if Plant.objects.filter(company=company, name=name, is_archived=False).exists():
            return JsonResponse({"error": "Plant already exists under this company"}, status=409)
        plant = Plant.objects.create(
            company=company, name=name, code=code, description=description,
            created_by=_get_user_id(request),
        )
        _record_audit(request, "CREATE", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "Plant", str(plant.id),
            None, plant.to_dict(), reason=data.get("reason", ""))
        return JsonResponse({"plant": plant.to_dict()}, status=201)
    return HttpResponseNotAllowed(["GET", "POST"])


@csrf_exempt
def api_plant_detail(request: HttpRequest, pk: int) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    try:
        plant = Plant.objects.select_related("company").get(pk=pk)
    except Plant.DoesNotExist:
        return JsonResponse({"error": "Plant not found"}, status=404)
    if request.method == "GET":
        return JsonResponse({"plant": plant.to_dict()})
    elif request.method == "PATCH":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        old_value = plant.to_dict()
        if "name" in data:
            new_name = (data["name"] or "").strip()
            if new_name and new_name != plant.name:
                if Plant.objects.filter(company=plant.company, name=new_name, is_archived=False).exclude(pk=pk).exists():
                    return JsonResponse({"error": "Plant already exists"}, status=409)
                plant.name = new_name
        if "code" in data:
            plant.code = data["code"] or ""
        if "description" in data:
            plant.description = data["description"] or ""
        plant.save()
        _record_audit(request, "UPDATE", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "Plant", str(plant.id),
            old_value, plant.to_dict(), reason=data.get("reason", ""))
        return JsonResponse({"plant": plant.to_dict()})
    elif request.method == "POST":
        action = (request.GET.get("action") or "").lower()
        if action == "archive":
            if plant.is_archived:
                return JsonResponse({"error": "Plant already archived"}, status=400)
            if plant.buildings.filter(is_archived=False).exists():
                return JsonResponse({"error": "Cannot archive: Plant has active buildings"}, status=400)
            plant.is_archived = True
            plant.save()
            _record_audit(request, "ARCHIVE", _get_user_id(request), _get_user_name(request),
                _get_user_role(request), "Plant", str(plant.id),
                None, {"isArchived": True}, reason=request.GET.get("reason", ""))
            return JsonResponse({"plant": plant.to_dict(), "status": "archived"})
        elif action == "restore":
            if not plant.is_archived:
                return JsonResponse({"error": "Plant is not archived"}, status=400)
            plant.is_archived = False
            plant.save()
            _record_audit(request, "RESTORE", _get_user_id(request), _get_user_name(request),
                _get_user_role(request), "Plant", str(plant.id),
                None, {"isArchived": False}, reason=request.GET.get("reason", ""))
            return JsonResponse({"plant": plant.to_dict(), "status": "restored"})
        elif action == "delete":
            if plant.buildings.exists():
                return JsonResponse({"error": "Cannot delete: Plant has buildings"}, status=400)
            old_value = plant.to_dict()
            plant.delete()
            _record_audit(request, "DELETE", _get_user_id(request), _get_user_name(request),
                _get_user_role(request), "Plant", str(plant.id),
                old_value, None, reason=request.GET.get("reason", ""))
            return JsonResponse({"status": "deleted", "id": pk})
    return HttpResponseNotAllowed(["GET", "PATCH", "POST"])



# BUILDING CRUD
@csrf_exempt
def api_buildings(request: HttpRequest) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    if request.method == "GET":
        plant_id = request.GET.get("plantId")
        include_archived = request.GET.get("includeArchived") == "true"
        qs = Building.objects.all()
        if plant_id:
            qs = qs.filter(plant_id=plant_id)
        if not include_archived:
            qs = qs.filter(is_archived=False)
        search = request.GET.get("search", "")
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search))
        qs = qs.select_related("plant__company").order_by("-created_at")
        return JsonResponse({
            "buildings": [b.to_dict() for b in qs],
            "count": qs.count(),
        })
    elif request.method == "POST":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        plant_id = data.get("plantId")
        name = (data.get("name") or "").strip()
        code = (data.get("code") or "").strip()
        description = data.get("description", "") or ""
        if not plant_id:
            return JsonResponse({"error": "Plant is required"}, status=400)
        if not name:
            return JsonResponse({"error": "Building name is required"}, status=400)
        try:
            plant = Plant.objects.get(pk=plant_id, is_archived=False)
        except Plant.DoesNotExist:
            return JsonResponse({"error": "Parent Plant not found or archived"}, status=404)
        if Building.objects.filter(plant=plant, name=name, is_archived=False).exists():
            return JsonResponse({"error": "Building already exists under this plant"}, status=409)
        building = Building.objects.create(
            plant=plant, name=name, code=code, description=description,
            created_by=_get_user_id(request),
        )
        _record_audit(request, "CREATE", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "Building", str(building.id),
            None, building.to_dict(), reason=data.get("reason", ""))
        return JsonResponse({"building": building.to_dict()}, status=201)
    return HttpResponseNotAllowed(["GET", "POST"])


@csrf_exempt
def api_building_detail(request: HttpRequest, pk: int) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    try:
        building = Building.objects.select_related("plant__company").get(pk=pk)
    except Building.DoesNotExist:
        return JsonResponse({"error": "Building not found"}, status=404)
    if request.method == "GET":
        return JsonResponse({"building": building.to_dict()})
    elif request.method == "PATCH":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        old_value = building.to_dict()
        if "name" in data:
            new_name = (data["name"] or "").strip()
            if new_name and new_name != building.name:
                if Building.objects.filter(plant=building.plant, name=new_name, is_archived=False).exclude(pk=pk).exists():
                    return JsonResponse({"error": "Building already exists"}, status=409)
                building.name = new_name
        if "code" in data:
            building.code = data["code"] or ""
        if "description" in data:
            building.description = data["description"] or ""
        building.save()
        _record_audit(request, "UPDATE", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "Building", str(building.id),
            old_value, building.to_dict(), reason=data.get("reason", ""))
        return JsonResponse({"building": building.to_dict()})
    elif request.method == "POST":
        action = (request.GET.get("action") or "").lower()
        if action == "archive":
            if building.is_archived:
                return JsonResponse({"error": "Building already archived"}, status=400)
            if building.floors.filter(is_archived=False).exists():
                return JsonResponse({"error": "Cannot archive: Building has active floors"}, status=400)
            building.is_archived = True
            building.save()
            _record_audit(request, "ARCHIVE", _get_user_id(request), _get_user_name(request),
                _get_user_role(request), "Building", str(building.id),
                None, {"isArchived": True}, reason=request.GET.get("reason", ""))
            return JsonResponse({"building": building.to_dict(), "status": "archived"})
        elif action == "restore":
            if not building.is_archived:
                return JsonResponse({"error": "Building is not archived"}, status=400)
            building.is_archived = False
            building.save()
            _record_audit(request, "RESTORE", _get_user_id(request), _get_user_name(request),
                _get_user_role(request), "Building", str(building.id),
                None, {"isArchived": False}, reason=request.GET.get("reason", ""))
            return JsonResponse({"building": building.to_dict(), "status": "restored"})
        elif action == "delete":
            if building.floors.exists():
                return JsonResponse({"error": "Cannot delete: Building has floors"}, status=400)
            old_value = building.to_dict()
            building.delete()
            _record_audit(request, "DELETE", _get_user_id(request), _get_user_name(request),
                _get_user_role(request), "Building", str(building.id),
                old_value, None, reason=request.GET.get("reason", ""))
            return JsonResponse({"status": "deleted", "id": pk})
    return HttpResponseNotAllowed(["GET", "PATCH", "POST"])



# FLOOR CRUD
@csrf_exempt
def api_floors(request: HttpRequest) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    if request.method == "GET":
        building_id = request.GET.get("buildingId")
        include_archived = request.GET.get("includeArchived") == "true"
        qs = Floor.objects.all()
        if building_id:
            qs = qs.filter(building_id=building_id)
        if not include_archived:
            qs = qs.filter(is_archived=False)
        search = request.GET.get("search", "")
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search))
        qs = qs.select_related("building__plant__company").order_by("-created_at")
        return JsonResponse({
            "floors": [f.to_dict() for f in qs],
            "count": qs.count(),
        })
    elif request.method == "POST":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        building_id = data.get("buildingId")
        name = (data.get("name") or "").strip()
        code = (data.get("code") or "").strip()
        description = data.get("description", "") or ""
        if not building_id:
            return JsonResponse({"error": "Building is required"}, status=400)
        if not name:
            return JsonResponse({"error": "Floor name is required"}, status=400)
        try:
            building = Building.objects.get(pk=building_id, is_archived=False)
        except Building.DoesNotExist:
            return JsonResponse({"error": "Parent Building not found or archived"}, status=404)
        if Floor.objects.filter(building=building, name=name, is_archived=False).exists():
            return JsonResponse({"error": "Floor already exists under this building"}, status=409)
        floor = Floor.objects.create(
            building=building, name=name, code=code, description=description,
            created_by=_get_user_id(request),
        )
        _record_audit(request, "CREATE", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "Floor", str(floor.id),
            None, floor.to_dict(), reason=data.get("reason", ""))
        return JsonResponse({"floor": floor.to_dict()}, status=201)
    return HttpResponseNotAllowed(["GET", "POST"])


@csrf_exempt
def api_floor_detail(request: HttpRequest, pk: int) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    try:
        floor = Floor.objects.select_related("building__plant__company").get(pk=pk)
    except Floor.DoesNotExist:
        return JsonResponse({"error": "Floor not found"}, status=404)
    if request.method == "GET":
        return JsonResponse({"floor": floor.to_dict()})
    elif request.method == "PATCH":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        old_value = floor.to_dict()
        if "name" in data:
            new_name = (data["name"] or "").strip()
            if new_name and new_name != floor.name:
                if Floor.objects.filter(building=floor.building, name=new_name, is_archived=False).exclude(pk=pk).exists():
                    return JsonResponse({"error": "Floor already exists"}, status=409)
                floor.name = new_name
        if "code" in data:
            floor.code = data["code"] or ""
        if "description" in data:
            floor.description = data["description"] or ""
        floor.save()
        _record_audit(request, "UPDATE", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "Floor", str(floor.id),
            old_value, floor.to_dict(), reason=data.get("reason", ""))
        return JsonResponse({"floor": floor.to_dict()})
    elif request.method == "POST":
        action = (request.GET.get("action") or "").lower()
        if action == "archive":
            if floor.is_archived:
                return JsonResponse({"error": "Floor already archived"}, status=400)
            if floor.departments.filter(is_archived=False).exists():
                return JsonResponse({"error": "Cannot archive: Floor has active departments"}, status=400)
            floor.is_archived = True
            floor.save()
            _record_audit(request, "ARCHIVE", _get_user_id(request), _get_user_name(request),
                _get_user_role(request), "Floor", str(floor.id),
                None, {"isArchived": True}, reason=request.GET.get("reason", ""))
            return JsonResponse({"floor": floor.to_dict(), "status": "archived"})
        elif action == "restore":
            if not floor.is_archived:
                return JsonResponse({"error": "Floor is not archived"}, status=400)
            floor.is_archived = False
            floor.save()
            _record_audit(request, "RESTORE", _get_user_id(request), _get_user_name(request),
                _get_user_role(request), "Floor", str(floor.id),
                None, {"isArchived": False}, reason=request.GET.get("reason", ""))
            return JsonResponse({"floor": floor.to_dict(), "status": "restored"})
        elif action == "delete":
            if floor.departments.exists():
                return JsonResponse({"error": "Cannot delete: Floor has departments"}, status=400)
            old_value = floor.to_dict()
            floor.delete()
            _record_audit(request, "DELETE", _get_user_id(request), _get_user_name(request),
                _get_user_role(request), "Floor", str(floor.id),
                old_value, None, reason=request.GET.get("reason", ""))
            return JsonResponse({"status": "deleted", "id": pk})
    return HttpResponseNotAllowed(["GET", "PATCH", "POST"])



# DEPARTMENT CRUD
@csrf_exempt
def api_departments(request: HttpRequest) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    if request.method == "GET":
        floor_id = request.GET.get("floorId")
        include_archived = request.GET.get("includeArchived") == "true"
        qs = Department.objects.all()
        if floor_id:
            qs = qs.filter(floor_id=floor_id)
        if not include_archived:
            qs = qs.filter(is_archived=False)
        search = request.GET.get("search", "")
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search))
        qs = qs.select_related("floor__building__plant__company").order_by("-created_at")
        return JsonResponse({
            "departments": [d.to_dict() for d in qs],
            "count": qs.count(),
        })
    elif request.method == "POST":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        floor_id = data.get("floorId")
        name = (data.get("name") or "").strip()
        code = (data.get("code") or "").strip()
        description = data.get("description", "") or ""
        if not floor_id:
            return JsonResponse({"error": "Floor is required"}, status=400)
        if not name:
            return JsonResponse({"error": "Department name is required"}, status=400)
        try:
            floor = Floor.objects.get(pk=floor_id, is_archived=False)
        except Floor.DoesNotExist:
            return JsonResponse({"error": "Parent Floor not found or archived"}, status=404)
        if Department.objects.filter(floor=floor, name=name, is_archived=False).exists():
            return JsonResponse({"error": "Department already exists under this floor"}, status=409)
        department = Department.objects.create(
            floor=floor, name=name, code=code, description=description,
            created_by=_get_user_id(request),
        )
        _record_audit(request, "CREATE", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "Department", str(department.id),
            None, department.to_dict(), reason=data.get("reason", ""))
        return JsonResponse({"department": department.to_dict()}, status=201)
    return HttpResponseNotAllowed(["GET", "POST"])


@csrf_exempt
def api_department_detail(request: HttpRequest, pk: int) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    try:
        department = Department.objects.select_related("floor__building__plant__company").get(pk=pk)
    except Department.DoesNotExist:
        return JsonResponse({"error": "Department not found"}, status=404)
    if request.method == "GET":
        return JsonResponse({"department": department.to_dict()})
    elif request.method == "PATCH":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        old_value = department.to_dict()
        if "name" in data:
            new_name = (data["name"] or "").strip()
            if new_name and new_name != department.name:
                if Department.objects.filter(floor=department.floor, name=new_name, is_archived=False).exclude(pk=pk).exists():
                    return JsonResponse({"error": "Department already exists"}, status=409)
                department.name = new_name
        if "code" in data:
            department.code = data["code"] or ""
        if "description" in data:
            department.description = data["description"] or ""
        department.save()
        _record_audit(request, "UPDATE", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "Department", str(department.id),
            old_value, department.to_dict(), reason=data.get("reason", ""))
        return JsonResponse({"department": department.to_dict()})
    elif request.method == "POST":
        action = (request.GET.get("action") or "").lower()
        if action == "archive":
            if department.is_archived:
                return JsonResponse({"error": "Department already archived"}, status=400)
            if department.areas.filter(is_archived=False).exists():
                return JsonResponse({"error": "Cannot archive: Department has active areas"}, status=400)
            department.is_archived = True
            department.save()
            _record_audit(request, "ARCHIVE", _get_user_id(request), _get_user_name(request),
                _get_user_role(request), "Department", str(department.id),
                None, {"isArchived": True}, reason=request.GET.get("reason", ""))
            return JsonResponse({"department": department.to_dict(), "status": "archived"})
        elif action == "restore":
            if not department.is_archived:
                return JsonResponse({"error": "Department is not archived"}, status=400)
            department.is_archived = False
            department.save()
            _record_audit(request, "RESTORE", _get_user_id(request), _get_user_name(request),
                _get_user_role(request), "Department", str(department.id),
                None, {"isArchived": False}, reason=request.GET.get("reason", ""))
            return JsonResponse({"department": department.to_dict(), "status": "restored"})
        elif action == "delete":
            if department.areas.exists():
                return JsonResponse({"error": "Cannot delete: Department has areas"}, status=400)
            old_value = department.to_dict()
            department.delete()
            _record_audit(request, "DELETE", _get_user_id(request), _get_user_name(request),
                _get_user_role(request), "Department", str(department.id),
                old_value, None, reason=request.GET.get("reason", ""))
            return JsonResponse({"status": "deleted", "id": pk})
    return HttpResponseNotAllowed(["GET", "PATCH", "POST"])



# AREA CRUD
@csrf_exempt
def api_areas(request: HttpRequest) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    if request.method == "GET":
        department_id = request.GET.get("departmentId")
        include_archived = request.GET.get("includeArchived") == "true"
        qs = Area.objects.all()
        if department_id:
            qs = qs.filter(department_id=department_id)
        if not include_archived:
            qs = qs.filter(is_archived=False)
        search = request.GET.get("search", "")
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search))
        qs = qs.select_related("department__floor__building__plant__company").order_by("-created_at")
        return JsonResponse({
            "areas": [a.to_dict() for a in qs],
            "count": qs.count(),
        })
    elif request.method == "POST":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        department_id = data.get("departmentId")
        name = (data.get("name") or "").strip()
        code = (data.get("code") or "").strip()
        description = data.get("description", "") or ""
        if not department_id:
            return JsonResponse({"error": "Department is required"}, status=400)
        if not name:
            return JsonResponse({"error": "Area name is required"}, status=400)
        try:
            department = Department.objects.get(pk=department_id, is_archived=False)
        except Department.DoesNotExist:
            return JsonResponse({"error": "Parent Department not found or archived"}, status=404)
        if Area.objects.filter(department=department, name=name, is_archived=False).exists():
            return JsonResponse({"error": "Area already exists under this department"}, status=409)
        area = Area.objects.create(
            department=department, name=name, code=code, description=description,
            created_by=_get_user_id(request),
        )
        _record_audit(request, "CREATE", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "Area", str(area.id),
            None, area.to_dict(), reason=data.get("reason", ""))
        return JsonResponse({"area": area.to_dict()}, status=201)
    return HttpResponseNotAllowed(["GET", "POST"])


@csrf_exempt
def api_area_detail(request: HttpRequest, pk: int) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    try:
        area = Area.objects.select_related("department__floor__building__plant__company").get(pk=pk)
    except Area.DoesNotExist:
        return JsonResponse({"error": "Area not found"}, status=404)
    if request.method == "GET":
        return JsonResponse({"area": area.to_dict()})
    elif request.method == "PATCH":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        old_value = area.to_dict()
        if "name" in data:
            new_name = (data["name"] or "").strip()
            if new_name and new_name != area.name:
                if Area.objects.filter(department=area.department, name=new_name, is_archived=False).exclude(pk=pk).exists():
                    return JsonResponse({"error": "Area already exists"}, status=409)
                area.name = new_name
        if "code" in data:
            area.code = data["code"] or ""
        if "description" in data:
            area.description = data["description"] or ""
        area.save()
        _record_audit(request, "UPDATE", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "Area", str(area.id),
            old_value, area.to_dict(), reason=data.get("reason", ""))
        return JsonResponse({"area": area.to_dict()})
    elif request.method == "POST":
        action = (request.GET.get("action") or "").lower()
        if action == "archive":
            if area.is_archived:
                return JsonResponse({"error": "Area already archived"}, status=400)
            if area.locations.filter(is_archived=False).exists():
                return JsonResponse({"error": "Cannot archive: Area has active locations"}, status=400)
            area.is_archived = True
            area.save()
            _record_audit(request, "ARCHIVE", _get_user_id(request), _get_user_name(request),
                _get_user_role(request), "Area", str(area.id),
                None, {"isArchived": True}, reason=request.GET.get("reason", ""))
            return JsonResponse({"area": area.to_dict(), "status": "archived"})
        elif action == "restore":
            if not area.is_archived:
                return JsonResponse({"error": "Area is not archived"}, status=400)
            area.is_archived = False
            area.save()
            _record_audit(request, "RESTORE", _get_user_id(request), _get_user_name(request),
                _get_user_role(request), "Area", str(area.id),
                None, {"isArchived": False}, reason=request.GET.get("reason", ""))
            return JsonResponse({"area": area.to_dict(), "status": "restored"})
        elif action == "delete":
            if area.locations.exists():
                return JsonResponse({"error": "Cannot delete: Area has locations"}, status=400)
            old_value = area.to_dict()
            area.delete()
            _record_audit(request, "DELETE", _get_user_id(request), _get_user_name(request),
                _get_user_role(request), "Area", str(area.id),
                old_value, None, reason=request.GET.get("reason", ""))
            return JsonResponse({"status": "deleted", "id": pk})
    return HttpResponseNotAllowed(["GET", "PATCH", "POST"])



# ASSET LOCATION CRUD
@csrf_exempt
def api_locations(request: HttpRequest) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    if request.method == "GET":
        area_id = request.GET.get("areaId")
        include_archived = request.GET.get("includeArchived") == "true"
        qs = AssetLocation.objects.all()
        if area_id:
            qs = qs.filter(area_id=area_id)
        if not include_archived:
            qs = qs.filter(is_archived=False)
        search = request.GET.get("search", "")
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search))
        qs = qs.select_related("area__department__floor__building__plant__company").order_by("-created_at")
        return JsonResponse({
            "locations": [l.to_dict() for l in qs],
            "count": qs.count(),
        })
    elif request.method == "POST":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        area_id = data.get("areaId")
        name = (data.get("name") or "").strip()
        code = (data.get("code") or "").strip()
        description = data.get("description", "") or ""
        if not area_id:
            return JsonResponse({"error": "Area is required"}, status=400)
        if not name:
            return JsonResponse({"error": "Location name is required"}, status=400)
        try:
            area = Area.objects.get(pk=area_id, is_archived=False)
        except Area.DoesNotExist:
            return JsonResponse({"error": "Parent Area not found or archived"}, status=404)
        if AssetLocation.objects.filter(area=area, name=name, is_archived=False).exists():
            return JsonResponse({"error": "Location already exists under this area"}, status=409)
        location = AssetLocation.objects.create(
            area=area, name=name, code=code, description=description,
            created_by=_get_user_id(request),
        )
        _record_audit(request, "CREATE", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "AssetLocation", str(location.id),
            None, location.to_dict(), reason=data.get("reason", ""))
        return JsonResponse({"location": location.to_dict()}, status=201)
    return HttpResponseNotAllowed(["GET", "POST"])


@csrf_exempt
def api_location_detail(request: HttpRequest, pk: int) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    try:
        location = AssetLocation.objects.select_related("area__department__floor__building__plant__company").get(pk=pk)
    except AssetLocation.DoesNotExist:
        return JsonResponse({"error": "Asset Location not found"}, status=404)
    if request.method == "GET":
        return JsonResponse({"location": location.to_dict()})
    elif request.method == "PATCH":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        old_value = location.to_dict()
        if "name" in data:
            new_name = (data["name"] or "").strip()
            if new_name and new_name != location.name:
                if AssetLocation.objects.filter(area=location.area, name=new_name, is_archived=False).exclude(pk=pk).exists():
                    return JsonResponse({"error": "Location already exists"}, status=409)
                location.name = new_name
        if "code" in data:
            location.code = data["code"] or ""
        if "description" in data:
            location.description = data["description"] or ""
        location.save()
        _record_audit(request, "UPDATE", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "AssetLocation", str(location.id),
            old_value, location.to_dict(), reason=data.get("reason", ""))
        return JsonResponse({"location": location.to_dict()})
    elif request.method == "POST":
        action = (request.GET.get("action") or "").lower()
        if action == "archive":
            if location.is_archived:
                return JsonResponse({"error": "Location already archived"}, status=400)
            location.is_archived = True
            location.save()
            _record_audit(request, "ARCHIVE", _get_user_id(request), _get_user_name(request),
                _get_user_role(request), "AssetLocation", str(location.id),
                None, {"isArchived": True}, reason=request.GET.get("reason", ""))
            return JsonResponse({"location": location.to_dict(), "status": "archived"})
        elif action == "restore":
            if not location.is_archived:
                return JsonResponse({"error": "Location is not archived"}, status=400)
            location.is_archived = False
            location.save()
            _record_audit(request, "RESTORE", _get_user_id(request), _get_user_name(request),
                _get_user_role(request), "AssetLocation", str(location.id),
                None, {"isArchived": False}, reason=request.GET.get("reason", ""))
            return JsonResponse({"location": location.to_dict(), "status": "restored"})
        elif action == "delete":
            old_value = location.to_dict()
            location.delete()
            _record_audit(request, "DELETE", _get_user_id(request), _get_user_name(request),
                _get_user_role(request), "AssetLocation", str(location.id),
                old_value, None, reason=request.GET.get("reason", ""))
            return JsonResponse({"status": "deleted", "id": pk})
    return HttpResponseNotAllowed(["GET", "PATCH", "POST"])



# HIERARCHY TREE
@csrf_exempt
def api_hierarchy_tree(request: HttpRequest) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    if request.method != "GET":
        return HttpResponseNotAllowed(["GET"])
    level = request.GET.get("level", "company")
    parent_id = request.GET.get("parentId")
    result = []
    if level == "company":
        qs = Company.objects.filter(is_archived=False)
        for c in qs.order_by("name"):
            result.append({
                "id": "C-" + str(c.id),
                "type": "company",
                "name": c.name,
                "code": c.code,
                "isArchived": c.is_archived,
                "children": [],
                "hasChildren": c.plants.filter(is_archived=False).exists(),
            })
    elif level == "plant" and parent_id:
        try:
            company_id = int(parent_id.replace("C-", ""))
        except ValueError:
            company_id = None
        if company_id:
            qs = Plant.objects.filter(company_id=company_id, is_archived=False)
            for p in qs.order_by("name"):
                result.append({
                    "id": "P-" + str(p.id),
                    "type": "plant",
                    "name": p.name,
                    "code": p.code,
                    "parentId": "C-" + str(p.company_id),
                    "isArchived": p.is_archived,
                    "children": [],
                    "hasChildren": p.buildings.filter(is_archived=False).exists(),
                })
    elif level == "building" and parent_id:
        try:
            plant_id = int(parent_id.replace("P-", ""))
        except ValueError:
            plant_id = None
        if plant_id:
            qs = Building.objects.filter(plant_id=plant_id, is_archived=False)
            for b in qs.order_by("name"):
                result.append({
                    "id": "B-" + str(b.id),
                    "type": "building",
                    "name": b.name,
                    "code": b.code,
                    "parentId": "P-" + str(b.plant_id),
                    "isArchived": b.is_archived,
                    "children": [],
                    "hasChildren": b.floors.filter(is_archived=False).exists(),
                })
    elif level == "floor" and parent_id:
        try:
            building_id = int(parent_id.replace("B-", ""))
        except ValueError:
            building_id = None
        if building_id:
            qs = Floor.objects.filter(building_id=building_id, is_archived=False)
            for f in qs.order_by("name"):
                result.append({
                    "id": "F-" + str(f.id),
                    "type": "floor",
                    "name": f.name,
                    "code": f.code,
                    "parentId": "B-" + str(f.building_id),
                    "isArchived": f.is_archived,
                    "children": [],
                    "hasChildren": f.departments.filter(is_archived=False).exists(),
                })
    elif level == "department" and parent_id:
        try:
            floor_id = int(parent_id.replace("F-", ""))
        except ValueError:
            floor_id = None
        if floor_id:
            qs = Department.objects.filter(floor_id=floor_id, is_archived=False)
            for d in qs.order_by("name"):
                result.append({
                    "id": "D-" + str(d.id),
                    "type": "department",
                    "name": d.name,
                    "code": d.code,
                    "parentId": "F-" + str(d.floor_id),
                    "isArchived": d.is_archived,
                    "children": [],
                    "hasChildren": d.areas.filter(is_archived=False).exists(),
                })
    elif level == "area" and parent_id:
        try:
            department_id = int(parent_id.replace("D-", ""))
        except ValueError:
            department_id = None
        if department_id:
            qs = Area.objects.filter(department_id=department_id, is_archived=False)
            for a in qs.order_by("name"):
                result.append({
                    "id": "A-" + str(a.id),
                    "type": "area",
                    "name": a.name,
                    "code": a.code,
                    "parentId": "D-" + str(a.department_id),
                    "isArchived": a.is_archived,
                    "children": [],
                    "hasChildren": a.locations.filter(is_archived=False).exists(),
                })
    elif level == "location" and parent_id:
        try:
            area_id = int(parent_id.replace("A-", ""))
        except ValueError:
            area_id = None
        if area_id:
            qs = AssetLocation.objects.filter(area_id=area_id, is_archived=False)
            for l in qs.order_by("name"):
                result.append({
                    "id": "L-" + str(l.id),
                    "type": "location",
                    "name": l.name,
                    "code": l.code,
                    "parentId": "A-" + str(l.area_id),
                    "isArchived": l.is_archived,
                    "children": [],
                    "hasChildren": False,
                })
    return JsonResponse({
        "level": level,
        "parentId": parent_id,
        "nodes": result,
        "count": len(result),
    })


@csrf_exempt
def api_master_mapping_dashboard(request: HttpRequest) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    if request.method != "GET":
        return HttpResponseNotAllowed(["GET"])
    total_companies = Company.objects.count()
    active_companies = Company.objects.filter(is_archived=False).count()
    archived_companies = Company.objects.filter(is_archived=True).count()
    total_plants = Plant.objects.count()
    active_plants = Plant.objects.filter(is_archived=False).count()
    total_buildings = Building.objects.count()
    active_buildings = Building.objects.filter(is_archived=False).count()
    total_floors = Floor.objects.count()
    active_floors = Floor.objects.filter(is_archived=False).count()
    total_departments = Department.objects.count()
    active_departments = Department.objects.filter(is_archived=False).count()
    total_areas = Area.objects.count()
    active_areas = Area.objects.filter(is_archived=False).count()
    total_locations = AssetLocation.objects.count()
    active_locations = AssetLocation.objects.filter(is_archived=False).count()
    total_nodes = (total_companies + total_plants + total_buildings +
                   total_floors + total_departments + total_areas + total_locations)
    active_nodes = (active_companies + active_plants + active_buildings +
                    active_floors + active_departments + active_areas + active_locations)
    completion_pct = round((active_nodes / total_nodes * 100) if total_nodes > 0 else 0, 1)
    return JsonResponse({
        "summary": {
            "companies": {"total": total_companies, "active": active_companies, "archived": archived_companies},
            "plants": {"total": total_plants, "active": active_plants},
            "buildings": {"total": total_buildings, "active": active_buildings},
            "floors": {"total": total_floors, "active": active_floors},
            "departments": {"total": total_departments, "active": active_departments},
            "areas": {"total": total_areas, "active": active_areas},
            "locations": {"total": total_locations, "active": active_locations},
        },
        "totals": {
            "totalNodes": total_nodes,
            "activeNodes": active_nodes,
            "archivedNodes": total_nodes - active_nodes,
            "completionPercent": completion_pct,
        },
    })



# RBAC - AUDIT LOGS
@csrf_exempt
def api_hierarchy_audit_logs(request: HttpRequest) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    if request.method != "GET":
        return HttpResponseNotAllowed(["GET"])
    action = request.GET.get("action")
    entity_type = request.GET.get("entityType")
    user_id = request.GET.get("userId")
    search = request.GET.get("search", "")
    qs = HierarchyAuditLog.objects.all()
    if action:
        qs = qs.filter(action=action)
    if entity_type:
        qs = qs.filter(entity_type=entity_type)
    if user_id:
        qs = qs.filter(user_id=user_id)
    if search:
        qs = qs.filter(
            Q(user_name__icontains=search) |
            Q(user_id__icontains=search) |
            Q(action__icontains=search) |
            Q(entity_type__icontains=search) |
            Q(entity_id__icontains=search)
        )
    qs = qs.order_by("-timestamp")
    return JsonResponse({
        "auditLogs": [log.to_dict() for log in qs],
        "count": qs.count(),
    })



# RBAC - ROLES
@csrf_exempt
def api_roles(request: HttpRequest) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    if request.method == "GET":
        include_inactive = request.GET.get("includeInactive") == "true"
        qs = Role.objects.all()
        if not include_inactive:
            qs = qs.filter(is_active=True)
        search = request.GET.get("search", "")
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search))
        qs = qs.order_by("name")
        return JsonResponse({
            "roles": [r.to_dict() for r in qs],
            "count": qs.count(),
        })
    elif request.method == "POST":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        name = (data.get("name") or "").strip()
        code = (data.get("code") or "").strip()
        description = data.get("description", "") or ""
        if not name:
            return JsonResponse({"error": "Role name is required"}, status=400)
        if not code:
            return JsonResponse({"error": "Role code is required"}, status=400)
        if Role.objects.filter(code=code).exists():
            return JsonResponse({"error": "Role code already exists"}, status=409)
        role = Role.objects.create(
            name=name, code=code, description=description,
            created_by=_get_user_id(request),
        )
        _record_audit(request, "ROLE_CREATE", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "Role", str(role.id),
            None, role.to_dict(), reason=data.get("reason", ""))
        return JsonResponse({"role": role.to_dict()}, status=201)
    return HttpResponseNotAllowed(["GET", "POST"])


@csrf_exempt
def api_role_detail(request: HttpRequest, pk: int) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    try:
        role = Role.objects.get(pk=pk)
    except Role.DoesNotExist:
        return JsonResponse({"error": "Role not found"}, status=404)
    if request.method == "GET":
        return JsonResponse({"role": role.to_dict()})
    elif request.method == "PATCH":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        old_value = role.to_dict()
        if "name" in data:
            role.name = (data["name"] or "").strip()
        if "code" in data:
            role.code = data["code"] or ""
        if "description" in data:
            role.description = data["description"] or ""
        if "isActive" in data:
            role.is_active = bool(data["isActive"])
        role.save()
        _record_audit(request, "ROLE_UPDATE", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "Role", str(role.id),
            old_value, role.to_dict(), reason=data.get("reason", ""))
        return JsonResponse({"role": role.to_dict()})
    elif request.method == "DELETE":
        old_value = role.to_dict()
        role.delete()
        _record_audit(request, "ROLE_DELETE", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "Role", str(role.id),
            old_value, None, reason=request.GET.get("reason", ""))
        return JsonResponse({"status": "deleted", "id": pk})
    return HttpResponseNotAllowed(["GET", "PATCH", "DELETE"])



# RBAC - PERMISSIONS
@csrf_exempt
def api_permissions(request: HttpRequest) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    if request.method == "GET":
        module = request.GET.get("module")
        include_inactive = request.GET.get("includeInactive") == "true"
        qs = Permission.objects.all()
        if module:
            qs = qs.filter(module=module)
        if not include_inactive:
            qs = qs.filter(is_active=True)
        qs = qs.order_by("module", "name")
        return JsonResponse({
            "permissions": [p.to_dict() for p in qs],
            "count": qs.count(),
        })
    elif request.method == "POST":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        name = (data.get("name") or "").strip()
        code = (data.get("code") or "").strip()
        module_val = data.get("module") or ""
        description = data.get("description", "") or ""
        if not name:
            return JsonResponse({"error": "Permission name is required"}, status=400)
        if not code:
            return JsonResponse({"error": "Permission code is required"}, status=400)
        if not module_val:
            return JsonResponse({"error": "Module is required"}, status=400)
        if Permission.objects.filter(code=code).exists():
            return JsonResponse({"error": "Permission code already exists"}, status=409)
        permission = Permission.objects.create(
            name=name, code=code, module=module_val, description=description,
            created_by=_get_user_id(request),
        )
        _record_audit(request, "PERMISSION_CREATE", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "Permission", str(permission.id),
            None, permission.to_dict(), reason=data.get("reason", ""))
        return JsonResponse({"permission": permission.to_dict()}, status=201)
    return HttpResponseNotAllowed(["GET", "POST"])


@csrf_exempt
def api_permission_detail(request: HttpRequest, pk: int) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    try:
        permission = Permission.objects.get(pk=pk)
    except Permission.DoesNotExist:
        return JsonResponse({"error": "Permission not found"}, status=404)
    if request.method == "GET":
        return JsonResponse({"permission": permission.to_dict()})
    elif request.method == "PATCH":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        old_value = permission.to_dict()
        if "name" in data:
            permission.name = (data["name"] or "").strip()
        if "code" in data:
            permission.code = data["code"] or ""
        if "module" in data:
            permission.module = data["module"] or ""
        if "description" in data:
            permission.description = data["description"] or ""
        if "isActive" in data:
            permission.is_active = bool(data["isActive"])
        permission.save()
        _record_audit(request, "PERMISSION_UPDATE", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "Permission", str(permission.id),
            old_value, permission.to_dict(), reason=data.get("reason", ""))
        return JsonResponse({"permission": permission.to_dict()})
    elif request.method == "DELETE":
        old_value = permission.to_dict()
        permission.delete()
        _record_audit(request, "PERMISSION_DELETE", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "Permission", str(permission.id),
            old_value, None, reason=request.GET.get("reason", ""))
        return JsonResponse({"status": "deleted", "id": pk})
    return HttpResponseNotAllowed(["GET", "PATCH", "DELETE"])



# RBAC - ROLE PERMISSION MAPPING
@csrf_exempt
def api_role_permissions(request: HttpRequest, role_id: int) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    try:
        role = Role.objects.get(pk=role_id)
    except Role.DoesNotExist:
        return JsonResponse({"error": "Role not found"}, status=404)
    if request.method == "GET":
        rps = RolePermission.objects.filter(role=role).select_related("permission")
        return JsonResponse({
            "role": role.to_dict(),
            "permissions": [rp.to_dict() for rp in rps],
            "count": rps.count(),
        })
    elif request.method == "POST":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        permission_id = data.get("permissionId")
        if not permission_id:
            return JsonResponse({"error": "Permission ID is required"}, status=400)
        try:
            permission = Permission.objects.get(pk=permission_id)
        except Permission.DoesNotExist:
            return JsonResponse({"error": "Permission not found"}, status=404)
        rp, created = RolePermission.objects.get_or_create(
            role=role, permission=permission,
            defaults={"granted_by": _get_user_id(request)})
        if created:
            _record_audit(request, "ROLE_ASSIGN", _get_user_id(request), _get_user_name(request),
                _get_user_role(request), "Role", str(role.id),
                None, {"permissionId": permission.id, "permissionName": permission.name},
                reason=data.get("reason", ""))
        return JsonResponse({"rolePermission": rp.to_dict()}, status=201 if created else 200)
    elif request.method == "DELETE":
        permission_id = request.GET.get("permissionId")
        if not permission_id:
            return JsonResponse({"error": "Permission ID is required"}, status=400)
        try:
            rp = RolePermission.objects.get(role=role, permission_id=permission_id)
        except RolePermission.DoesNotExist:
            return JsonResponse({"error": "Role permission mapping not found"}, status=404)
        perm_name = rp.permission.name
        rp.delete()
        _record_audit(request, "ROLE_REVOKE", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "Role", str(role.id),
            None, {"permissionId": permission_id, "permissionName": perm_name},
            reason=request.GET.get("reason", ""))
        return JsonResponse({"status": "revoked"})
    return HttpResponseNotAllowed(["GET", "POST", "DELETE"])


# RBAC - USER ROLES
@csrf_exempt
def api_user_roles(request: HttpRequest) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    if request.method == "GET":
        user_id = request.GET.get("userId")
        qs = UserRole.objects.all().select_related("role")
        if user_id:
            qs = qs.filter(user_id=user_id)
        qs = qs.order_by("-assigned_at")
        return JsonResponse({
            "userRoles": [ur.to_dict() for ur in qs],
            "count": qs.count(),
        })
    elif request.method == "POST":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        user_id = (data.get("userId") or "").strip()
        user_name = (data.get("userName") or "").strip()
        email = data.get("email", "") or ""
        role_id = data.get("roleId")
        if not user_id:
            return JsonResponse({"error": "User ID is required"}, status=400)
        if not user_name:
            return JsonResponse({"error": "User name is required"}, status=400)
        if not role_id:
            return JsonResponse({"error": "Role ID is required"}, status=400)
        try:
            role = Role.objects.get(pk=role_id)
        except Role.DoesNotExist:
            return JsonResponse({"error": "Role not found"}, status=404)
        if UserRole.objects.filter(user_id=user_id, role=role, is_active=True).exists():
            return JsonResponse({"error": "User already has role"}, status=409)
        user_role = UserRole.objects.create(
            user_id=user_id, user_name=user_name, email=email,
            role=role, assigned_by=_get_user_id(request))
        _record_audit(request, "ROLE_ASSIGN", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "User", user_id,
            None, user_role.to_dict(), reason=data.get("reason", ""))
        return JsonResponse({"userRole": user_role.to_dict()}, status=201)
    return HttpResponseNotAllowed(["GET", "POST"])


@csrf_exempt
def api_user_role_detail(request: HttpRequest, pk: int) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    try:
        user_role = UserRole.objects.get(pk=pk)
    except UserRole.DoesNotExist:
        return JsonResponse({"error": "User role not found"}, status=404)
    if request.method == "DELETE":
        old_value = user_role.to_dict()
        user_role.is_active = False
        user_role.save()
        _record_audit(request, "ROLE_REVOKE", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "User", user_role.user_id,
            old_value, {"isActive": False}, reason=request.GET.get("reason", ""))
        return JsonResponse({"status": "revoked"})
    return HttpResponseNotAllowed(["DELETE"])



# RBAC - USER HIERARCHY SCOPE
@csrf_exempt
def api_user_scopes(request: HttpRequest) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    if request.method == "GET":
        user_id = request.GET.get("userId")
        qs = UserHierarchyScope.objects.all().select_related("company", "plant", "building", "floor", "department", "area")
        if user_id:
            qs = qs.filter(user_id=user_id)
        qs = qs.order_by("-assigned_at")
        return JsonResponse({
            "scopes": [s.to_dict() for s in qs],
            "count": qs.count(),
        })
    elif request.method == "POST":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        user_id = (data.get("userId") or "").strip()
        user_name = (data.get("userName") or "").strip()
        company_id = data.get("companyId")
        plant_id = data.get("plantId")
        building_id = data.get("buildingId")
        floor_id = data.get("floorId")
        department_id = data.get("departmentId")
        area_id = data.get("areaId")
        if not user_id:
            return JsonResponse({"error": "User ID is required"}, status=400)
        if not user_name:
            return JsonResponse({"error": "User name is required"}, status=400)
        if UserHierarchyScope.objects.filter(user_id=user_id, is_active=True).exists():
            return JsonResponse({"error": "User already has active scope"}, status=409)
        scope_kwargs = {
            "user_id": user_id, "user_name": user_name,
            "assigned_by": _get_user_id(request)}
        for field, val in [("company", company_id), ("plant", plant_id),
                           ("building", building_id), ("floor", floor_id),
                           ("department", department_id), ("area", area_id)]:
            if val:
                try:
                    model_map = {"company": Company, "plant": Plant, "building": Building,
                                 "floor": Floor, "department": Department, "area": Area}
                    obj = model_map[field].objects.get(pk=val)
                    scope_kwargs[field] = obj
                except (model_map[field].DoesNotExist, KeyError):
                    return JsonResponse({"error": field + " not found"}, status=404)
        scope = UserHierarchyScope.objects.create(**scope_kwargs)
        _record_audit(request, "SCOPE_ASSIGN", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "User", user_id,
            None, scope.to_dict(), reason=data.get("reason", ""))
        return JsonResponse({"scope": scope.to_dict()}, status=201)
    return HttpResponseNotAllowed(["GET", "POST"])


@csrf_exempt
def api_user_scope_detail(request: HttpRequest, pk: int) -> JsonResponse:
    forbidden = _require_superuser(request)
    if forbidden:
        return forbidden
    try:
        scope = UserHierarchyScope.objects.get(pk=pk)
    except UserHierarchyScope.DoesNotExist:
        return JsonResponse({"error": "User scope not found"}, status=404)
    if request.method == "GET":
        return JsonResponse({"scope": scope.to_dict()})
    elif request.method == "PATCH":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        old_value = scope.to_dict()
        for field, model_class in [("company", Company), ("plant", Plant),
                                    ("building", Building), ("floor", Floor),
                                    ("department", Department), ("area", Area)]:
            fk_field = field + "_id"
            if fk_field in data:
                val = data[fk_field]
                if val:
                    try:
                        setattr(scope, field, model_class.objects.get(pk=val))
                    except model_class.DoesNotExist:
                        return JsonResponse({"error": field + " not found"}, status=404)
                else:
                    setattr(scope, field, None)
        if "isActive" in data:
            scope.is_active = bool(data["isActive"])
        scope.save()
        _record_audit(request, "SCOPE_UPDATE", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "User", scope.user_id,
            old_value, scope.to_dict(), reason=data.get("reason", ""))
        return JsonResponse({"scope": scope.to_dict()})
    elif request.method == "DELETE":
        old_value = scope.to_dict()
        scope.is_active = False
        scope.save()
        _record_audit(request, "SCOPE_UPDATE", _get_user_id(request), _get_user_name(request),
            _get_user_role(request), "User", scope.user_id,
            old_value, {"isActive": False}, reason=request.GET.get("reason", ""))
        return JsonResponse({"status": "deactivated"})
    return HttpResponseNotAllowed(["GET", "PATCH", "DELETE"])


