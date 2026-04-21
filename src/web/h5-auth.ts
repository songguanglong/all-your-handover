import type { Router, Request, Response } from 'express';
import { loadChannelsConfig } from '../services/config-service';
import { logger } from '../utils/logger';
import { createSessionToken } from '../utils/session-token';

interface FeishuUserInfo {
  open_id: string;
  name: string;
}

/**
 * Exchange Feishu JS-SDK auth_code for user info.
 * Uses the app's app_id and app_secret to call Feishu API.
 */
async function getFeishuUserInfo(authCode: string, appId: string, appSecret: string): Promise<FeishuUserInfo | null> {
  try {
    // Step 1: Get app_access_token
    const tokenUrl = 'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal';
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    });
    const tokenData = await tokenRes.json() as Record<string, unknown>;
    const appAccessToken = tokenData.app_access_token as string | undefined;
    if (!appAccessToken) {
      logger.error('Failed to get Feishu app_access_token');
      return null;
    }

    // Step 2: Get user info using auth_code
    const userUrl = 'https://open.feishu.cn/open-apis/authen/v1/user_access_token/internal';
    const userRes = await fetch(userUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appAccessToken}`,
      },
      body: JSON.stringify({ grant_type: 'authorization_code', code: authCode }),
    });
    const userData = await userRes.json() as Record<string, unknown>;
    const dataObj = userData.data as Record<string, unknown> | undefined;
    const userAccessToken = dataObj?.access_token as string | undefined;
    if (!userAccessToken) {
      logger.error('Failed to get Feishu user_access_token');
      return null;
    }

    // Step 3: Get user info
    const infoUrl = 'https://open.feishu.cn/open-apis/authen/v1/user_info';
    const infoRes = await fetch(infoUrl, {
      headers: { 'Authorization': `Bearer ${userAccessToken}` },
    });
    const infoData = await infoRes.json() as Record<string, unknown>;
    const infoObj = infoData.data as Record<string, unknown> | undefined;
    if (infoObj) {
      return {
        open_id: (infoObj.open_id as string) || (infoObj.user_id as string) || '',
        name: (infoObj.name as string) || (infoObj.user_id as string) || '',
      };
    }

    return null;
  } catch (err) {
    logger.error(`Feishu auth error: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

export function registerH5AuthRoutes(router: Router, prefix: string): void {
  // Feishu JS-SDK authentication
  router.get(`${prefix}/auth/feishu`, async (req: Request, res: Response) => {
    const authCode = req.query.code as string;
    if (!authCode) {
      return res.status(400).json({ code: -1, message: '缺少 auth_code 参数' });
    }

    const config = await loadChannelsConfig();
    const feishuConfig = config.platforms?.feishu;
    if (!feishuConfig) {
      return res.status(500).json({ code: -1, message: '飞书平台未配置' });
    }

    const userInfo = await getFeishuUserInfo(authCode, feishuConfig.appId, feishuConfig.appSecret);
    if (!userInfo) {
      return res.status(401).json({ code: -1, message: '飞书认证失败' });
    }

    const sessionToken = await createSessionToken(userInfo.open_id, userInfo.name);

    res.json({
      code: 0,
      data: {
        open_id: userInfo.open_id,
        name: userInfo.name,
        token: sessionToken,
      },
    });
  });
}