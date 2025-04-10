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


def get_nullable_float(post_data, key):
    value = post_data.get(key)
    print(value)
    if value is None or value == '':
        return None
    try:
        return float(value)
    except (TypeError):
         raise ValidationError(f"Unexpected type for '{key}': '{value}'")

def get_nullable_integer(post_data, key):
    value = post_data.get(key)
    if value is None or value == '':
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        raise ValidationError(f"Invalid integer value provided for '{key}': '{value}'. Must be a whole number.")

@login_required
def save_bookmark(request):
    if request.method == 'POST':
        try:
            start_level_val = get_nullable_integer(request.POST, "start_level")
            start_lat_val = get_nullable_float(request.POST, "start_lat")
            start_lng_val = get_nullable_float(request.POST, "start_lng")
            end_level_val = get_nullable_integer(request.POST, "end_level")
            end_lat_val = get_nullable_float(request.POST, "end_lat")
            end_lng_val = get_nullable_float(request.POST, "end_lng")

            bookmark = Bookmark.objects.create(
                user=request.user,
                name=request.POST.get('name', 'Unnamed Route'),
                start_level=start_level_val,
                start_lat=start_lat_val,
                start_lng=start_lng_val,
                end_level=end_level_val,
                end_lat=end_lat_val,
                end_lng=end_lng_val
            )
            print(bookmark)
            return JsonResponse({'status': 'success', 'id': bookmark.id})
        except Exception as e:
            print(e)
            return JsonResponse({'status': 'error', 'message': str(e)}) 

@login_required
def get_bookmarks(request, bookmark_id=None):
    if bookmark_id:
        try:
            bookmark = Bookmark.objects.get(user=request.user, id=bookmark_id)
            bookmark_data = {
                'id': bookmark.id,
                'name': bookmark.name,
                'start_level': getattr(bookmark, 'start_level', None),
                'start_lat': getattr(bookmark, 'start_lat', None),
                'start_lng': getattr(bookmark, 'start_lng', None),
                'end_level': getattr(bookmark, 'end_level', None),
                'end_lat': getattr(bookmark, 'end_lat', None),
                'end_lng': getattr(bookmark, 'end_lng', None),
                'created_at': bookmark.created_at.strftime('%Y-%m-%d %H:%M') if bookmark.created_at else None
            }
            response_data = {'bookmark': bookmark_data}

            return JsonResponse(response_data)
        except Bookmark.DoesNotExist:
            raise Http404("Bookmark not found")

    bookmarks = Bookmark.objects.filter(user=request.user).order_by('-created_at')
    return JsonResponse({
        'bookmarks': [
            {
                'id': b.id,
                'name': b.name,
                'start_level': getattr(b, 'start_level', None),
                'start_lat': getattr(b, 'start_lat', None),
                'start_lng': getattr(b, 'start_lng', None),
                'end_level': getattr(b, 'end_level', None),
                'end_lat': getattr(b, 'end_lat', None),
                'end_lng': getattr(b, 'end_lng', None),
                'created_at': b.created_at.strftime('%Y-%m-%d %H:%M') if b.created_at else None
            } for b in bookmarks
        ]
    })

@login_required
def delete_bookmark(request, bookmark_id):
    if (request.method == "DELETE"):
        print(request)
        try:
            Bookmark.objects.get(id=bookmark_id, user=request.user).delete()
            return JsonResponse({'status': 'success'})
        except Bookmark.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Bookmark not found'})