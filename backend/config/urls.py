from django.contrib import admin
from django.urls import path
from dashboard.views import api_health, api_assets, api_asset_detail, api_metrics

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', api_health, name='api-health'),
    path('api/assets/', api_assets, name='api-assets'),
    path('api/assets/<int:pk>/', api_asset_detail, name='api-asset-detail'),
    path('api/metrics/', api_metrics, name='api-metrics'),
]
