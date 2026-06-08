// C:/Antigravity/strongerN/src/utils/googleDrive.ts
// Real client-side Google Drive API integrations using native fetch

export interface GoogleUserProfile {
  email: string;
  name: string;
  avatarUri?: string;
}

/**
 * Parses rich Google API error message.
 */
async function handleApiError(res: Response, prefix: string): Promise<never> {
  const errorText = await res.text();
  console.error(`[Google API Error] ${prefix}:`, errorText);
  let errMsg = res.statusText || '';
  try {
    const parsed = JSON.parse(errorText);
    if (parsed.error && parsed.error.message) {
      errMsg = parsed.error.message;
    }
  } catch {}
  throw new Error(`${prefix}: ${errMsg || errorText || res.status}`);
}

/**
 * Fetch the authenticated user's profile info from Google OAuth2 UserInfo endpoint.
 */
export async function fetchUserProfile(token: string): Promise<GoogleUserProfile> {
  const res = await fetch('https://www.googleapis.com/userinfo/v2/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    await handleApiError(res, 'Failed to fetch user profile');
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
    await handleApiError(res, 'Failed to search Google Drive');
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
    await handleApiError(res, 'Failed to download backup');
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
    await handleApiError(res, 'Failed to create backup file in Google Drive');
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
    await handleApiError(res, 'Failed to update backup file in Google Drive');
  }

  return true;
}
