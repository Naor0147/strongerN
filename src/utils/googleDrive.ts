// C:/Antigravity/strongerN/src/utils/googleDrive.ts
// Real client-side Google Drive API integrations using native fetch

export interface GoogleUserProfile {
  email: string;
  name: string;
  avatarUri?: string;
}

/**
 * Fetch the authenticated user's profile info from Google OAuth2 UserInfo endpoint.
 */
export async function fetchUserProfile(token: string): Promise<GoogleUserProfile> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('[Google API] Userinfo failed:', errorText);
    throw new Error(`Failed to fetch user profile: ${res.statusText}`);
  }

  const data = await res.json();
  return {
    email: data.email,
    name: data.name || data.given_name || 'Google User',
    avatarUri: data.picture,
  };
}

/**
 * Searches for a file named "strongern_backup.json" in the user's Google Drive.
 * Returns the file ID if found, otherwise returns null.
 */
export async function findBackupFile(token: string): Promise<string | null> {
  const query = encodeURIComponent("name='strongern_backup.json' and trashed=false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('[Google API] Search files failed:', errorText);
    throw new Error(`Failed to search Google Drive: ${res.statusText}`);
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
}

/**
 * Downloads the content of a backup file from Google Drive by its file ID.
 */
export async function downloadBackupFile(token: string, fileId: string): Promise<any> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('[Google API] Download failed:', errorText);
    throw new Error(`Failed to download backup: ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Creates a new "strongern_backup.json" file in the user's Google Drive.
 * Returns the created file ID.
 */
export async function createBackupFile(token: string, data: any): Promise<string> {
  const boundary = 'strongern_multipart_boundary';
  
  const metadata = {
    name: 'strongern_backup.json',
    mimeType: 'application/json',
  };

  // Build a standard multipart/related request body to send metadata and file content in one call
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    JSON.stringify(data),
    `--${boundary}--`,
  ].join('\r\n');

  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('[Google API] File creation failed:', errorText);
    throw new Error(`Failed to create backup file in Google Drive: ${res.statusText}`);
  }

  const result = await res.json();
  return result.id;
}

/**
 * Updates the content of an existing backup file in Google Drive.
 */
export async function updateBackupFile(token: string, fileId: string, data: any): Promise<boolean> {
  const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('[Google API] File update failed:', errorText);
    throw new Error(`Failed to update backup file in Google Drive: ${res.statusText}`);
  }

  return true;
}
