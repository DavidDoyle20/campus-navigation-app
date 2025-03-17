from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth.models import User
from magiclink.models import MagicLink
import json

class CampusNavigationViewTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username="testuser", password="password123")

    # 🔹 Test Map View (Redirect for Unauthenticated Users)
    def test_map_view_redirects_if_not_logged_in(self):
        """Test if the map view redirects unauthenticated users to login."""
        response = self.client.get(reverse('map'))
        self.assertEqual(response.status_code, 302)  # Should redirect
        self.assertTrue(response.url.startswith(reverse('login')))

    # 🔹 Test Map View (Authenticated Users)
    def test_map_view_authenticated(self):
        """Test if the map page loads successfully for logged-in users."""
        self.client.login(username="testuser", password="password123")
        response = self.client.get(reverse('map'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'map.html')

    # 🔹 Test Home View (Redirect If Logged In)
    def test_home_redirects_if_authenticated(self):
        """Test if the home page redirects logged-in users to the map."""
        self.client.login(username="testuser", password="password123")
        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 302)  # Redirects to 'map'

    # 🔹 Test Login with Valid UWM Email
    def test_login_with_valid_email(self):
        """Test login with a valid UWM email."""
        response = self.client.post(
            reverse('login'),
            data={"email": "student@uwm.edu"},
        )
        self.assertEqual(response.status_code, 302)  # Redirect to magic link sent page
        self.assertTrue(MagicLink.objects.filter(email="student@uwm.edu").exists())

    # 🔹 Test Login with Non-UWM Email (Should Fail)
    def test_login_with_invalid_email(self):
        """Test login with a non-UWM email (should fail)."""
        response = self.client.post(
            reverse('login'),
            data={"email": "user@gmail.com"},
        )
        self.assertEqual(response.status_code, 200)  # Stays on login page
        self.assertContains(response, "Please use your campus email address to log in.")

    # 🔹 Test Login Form Validation
    def test_login_with_invalid_form(self):
        """Test login failure with an invalid email format."""
        response = self.client.post(
            reverse('login'),
            data={"email": "invalidemail"},
        )
        self.assertEqual(response.status_code, 200)  # Should stay on login page
        self.assertContains(response, "Enter a valid email address.")

    # 🔹 Test Logout Functionality
    def test_logout(self):
        """Test user logout."""
        self.client.login(username="testuser", password="password123")
        response = self.client.get(reverse('logout'))
        self.assertEqual(response.status_code, 302)  # Should redirect to login
