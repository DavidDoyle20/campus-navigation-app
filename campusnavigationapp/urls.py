from django.contrib import admin
from django.urls import include, path

from .views import Map, DomainRestrictedLoginView, Home

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', Home.as_view(), name='home'),
    # path('login/', views.login_view, name='login'),  # Explicit login route
    # path('register/', views.register_view, name='register'),
    # path('reset-password/', views.reset_password_view, name='reset_password'),
    path('map/', Map.as_view(), name='map'),  # Use Map.as_view() for CBV
    path('auth/login/', DomainRestrictedLoginView.as_view(), name='login'),
    path('auth/', include('magiclink.urls', namespace='magiclink')),
]
