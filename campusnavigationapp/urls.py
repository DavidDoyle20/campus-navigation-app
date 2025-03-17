from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView
from .views import Map, DomainRestrictedLoginView, Home, logout_view

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', Home.as_view(), name='home'),
    path('map/', Map.as_view(), name='map'),  # Use Map.as_view() for CBV
    path('auth/login/', DomainRestrictedLoginView.as_view(), name='login'),
    path('auth/', include('magiclink.urls', namespace='magiclink')),
    path('logout/', logout_view, name='logout'),
]
