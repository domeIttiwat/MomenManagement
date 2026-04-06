import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import path from 'path';
import fs from 'fs';

function getAuth() {
  const keyFilePath = path.join(process.cwd(), 'service-account-key.json');

  if (fs.existsSync(keyFilePath)) {
    // Use key file directly (most reliable — avoids OpenSSL 3.0 parsing issues)
    return new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
  }

  // Fallback: parse from env var (GOOGLE_SERVICE_ACCOUNT_JSON must be full JSON string)
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (json) {
    return new google.auth.GoogleAuth({
      credentials: JSON.parse(json),
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
  }

  throw new Error('No Google credentials found. Add service-account-key.json or GOOGLE_SERVICE_ACCOUNT_JSON env var.');
}

function getRootFolderId() {
  const id = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!id) throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID is not set in .env.local');
  return id;
}

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    const auth = getAuth();
    const drive = google.drive({ version: 'v3', auth });

    if (action === 'find-or-create-root') {
      const folderId = getRootFolderId();
      return NextResponse.json({ folderId });
    }

    if (action === 'create-folder') {
      const body = await request.json();
      const { name, parentId } = body;
      const folder = await drive.files.create({
        requestBody: {
          name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId],
        },
        fields: 'id',
      });
      return NextResponse.json({ folderId: folder.data.id });
    }

    if (action === 'upload') {
      const formData = await request.formData();
      const file = formData.get('file');
      const folderId = formData.get('folderId');

      if (!file || !folderId) {
        return NextResponse.json({ error: 'Missing file or folderId' }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const stream = Readable.from(buffer);

      const uploadRes = await drive.files.create({
        requestBody: {
          name: file.name,
          parents: [folderId],
        },
        media: {
          mimeType: file.type || 'application/octet-stream',
          body: stream,
        },
        fields: 'id, name, size, mimeType, webViewLink, webContentLink',
      });

      // Make file publicly readable
      await drive.permissions.create({
        fileId: uploadRes.data.id,
        requestBody: { role: 'reader', type: 'anyone' },
      });

      const fileId = uploadRes.data.id;
      return NextResponse.json({
        fileId,
        viewUrl: `https://drive.google.com/file/d/${fileId}/view`,
        downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
        size: parseInt(uploadRes.data.size || 0),
        mimeType: uploadRes.data.mimeType,
        fileName: uploadRes.data.name,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Drive API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('fileId');

  if (!fileId) {
    return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
  }

  try {
    const auth = getAuth();
    const drive = google.drive({ version: 'v3', auth });
    await drive.files.delete({ fileId });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Drive delete error:', err);
    // Don't fail hard if file already deleted
    return NextResponse.json({ success: false, error: err.message });
  }
}
