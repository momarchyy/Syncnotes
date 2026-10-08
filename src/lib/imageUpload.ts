import imageCompression from 'browser-image-compression';
import { supabase } from './supabase';

export interface ImageUploadOptions {
  file: File;
  noteId: string;
  ownerId: string;
}

export interface ImageUploadResult {
  path: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
}

/**
 * Compresses an image client-side to WebP (max 1600px width/height, ~0.8 quality),
 * uploads it to Supabase Storage 'note-files' at {owner_id}/{note_id}/{uuid}.webp,
 * and records a row in the 'attachments' database table.
 */
export async function uploadNoteImage({
  file,
  noteId,
  ownerId,
}: ImageUploadOptions): Promise<ImageUploadResult> {
  // 1. Client-side compression
  const compressionOptions = {
    maxWidthOrHeight: 1600,
    fileType: 'image/webp',
    initialQuality: 0.8,
    useWebWorker: true,
  };

  let processedFile: File;
  try {
    // If it's an animated gif or svg, don't compress to keep animation/vector, otherwise compress to WebP
    if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
      processedFile = file;
    } else {
      const compressedBlob = await imageCompression(file, compressionOptions);
      processedFile = new File(
        [compressedBlob],
        file.name.replace(/\.[^/.]+$/, '') + '.webp',
        { type: 'image/webp' }
      );
    }
  } catch (err) {
    console.warn('Image compression fallback to original file:', err);
    processedFile = file;
  }

  // 2. Build storage path: {owner_id}/{note_id}/{uuid}.webp
  const fileExt = processedFile.type === 'image/gif' ? 'gif' : 'webp';
  const fileId = crypto.randomUUID();
  const storagePath = `${ownerId}/${noteId}/${fileId}.${fileExt}`;

  // 3. Upload to Supabase Storage 'note-files'
  const { error: uploadError } = await supabase.storage
    .from('note-files')
    .upload(storagePath, processedFile, {
      contentType: processedFile.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload image: ${uploadError.message}`);
  }

  // 4. Insert row into 'attachments' table
  const { error: dbError } = await supabase.from('attachments').insert({
    note_id: noteId,
    uploader_id: ownerId,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: processedFile.type,
    size_bytes: processedFile.size,
  });

  if (dbError) {
    // If DB insert fails, cleanup the uploaded file to avoid orphan objects
    await supabase.storage.from('note-files').remove([storagePath]);
    throw new Error(`Failed to record attachment: ${dbError.message}`);
  }

  return {
    path: storagePath,
    fileName: file.name,
    sizeBytes: processedFile.size,
    mimeType: processedFile.type,
  };
}
