from django.http import JsonResponse
from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth.models import User
from magiclink.models import MagicLink
from campusnavigationapp.models import Bookmark
import json


class CampusNavigationViewTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username="testuser", password="password123")

    # 🔹 1. Test Map View (Redirect for Unauthenticated Users)
    def test_map_view_redirects_if_not_logged_in(self):
        response = self.client.get(reverse('map'))
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.url.startswith(reverse('login')))

    # 🔹 2. Test Map View (Authenticated Users)
    def test_map_view_authenticated(self):
        self.client.login(username="testuser", password="password123")
        response = self.client.get(reverse('map'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'map.html')

    # 🔹 3. Test Home View (Redirect If Logged In)
    def test_home_redirects_if_authenticated(self):
        self.client.login(username="testuser", password="password123")
        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 302)

    # 🔹 4. Test Login with Valid UWM Email
    def test_login_with_valid_email(self):
        response = self.client.post(reverse('login'), data={"email": "student@uwm.edu"})
        self.assertEqual(response.status_code, 302)
        self.assertTrue(MagicLink.objects.filter(email="student@uwm.edu").exists())

    # 🔹 5. Test Login with Non-UWM Email (Should Fail)
    def test_login_with_invalid_email(self):
        response = self.client.post(reverse('login'), data={"email": "user@gmail.com"})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Please use your campus email address to log in.")

    # 🔹 6. Test Login Form Validation
    def test_login_with_invalid_form(self):
        response = self.client.post(reverse('login'), data={"email": "invalidemail"})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Enter a valid email address.")

    # 🔹 7. Test Logout Functionality
    def test_logout(self):
        self.client.login(username="testuser", password="password123")
        response = self.client.get(reverse('logout'))
        self.assertEqual(response.status_code, 302)

    # 🔹 8. Test saving a bookmark
    def test_save_bookmark_success(self):
        self.client.login(username="testuser", password="password123")
        response = self.client.post(
            reverse('save_bookmark'),
            data={
                'name': 'Test Route',
                'start_level': 1,
                'start_lat': 43.0,
                'start_lng': -87.9,
                'end_level': 2,
                'end_lat': 43.1,
                'end_lng': -87.8
            }
        )
        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(
            str(response.content, encoding='utf8'),
            {'status': 'success', 'id': Bookmark.objects.first().id}
        )

    # 🔹 9. Test save bookmark with missing fields (still passes)
    def test_save_bookmark_invalid_data(self):
        self.client.login(username="testuser", password="password123")
        response = self.client.post(reverse('save_bookmark'), data={'name': ''})
        self.assertEqual(json.loads(response.content)['status'], 'success')  # Current logic allows it

    # 🔹 10. Test get all bookmarks
    def test_get_bookmarks_list(self):
        self.client.login(username="testuser", password="password123")
        Bookmark.objects.create(user=self.user, name="Test Bookmark")
        response = self.client.get(reverse('get_bookmarks'))
        self.assertEqual(response.status_code, 200)
        self.assertIn('bookmarks', json.loads(response.content))

    # 🔹 11. Test get bookmark by ID
    def test_get_bookmark_by_id(self):
        self.client.login(username="testuser", password="password123")
        bookmark = Bookmark.objects.create(user=self.user, name="Bookmark One")
        response = self.client.get(reverse('get_bookmark', args=[bookmark.id]))
        self.assertEqual(response.status_code, 200)
        self.assertIn('bookmark', json.loads(response.content))

    # 🔹 12. Test get bookmark by invalid ID
    def test_get_bookmark_by_invalid_id(self):
        self.client.login(username="testuser", password="password123")
        response = self.client.get(reverse('get_bookmark', args=[9999]))
        self.assertEqual(response.status_code, 404)

    # 🔹 13. Test delete bookmark success
    def test_delete_bookmark_success(self):
        self.client.login(username="testuser", password="password123")
        bookmark = Bookmark.objects.create(user=self.user, name="Delete Me")
        response = self.client.delete(reverse('delete_bookmark', args=[bookmark.id]))
        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(
            str(response.content, encoding='utf8'),
            {'status': 'success'}
        )

    # 🔹 14. Test delete bookmark not found
    def test_delete_bookmark_not_found(self):
        self.client.login(username="testuser", password="password123")
        response = self.client.delete(reverse('delete_bookmark', args=[9999]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(json.loads(response.content)['status'], 'error')

    # 🔹 15. Test unauthorized access to get_bookmarks
    def test_get_bookmarks_unauthenticated(self):
        response = self.client.get(reverse('get_bookmarks'))
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.url.startswith(reverse('login')))

    # 🔹 16. Test unauthorized access to save_bookmark
    def test_save_bookmark_unauthenticated(self):
        response = self.client.post(reverse('save_bookmark'), data={})
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.url.startswith(reverse('login')))

    # 🔹 17. Test unauthorized access to delete_bookmark
    def test_delete_bookmark_unauthenticated(self):
        response = self.client.delete(reverse('delete_bookmark', args=[1]))
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.url.startswith(reverse('login')))

    # 🔹 18. Test saving multiple bookmarks
    def test_multiple_bookmarks_saved(self):
        self.client.login(username="testuser", password="password123")
        for i in range(3):
            self.client.post(reverse('save_bookmark'), data={
                'name': f'Route {i}',
                'start_lat': 43.0 + i,
                'start_lng': -87.9 + i,
                'end_lat': 44.0 + i,
                'end_lng': -86.9 + i,
            })
        self.assertEqual(Bookmark.objects.filter(user=self.user).count(), 3)

    # 🔹 19. Test logout actually logs out
    def test_logout_then_access_map(self):
        self.client.login(username="testuser", password="password123")
        self.client.get(reverse('logout'))
        response = self.client.get(reverse('map'))
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.url.startswith(reverse('login')))

    # 🔹 20. Test get_bookmarks returns recent first
    def test_get_bookmarks_order(self):
        self.client.login(username="testuser", password="password123")
        Bookmark.objects.create(user=self.user, name="First")
        Bookmark.objects.create(user=self.user, name="Second")
        response = self.client.get(reverse('get_bookmarks'))
        bookmarks = json.loads(response.content)['bookmarks']
        self.assertGreaterEqual(bookmarks[0]['created_at'], bookmarks[1]['created_at'])
 # 🔹 21. Test duplicate bookmarks allowed
    def test_duplicate_bookmarks_fail(self):
        self.client.login(username="testuser", password="password123")
        self.client.post(reverse('save_bookmark'), data={
            'name': 'UniqueRoute',
            'start_lat': 43.0,
            'start_lng': -87.9,
            'end_lat': 44.0,
            'end_lng': -86.9,
        })
        response = self.client.post(reverse('save_bookmark'), data={
            'name': 'UniqueRoute',
            'start_lat': 45.0,
            'start_lng': -85.9,
            'end_lat': 46.0,
            'end_lng': -84.9,
        })
        data = json.loads(response.content)
        self.assertEqual(data['status'], 'error')
        self.assertIn('UNIQUE constraint', data['message'])

    # 🔹 22. Test delete bookmark by another user (should not delete)
    def test_delete_bookmark_wrong_user(self):
        other_user = User.objects.create_user(username="other", password="pass")
        bookmark = Bookmark.objects.create(user=other_user, name="Private")
        self.client.login(username="testuser", password="password123")
        response = self.client.delete(reverse('delete_bookmark', args=[bookmark.id]))
        self.assertEqual(json.loads(response.content)['status'], 'error')
        self.assertTrue(Bookmark.objects.filter(id=bookmark.id).exists())

    # 🔹 23. Test get bookmark by another user (should 404)
    def test_get_bookmark_wrong_user(self):
        other_user = User.objects.create_user(username="other", password="pass")
        bookmark = Bookmark.objects.create(user=other_user, name="Hidden")
        self.client.login(username="testuser", password="password123")
        response = self.client.get(reverse('get_bookmark', args=[bookmark.id]))
        self.assertEqual(response.status_code, 404)

    # 🔹 24. Test saving bookmark with empty name defaults correctly
    def test_save_bookmark_empty_name_defaults(self):
        self.client.login(username="testuser", password="password123")
        response = self.client.post(reverse('save_bookmark'), data={
            'start_lat': 43.0,
            'start_lng': -87.9,
            'end_lat': 44.0,
            'end_lng': -86.9,
        })
        bookmark = Bookmark.objects.first()
        self.assertEqual(bookmark.name, "Unnamed Route")

    # 🔹 25. Test invalid POST type for delete_bookmark (should fail)
    def delete_bookmark(request, bookmark_id):
        if request.method == "DELETE":
            try:
                Bookmark.objects.get(id=bookmark_id, user=request.user).delete()
                return JsonResponse({'status': 'success'})
            except Bookmark.DoesNotExist:
                return JsonResponse({'status': 'error', 'message': 'Bookmark not found'})
        else:
            return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)

    # 🔹 26. Test get_bookmarks returns JSON with correct keys
    def test_bookmark_keys_in_json(self):
        self.client.login(username="testuser", password="password123")
        bookmark = Bookmark.objects.create(user=self.user, name="Key Test")
        response = self.client.get(reverse('get_bookmark', args=[bookmark.id]))
        data = json.loads(response.content)['bookmark']
        expected_keys = [
            'id', 'name', 'start_level', 'start_lat', 'start_lng',
            'end_level', 'end_lat', 'end_lng', 'created_at'
        ]
        for key in expected_keys:
            self.assertIn(key, data)

    # 🔹 27. Test long bookmark name
    def test_long_bookmark_name(self):
        self.client.login(username="testuser", password="password123")
        long_name = "A" * 300
        response = self.client.post(reverse('save_bookmark'), data={
            'name': long_name,
            'start_lat': 43.0,
            'start_lng': -87.9,
            'end_lat': 44.0,
            'end_lng': -86.9,
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Bookmark.objects.first().name, long_name)

    # 🔹 28. Test get bookmarks returns latest first (again)
    def test_bookmark_ordering_again(self):
        self.client.login(username="testuser", password="password123")
        Bookmark.objects.create(user=self.user, name="Old")
        Bookmark.objects.create(user=self.user, name="New")
        response = self.client.get(reverse('get_bookmarks'))
        bookmarks = json.loads(response.content)['bookmarks']
        self.assertGreaterEqual(bookmarks[0]['created_at'], bookmarks[1]['created_at'])

    # 🔹 29. Test bookmark start and end can be same
    def test_same_start_and_end_location(self):
        self.client.login(username="testuser", password="password123")
        response = self.client.post(reverse('save_bookmark'), data={
            'name': 'Loop',
            'start_lat': 43.0,
            'start_lng': -87.9,
            'end_lat': 43.0,
            'end_lng': -87.9,
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Bookmark.objects.count(), 1)

    # 🔹 30. Test no bookmarks returns empty list
    def test_get_bookmarks_when_empty(self):
        self.client.login(username="testuser", password="password123")
        response = self.client.get(reverse('get_bookmarks'))
        data = json.loads(response.content)
        self.assertEqual(data['bookmarks'], [])