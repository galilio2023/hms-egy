import { ETADocument, ETASubmissionResponse, ETATokenResponse } from "./types";

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

  async getToken(creds: ETACredentials): Promise<string> {
    const cacheKey = creds.clientId;
    const cached = this.tokenCache.get(cacheKey);
    
    if (cached && Date.now() < cached.expiry) {
      return cached.token;
    }

    // Handle race condition (Code Review #5A)
    if (this.pendingTokens.has(cacheKey)) {
      return this.pendingTokens.get(cacheKey)!;
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
        
        this.tokenCache.set(cacheKey, { token: data.access_token, expiry });
        return data.access_token;
      } finally {
        this.pendingTokens.delete(cacheKey);
      }
    })();

    this.pendingTokens.set(cacheKey, tokenPromise);
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

  async getDocument(uuid: string, creds: ETACredentials): Promise<any> {
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

  async cancelDocument(uuid: string, reason: string, creds: ETACredentials): Promise<any> {
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
}

export const etaClient = new ETAClient();
