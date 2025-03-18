from django.db import models
from django.contrib.auth.models import User

class Bookmark(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="geobookmarks")
    name = models.CharField(max_length=30)
    start_level = models.IntegerField(default=0)
    start_lat = models.DecimalField(max_digits=9, decimal_places=6)
    start_lng = models.DecimalField(max_digits=9, decimal_places=6)
    end_level = models.IntegerField(default=0)
    end_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True)
    end_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'name'], 
                name="unique_bookmark_name_per_user"
            )
        ]

