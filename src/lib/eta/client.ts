import { ETADocument, ETASubmissionResponse, ETATokenResponse, ETAReceipt } from "./types";
import redis from "@/lib/utils/redis";

const ETA_ENVIRONMENT = process.env.ETA_ENVIRONMENT || "sandbox";

const ID_URL = ETA_ENVIRONMENT === "production" 
  ? "https://id.eta.gov.eg" 
  : "https://id.preprod.eta.gov.eg";

const API_URL = ETA_ENVIRONMENT === "production"
  ? "https://api.invoicing.eta.gov.eg"
  : "https://api.preprod.invoicing.eta.gov.eg";

export interface ETACredentials {
  clientId: string;
  clientSecret: string;
}

export class ETAClient {
  private tokenCache: Map<string, { token: string; expiry: number }> = new Map();
  private pendingTokens: Map<string, Promise<string>> = new Map();

  /**
   * Fetches an access token from ETA, utilizing a distributed Redis cache
   * for serverless compatibility (Code Review #2).
   */
  async getToken(creds: ETACredentials): Promise<string> {
    const cacheKey = `eta_token:${creds.clientId}`;
    
    // 1. Check local in-memory cache first
    const localCached = this.tokenCache.get(creds.clientId);
    if (localCached && Date.now() < localCached.expiry) {
      return localCached.token;
    }

    // 2. Check distributed Redis cache (Code Review #2)
    if (redis) {
      try {
        const remoteToken = await redis.get<string>(cacheKey);
        if (remoteToken) {
          // Update local cache for next time
          const ttl = await redis.ttl(cacheKey);
          if (ttl > 60) {
            this.tokenCache.set(creds.clientId, { 
              token: remoteToken, 
              expiry: Date.now() + (ttl - 30) * 1000 
            });
            return remoteToken;
          }
        }
      } catch (err) {
        console.error("Redis token fetch failed:", err);
      }
    }

    // 3. Handle race condition (Code Review #5A)
    if (this.pendingTokens.has(creds.clientId)) {
      return this.pendingTokens.get(creds.clientId)!;
    }

    const tokenPromise = (async () => {
      try {
        const response = await fetch(`${ID_URL}/connect/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: creds.clientId,
            client_secret: creds.clientSecret,
            scope: "InvoicingAPI",
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Failed to get ETA token: ${response.statusText} - ${errorBody}`);
        }

        const data: ETATokenResponse = await response.json();
        const expiry = Date.now() + (data.expires_in - 60) * 1000;
        
        // Update caches
        this.tokenCache.set(creds.clientId, { token: data.access_token, expiry });
        
        if (redis) {
          try {
            await redis.set(cacheKey, data.access_token, { ex: data.expires_in - 30 });
          } catch (err) {
            console.error("Redis token save failed:", err);
          }
        }

        return data.access_token;
      } finally {
        this.pendingTokens.delete(creds.clientId);
      }
    })();

    this.pendingTokens.set(creds.clientId, tokenPromise);
    return tokenPromise;
  }

  async submitDocuments(documents: ETADocument[], creds: ETACredentials): Promise<ETASubmissionResponse> {
    const token = await this.getToken(creds);

    const response = await fetch(`${API_URL}/api/v1.0/documentsubmissions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ documents }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to submit documents to ETA: ${response.statusText} - ${errorBody}`);
    }

    return response.json();
  }

  async getDocument(uuid: string, creds: ETACredentials): Promise<unknown> {
    const token = await this.getToken(creds);

    const response = await fetch(`${API_URL}/api/v1.0/documents/${uuid}/details`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to get document from ETA: ${response.statusText} - ${errorBody}`);
    }

    return response.json();
  }

  async cancelDocument(uuid: string, reason: string, creds: ETACredentials): Promise<unknown> {
    const token = await this.getToken(creds);

    const response = await fetch(`${API_URL}/api/v1.0/documents/state/${uuid}/state`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "cancelled",
        reason: reason,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to cancel document in ETA: ${response.statusText} - ${errorBody}`);
    }

    return response.json();
  }

  async submitReceipts(receipts: ETAReceipt[], creds: ETACredentials): Promise<ETASubmissionResponse> {
    const token = await this.getToken(creds);

    const response = await fetch(`${API_URL}/api/v1.0/receiptssubmissions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ receipts }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to submit B2C receipts to ETA: ${response.statusText} - ${errorBody}`);
    }

    return response.json();
  }
}

export const etaClient = new ETAClient();
