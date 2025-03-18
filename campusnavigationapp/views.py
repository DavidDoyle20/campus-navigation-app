import logging

from django.forms import ValidationError
from django.http import Http404, HttpResponseRedirect, JsonResponse
from django.shortcuts import redirect, render
from django.conf import settings as django_settings
from django.contrib.auth.models import User
from django.contrib.auth import logout
from django.views import View
from magiclink.views import Login
from magiclink.forms import LoginForm
from magiclink.helpers import get_or_create_user, create_magiclink, MagicLinkError, get_url_path
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.mixins import UserPassesTestMixin
from django.contrib.auth.decorators import login_required

from campusnavigationapp.models import Bookmark

log = logging.getLogger(__name__)

class RedirectIfAuthenticatedMixin(UserPassesTestMixin):
    def test_func(self):
        return not self.request.user.is_authenticated

    def handle_no_permission(self):
        return redirect('map')

class Map(LoginRequiredMixin, View):
    def get(self, request):
        return render(request, 'map.html')
    
class Home(RedirectIfAuthenticatedMixin, View):
    def get(self, request):
        return render(request, 'index.html')
    
def logout_view(request):
    logout(request)
    return redirect('home')

@method_decorator(csrf_protect, name='dispatch')
class DomainRestrictedLoginView(Login):
    def post(self, request, *args, **kwargs):
        logout(request)
        context = self.get_context_data(**kwargs)
        context['require_signup'] = django_settings.REQUIRE_SIGNUP
        form = LoginForm(request.POST)
        
        if not form.is_valid():
            context['login_form'] = form
            return self.render_to_response(context)
        
        email = form.cleaned_data['email']
        allowed_domains = ['uwm.edu']
        domain = email.split('@')[1]
        if domain not in allowed_domains:
            form.add_error('email', ValidationError("Please use your campus email address to log in."))
            context['login_form'] = form
            return self.render_to_response(context)
            
        if not django_settings.REQUIRE_SIGNUP:
            get_or_create_user(email)
        
        redirect_url = self.login_redirect_url(request.GET.get('next', ''))
        try:
            magiclink = create_magiclink(
                email, request, redirect_url=redirect_url
            )
        except MagicLinkError as e:
            form.add_error('email', str(e))
            context['login_form'] = form
            return self.render_to_response(context)
        
        magiclink.send(request)

        sent_url = get_url_path(django_settings.LOGIN_SENT_REDIRECT)
        response = HttpResponseRedirect(sent_url)
        if django_settings.REQUIRE_SAME_BROWSER:
            cookie_name = f'magiclink{magiclink.pk}'
            response.set_cookie(cookie_name, magiclink.cookie_value)
            log.info(f'Cookie {cookie_name} set for {email}')
        return response
    
@login_required
def save_bookmark(request):
    if request.method == 'POST':
        try:
            bookmark = Bookmark.objects.create(
                user=request.user,
                name=request.POST.get('name', 'Unnamed Route'),
                start_level=request.POST["start_level"],
                start_lat=request.POST["start_lat"],
                start_lng=request.POST["start_lng"],
                end_level=request.POST["end_level"],
                end_lat=request.POST["end_lat"],
                end_lng=request.POST["end_lng"] 
            )
            return JsonResponse({'status': 'success', 'id': bookmark.id})
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}) 

@login_required
def get_bookmarks(request, bookmark_id=None):
    if bookmark_id:
        try:
            bookmark = Bookmark.objects.get(user=request.user, id=bookmark_id)
            return JsonResponse({
                'bookmark': {
                    'id': bookmark.id,
                    'name': bookmark.name,
                    'start_level': bookmark.start_level,
                    'start_lat': float(bookmark.start_lat),
                    'start_lng': float(bookmark.start_lng),
                    'end_level': bookmark.end_level,
                    'end_lat': float(bookmark.end_lat) if bookmark.end_lat else None,
                    'end_lng': float(bookmark.end_lng) if bookmark.end_lng else None,
                    'created_at': bookmark.created_at.strftime('%Y-%m-%d %H:%M')
                }
            })
        except Bookmark.DoesNotExist:
            raise Http404("Bookmark not found")

    bookmarks = Bookmark.objects.filter(user=request.user).order_by('-created_at')
    print(bookmarks)
    return JsonResponse({
        'bookmarks': [
            {
                'id': b.id,
                'name': b.name,
                'start_level': b.start_level,
                'start_lat': float(b.start_lat),
                'start_lng': float(b.start_lng),
                'end_level': b.end_level,
                'end_lat': float(b.end_lat) if b.end_lat else None,
                'end_lng': float(b.end_lng) if b.end_lng else None,
                'created_at': b.created_at.strftime('%Y-%m-%d %H:%M')
            } for b in bookmarks
        ]
    })

@login_required
def delete_bookmark(request, bookmark_id):
    print(request)
    try:
        Bookmark.objects.get(id=bookmark_id, user=request.user).delete()
        return JsonResponse({'status': 'success'})
    except Bookmark.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Bookmark not found'})