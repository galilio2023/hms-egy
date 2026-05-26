import { ETADocument, ETASubmissionResponse, ETATokenResponse } from "./types";

const ETA_CLIENT_ID = process.env.ETA_CLIENT_ID;
const ETA_CLIENT_SECRET = process.env.ETA_CLIENT_SECRET;
const ETA_ENVIRONMENT = process.env.ETA_ENVIRONMENT || "sandbox";

const ID_URL = ETA_ENVIRONMENT === "production" 
  ? "https://id.eta.gov.eg" 
  : "https://id.preprod.eta.gov.eg";

const API_URL = ETA_ENVIRONMENT === "production"
  ? "https://api.invoicing.eta.gov.eg"
  : "https://api.preprod.invoicing.eta.gov.eg";

export class ETAClient {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!ETA_CLIENT_ID || !ETA_CLIENT_SECRET) {
      throw new Error("ETA credentials not configured");
    }

    const response = await fetch(`${ID_URL}/connect/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: ETA_CLIENT_ID,
        client_secret: ETA_CLIENT_SECRET,
        scope: "InvoicingAPI",
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to get ETA token: ${response.statusText} - ${errorBody}`);
    }

    const data: ETATokenResponse = await response.json();
    this.accessToken = data.access_token;
    // Set expiry 1 minute before actual expiry to be safe
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

    return this.accessToken;
  }

  async submitDocuments(documents: ETADocument[]): Promise<ETASubmissionResponse> {
    const token = await this.getToken();

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

  async getDocument(uuid: string): Promise<any> {
    const token = await this.getToken();

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

  async cancelDocument(uuid: string, reason: string): Promise<any> {
    const token = await this.getToken();

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
