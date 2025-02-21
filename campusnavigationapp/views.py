from django.shortcuts import render
from django.contrib.auth import authenticate, login
from django.contrib.auth.models import User
from django.views import View
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie

import json


class Map(View):
    def get(self, request):
        return render(request, 'map.html')

@ensure_csrf_cookie
def login_view(request):
    if request.method == "POST":
        data = json.loads(request.body)
        username = data.get("username")
        password = data.get("password")
        user = authenticate(request, username=username, password=password)

        if user:
            login(request, user)
            return JsonResponse({"success": True, "message": "Login successful!"})
        else:
            return JsonResponse({"success": False, "message": "Invalid credentials"})

    return render(request, 'login.html')

@ensure_csrf_cookie
def register_view(request):
    if request.method == "POST":
        data = json.loads(request.body)
        username = data.get("username")
        password = data.get("password")

        if User.objects.filter(username=username).exists():
            return JsonResponse({"success": False, "message": "Username already exists"})

        User.objects.create_user(username=username, password=password)
        return JsonResponse({"success": True, "message": "Registration successful!"})

    # Added this line to ensure a response is always returned
    return render(request, 'register.html')

@ensure_csrf_cookie
def reset_password_view(request):
    if request.method == "POST":
        data = json.loads(request.body)
        username = data.get("username")
        newPassword = data.get("newPassword")

        user = User.objects.filter(username=username).first()
        if user:
            user.set_password(newPassword)
            user.save()
            return JsonResponse({"success": True, "message": "Password reset successful"})

        return JsonResponse({"success": False, "message": "User not found"})

        # If someone accesses this URL via GET, return a 405 (Method Not Allowed) response
    return JsonResponse({"success": False, "message": "Method not allowed"}, status=405)