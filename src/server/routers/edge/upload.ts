import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { fileEnv } from '@/config/file';
import { passwordProcedure, router } from '@/libs/trpc';
import { S3 } from '@/server/modules/S3';
import { Storage } from '@/server/modules/Storage';

// 判断是否在Edge Runtime环境
const isEdgeRuntime = () => {
  return typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'edge';
};

export const uploadRouter = router({
  createS3PreSignedUrl: passwordProcedure
    .input(z.object({ pathname: z.string() }))
    .mutation(async ({ input }) => {
      try {
        // 检查运行环境，输出详细日志
        const runtimeEnv = isEdgeRuntime() ? 'Edge Runtime' : 'Node.js';
        console.log(`[createS3PreSignedUrl] Running in ${runtimeEnv} environment`);
        console.log(`[createS3PreSignedUrl] Pathname: ${input.pathname}`);
        
        // 检查S3配置状态
        const hasS3Config = !!(fileEnv.S3_ACCESS_KEY_ID && fileEnv.S3_SECRET_ACCESS_KEY && fileEnv.S3_BUCKET);
        console.log(`[createS3PreSignedUrl] S3 configuration available: ${hasS3Config}`);
        
        // 在Edge环境中，必须使用S3，因为Firebase在Edge环境有兼容性问题
        if (isEdgeRuntime()) {
          console.log('[createS3PreSignedUrl] Edge Runtime detected, using S3 only');
          
          if (!hasS3Config) {
            console.error('[createS3PreSignedUrl] No S3 configuration in Edge Runtime');
            throw new Error('Edge Runtime requires S3 configuration. Firebase is not supported in Edge Runtime.');
          }
          
          const s3 = new S3();
          const url = await s3.createPreSignedUrl(input.pathname);
          console.log(`[createS3PreSignedUrl] Successfully created S3 URL in Edge Runtime`);
          return url;
        }
        
        // 非Edge环境下，可以使用Storage适配器（会自动选择合适的存储服务）
        console.log('[createS3PreSignedUrl] Using Storage adapter to select appropriate service');
        const storage = new Storage();
        const url = await storage.createPreSignedUrl(input.pathname);
        console.log(`[createS3PreSignedUrl] Successfully created URL with Storage adapter`);
        return url;
      } catch (error: any) {
        console.error('[createS3PreSignedUrl] Error creating pre-signed URL:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `创建上传URL失败: ${error.message || '请检查存储配置'}`,
          cause: error,
        });
      }
    }),
});

export type FileRouter = typeof uploadRouter;
