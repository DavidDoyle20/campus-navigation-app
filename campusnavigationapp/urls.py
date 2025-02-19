from django.contrib import admin
from django.urls import path
from campusnavigationapp import views
from .views import Map  # Ensure Map is a class-based view

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.login_view, name='login'),  # Home page as login
    path('login/', views.login_view, name='login'),  # Explicit login route
    path('register/', views.register_view, name='register'),
    path('reset-password/', views.reset_password_view, name='reset_password'),
    path('map/', Map.as_view(), name='map'),  # Use Map.as_view() for CBV
]
