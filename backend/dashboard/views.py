import json
import time
from django.http import JsonResponse, HttpRequest, HttpResponseNotAllowed
from django.views.decorators.csrf import csrf_exempt
from .models import Asset

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

    elif request.method == "DELETE":
        asset.delete()
        return JsonResponse({"message": f"Asset {pk} deleted successfully"})

    return HttpResponseNotAllowed(["GET", "DELETE"])

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
    })
