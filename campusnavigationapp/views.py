import logging

from django.forms import ValidationError
from django.http import HttpResponseRedirect
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