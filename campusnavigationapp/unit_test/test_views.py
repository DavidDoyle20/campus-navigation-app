import json

from django.contrib.auth.models import User
from django.test import TestCase, Client
from django.urls import reverse


class CampusNavigationViewTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username="testuser", password="password123")

    # Test the Map View
    def test_map_view(self):
        """Test if the map page loads successfully."""
        response = self.client.get(reverse('map'))  # Use your actual URL name
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'map.html')

    # Test Login View (Successful)
    def test_login_success(self):
        """Test successful login."""
        response = self.client.post(
            reverse('login'),
            data=json.dumps({"username": "testuser", "password": "password123"}),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(response.content, {"success": True, "message": "Login successful!"})

    # Test Login View (Failed)
    def test_login_fail(self):
        """Test login failure with wrong credentials."""
        response = self.client.post(
            reverse('login'),
            data=json.dumps({"username": "wronguser", "password": "wrongpass"}),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(response.content, {"success": False, "message": "Invalid credentials"})

    # Test Register View (Successful)
    def test_register_success(self):
        """Test user registration."""
        response = self.client.post(
            reverse('register'),
            data=json.dumps({"username": "newuser", "password": "newpassword"}),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(response.content, {"success": True, "message": "Registration successful!"})
        self.assertTrue(User.objects.filter(username="newuser").exists())

    # Test Register View (Fail - Duplicate Username)
    def test_register_duplicate_username(self):
        """Test registration failure when username already exists."""
        response = self.client.post(
            reverse('register'),
            data=json.dumps({"username": "testuser", "password": "password123"}),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(response.content, {"success": False, "message": "Username already exists"})

    # Test Password Reset (Successful)
    def test_reset_password_success(self):
        """Test password reset for an existing user."""
        response = self.client.post(
            reverse('reset_password'),
            data=json.dumps({"username": "testuser", "newPassword": "newpassword123"}),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(response.content, {"success": True, "message": "Password reset successful"})

        # Ensure password is actually changed
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("newpassword123"))

    # Test Password Reset (Fail - Non-existent User)
    def test_reset_password_fail(self):
        """Test password reset failure for a non-existent user."""
        response = self.client.post(
            reverse('reset_password'),
            data=json.dumps({"username": "unknownuser", "newPassword": "newpassword123"}),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(response.content, {"success": False, "message": "User not found"})

    # Test Password Reset with GET (Should return 405)
    def test_reset_password_get_not_allowed(self):
        """Ensure password reset does not allow GET requests."""
        response = self.client.get(reverse('reset_password'))
        self.assertEqual(response.status_code, 405)
        self.assertJSONEqual(response.content, {"success": False, "message": "Method not allowed"})
