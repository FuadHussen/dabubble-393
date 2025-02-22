import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AvatarService {
  
  transformGooglePhotoUrl(url: string | undefined): string {
    if (!url) return '';
    
    // Ersetze die kleine Version (s96-c) durch eine größere (s400-c)
    return url.replace('s96-c', 's400-c');
  }

  isGoogleAvatar(avatarPath: string | undefined): boolean {
    if (!avatarPath) return false;
    return avatarPath.startsWith('http') || avatarPath.startsWith('https');
  }
} 