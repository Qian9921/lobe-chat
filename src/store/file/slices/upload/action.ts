import { t } from 'i18next';
import { sha256 } from 'js-sha256';
import { StateCreator } from 'zustand/vanilla';

import { message } from '@/components/AntdStaticMethods';
import { LOBE_CHAT_CLOUD } from '@/const/branding';
import { isServerMode } from '@/const/version';
import { fileService } from '@/services/file';
import { uploadService } from '@/services/upload';
import { FileMetadata, UploadFileItem } from '@/types/files';

import { FileStore } from '../../store';

type OnStatusUpdate = (
  data:
    | {
        id: string;
        type: 'updateFile';
        value: Partial<UploadFileItem>;
      }
    | {
        id: string;
        type: 'removeFile';
      },
) => void;

interface UploadWithProgressParams {
  file: File;
  knowledgeBaseId?: string;
  onStatusUpdate?: OnStatusUpdate;
  /**
   * Optional flag to indicate whether to skip the file type check.
   * When set to `true`, any file type checks will be bypassed.
   * Default is `false`, which means file type checks will be performed.
   */
  skipCheckFileType?: boolean;
}

interface UploadWithProgressResult {
  filename?: string;
  id: string;
  url: string;
}

/**
 * 检查Firebase存储是否可用
 */
const canUseFirebaseStorage = (): boolean => {
  return typeof window !== 'undefined' && 
    typeof uploadService.uploadWithFirebase === 'function' && 
    uploadService['canUseFirebaseStorage'] && 
    uploadService['canUseFirebaseStorage']();
};

export interface FileUploadAction {
  uploadBase64FileWithProgress: (
    base64: string,
    params?: {
      onStatusUpdate?: OnStatusUpdate;
    },
  ) => Promise<UploadWithProgressResult | undefined>;

  uploadWithProgress: (
    params: UploadWithProgressParams,
  ) => Promise<UploadWithProgressResult | undefined>;
}

export const createFileUploadSlice: StateCreator<
  FileStore,
  [['zustand/devtools', never]],
  [],
  FileUploadAction
> = () => ({
  uploadBase64FileWithProgress: async (base64) => {
    const { metadata, fileType, size, hash } = await uploadService.uploadBase64ToS3(base64);

    const res = await fileService.createFile({
      fileType,
      hash,
      metadata,
      name: metadata.filename,
      size: size,
      url: metadata.path,
    });
    return { ...res, filename: metadata.filename };
  },
  uploadWithProgress: async ({ file, onStatusUpdate, knowledgeBaseId, skipCheckFileType }) => {
    const fileArrayBuffer = await file.arrayBuffer();

    // 1. check file hash
    const hash = sha256(fileArrayBuffer);

    const checkStatus = await fileService.checkFileHash(hash);
    let metadata: FileMetadata;

    // 2. if file exist, just skip upload
    if (checkStatus.isExist) {
      metadata = checkStatus.metadata as FileMetadata;
      onStatusUpdate?.({
        id: file.name,
        type: 'updateFile',
        value: { status: 'processing', uploadState: { progress: 100, restTime: 0, speed: 0 } },
      });
    }
    // 2. if file don't exist, need upload files
    else {
      // if is server mode, upload using best available method
      if (isServerMode) {
        try {
          // 优先尝试使用Firebase客户端上传（避免Edge环境的限制）
          if (canUseFirebaseStorage()) {
            console.log('Action: 检测到Firebase可用，使用Firebase客户端上传');
            metadata = await uploadService.uploadWithFirebase(file, {
              onProgress: (status, upload) => {
                onStatusUpdate?.({
                  id: file.name,
                  type: 'updateFile',
                  value: { status: status === 'success' ? 'processing' : status, uploadState: upload },
                });
              },
            });
          } 
          // 回退到传统上传方法
          else {
            console.log('Action: Firebase不可用，使用传统上传方法');
            metadata = await uploadService.uploadWithProgress(file, {
              onProgress: (status, upload) => {
                onStatusUpdate?.({
                  id: file.name,
                  type: 'updateFile',
                  value: { status: status === 'success' ? 'processing' : status, uploadState: upload },
                });
              },
            });
          }
        } catch (error) {
          console.error('上传失败:', error);
          // 显示友好的错误信息
          message.error(
            error instanceof Error && error.message.includes('Edge Runtime')
              ? '上传失败: Edge运行时需要S3配置。请联系管理员配置S3或使用Firebase。'
              : '上传失败，请稍后重试',
          );
          
          onStatusUpdate?.({ id: file.name, type: 'removeFile' });
          return;
        }
      } else {
        if (!skipCheckFileType && !file.type.startsWith('image')) {
          onStatusUpdate?.({ id: file.name, type: 'removeFile' });
          message.info({
            content: t('upload.fileOnlySupportInServerMode', {
              cloud: LOBE_CHAT_CLOUD,
              ext: file.name.split('.').pop(),
              ns: 'error',
            }),
            duration: 5,
          });
          return;
        }

        metadata = await uploadService.uploadToClientS3(hash, file);
      }
    }

    const res = await fileService.createFile({
      fileType: file.type,
      hash,
      knowledgeBaseId,
      metadata,
      name: file.name,
      size: file.size,
      url: metadata.path,
    });

    onStatusUpdate?.({
      id: file.name,
      type: 'updateFile',
      value: { id: res.id, status: 'success' },
    });

    return { ...res, filename: file.name };
  },
});
