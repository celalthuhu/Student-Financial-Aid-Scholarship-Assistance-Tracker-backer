export const DOCUMENT_BUCKET = 'application-documents';
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
export const PAGE_SIZE = 10;
export const SIGNED_URL_SECONDS = 60;
export const APP_TIME_ZONE = process.env.NEXT_PUBLIC_APP_TIME_ZONE || 'Asia/Manila';
