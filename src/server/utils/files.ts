import urlJoin from 'url-join';
import { v4 as uuidv4 } from 'uuid';

import { fileEnv } from '@/config/file';
import { Storage } from '@/server/modules/Storage';

export const getFullFileUrl = async (url?: string | null, expiresIn?: number) => {
  if (!url) return '';

  // If bucket is not set public read, the preview address needs to be regenerated each time
  if (!fileEnv.S3_SET_ACL) {
    const storage = new Storage();
    return await storage.createPreSignedUrlForPreview(url, expiresIn);
  }

  if (fileEnv.S3_ENABLE_PATH_STYLE) {
    return urlJoin(fileEnv.S3_PUBLIC_DOMAIN!, fileEnv.S3_BUCKET!, url);
  }

  return urlJoin(fileEnv.S3_PUBLIC_DOMAIN!, url);
};
