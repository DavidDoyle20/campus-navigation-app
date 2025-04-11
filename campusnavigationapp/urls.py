from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView
from .views import Map, DomainRestrictedLoginView, Home, logout_view, save_bookmark, get_bookmarks, delete_bookmark

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', Home.as_view(), name='home'),
    path('map/', Map.as_view(), name='map'),  # Use Map.as_view() for CBV
    path('auth/login/', DomainRestrictedLoginView.as_view(), name='login'),
    path('auth/', include('magiclink.urls', namespace='magiclink')),
    path('logout/', logout_view, name='logout'),
    path('bookmarks/save/', save_bookmark, name='save_bookmark'),
    path('bookmarks/delete/<int:bookmark_id>/', delete_bookmark, name='delete_bookmark'),
    path('bookmarks/', get_bookmarks, name='get_bookmarks'),
    path('bookmarks/<int:bookmark_id>/', get_bookmarks, name='get_bookmark')
]
