import { NextRequest, NextResponse } from "next/server";
import { onlinePayments, payments, invoices } from "@db/schema/billing";
import { eq } from "drizzle-orm";
import { withBypassContext, withTenantContext } from "@/lib/db/tenant";
import { getDecryptedPaymobCredentials } from "@/lib/db/paymob";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    // Consume request.text() to extract the raw body string to prevent any parsing/formatting discrepancies
    const rawBody = await req.text();
    if (!rawBody) {
      return NextResponse.json({ error: "Empty request body" }, { status: 400 });
    }

    // Protect against database lookup flooding by limiting request payload size
    if (rawBody.length > 500 * 1024) {
      return NextResponse.json({ error: "Payload too large" }, { status: 400 });
    }

    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    // DoS Protection: Ensure HMAC is present before doing any database queries
    const receivedHmac = req.nextUrl.searchParams.get("hmac") || body.hmac;
    if (!receivedHmac) {
      return NextResponse.json({ error: "Missing HMAC signature" }, { status: 401 });
    }

    // Paymob webhooks can be of different types. We only handle TRANSACTION.
    if (body.type !== "TRANSACTION") {
      return NextResponse.json({ received: true, message: "Ignored non-transaction event" });
    }

    const obj = body.obj;
    if (!obj) {
      return NextResponse.json({ error: "Missing transaction object (obj)" }, { status: 400 });
    }

    // Extract the Paymob Order ID to find the isolated tenant (hospital)
    const paymobOrderId = typeof obj.order === "object" && obj.order !== null ? obj.order.id : obj.order;
    if (!paymobOrderId) {
      return NextResponse.json({ error: "Missing Paymob Order ID" }, { status: 400 });
    }

    // Sanitize and validate that paymobOrderId is a positive integer to block SQL/NoSQL probing before DB lookup
    if (!/^\d+$/.test(String(paymobOrderId))) {
      return NextResponse.json({ error: "Invalid Paymob Order ID format" }, { status: 400 });
    }

    // Bypass RLS to fetch the online payment record and determine the associated hospital ID
    const paymentRecord = await withBypassContext(async (tx) => {
      const [record] = await tx
        .select({
          id: onlinePayments.id,
          hospitalId: onlinePayments.hospitalId,
          invoiceId: onlinePayments.invoiceId,
          patientId: onlinePayments.patientId,
          amount: onlinePayments.amount,
          status: onlinePayments.status,
        })
        .from(onlinePayments)
        .where(eq(onlinePayments.paymobOrderId, String(paymobOrderId)))
        .limit(1);
      return record;
    });

    if (!paymentRecord) {
      console.warn(`[PAYMOB_WEBHOOK] No online payment record found for Paymob Order ID: ${paymobOrderId}`);
      return NextResponse.json({ received: true, message: "No matching payment record found" });
    }

    // Safe Fail-Closed logic: If already processed and marked paid, return success immediately (Idempotency)
    if (paymentRecord.status === "paid") {
      return NextResponse.json({ received: true, message: "Payment already processed and marked paid" });
    }

    // Load and decrypt hospital's Paymob secrets
    const credentials = await getDecryptedPaymobCredentials(paymentRecord.hospitalId);
    if (!credentials.paymobHmacSecret) {
      console.error(`[PAYMOB_WEBHOOK] Paymob HMAC Secret is not configured for hospital: ${paymentRecord.hospitalId}`);
      return NextResponse.json({ error: "Hospital billing credentials not configured" }, { status: 400 });
    }

    // Define the strict HMAC SHA512 fields sequence prescribed by Paymob
    const fields = [
      "amount_cents",
      "created_at",
      "currency",
      "error_occured",
      "has_parent_transaction",
      "id",
      "integration_id",
      "is_3d_secure",
      "is_auth",
      "is_capture",
      "is_refunded",
      "is_standalone_payment",
      "is_voided",
      "order",
      "owner",
      "pending",
      "source_data.pan",
      "source_data.sub_type",
      "source_data.type",
      "success"
    ];

    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const getValue = (o: any, path: string): any => {
      if (path === "order") {
        if (typeof o?.order === "object" && o.order !== null) {
          return o.order.id;
        }
        return o?.order;
      }
      return path.split('.').reduce((prev, curr) => {
        if (prev === null || prev === undefined) return undefined;
        return prev[curr];
      }, o);
    };

    // Concatenate values in strict order as strings
    const stringToHash = fields.map(field => {
      const val = getValue(obj, field);
      return val !== undefined && val !== null ? String(val) : "";
    }).join('');

    // Generate expected HMAC-SHA512
    const calculatedHmac = crypto
      .createHmac("sha512", credentials.paymobHmacSecret)
      .update(stringToHash)
      .digest("hex");

    const calculatedBuf = Buffer.from(calculatedHmac, "hex");
    const receivedBuf = Buffer.from(receivedHmac, "hex");

    // Perform timing-safe equal to mitigate timing side-channel attacks
    if (calculatedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(calculatedBuf, receivedBuf)) {
      console.error(`[PAYMOB_WEBHOOK] Cryptographic signature check failed for hospital: ${paymentRecord.hospitalId}`);
      return NextResponse.json({ error: "Cryptographic signature mismatch" }, { status: 401 });
    }

    const success = String(obj.success) === "true";

    // Scope execution inside a tenant-isolated transaction context
    await withTenantContext(paymentRecord.hospitalId, async (tx) => {
      if (success) {
        // 1. Update online payment record status to paid
        await tx
          .update(onlinePayments)
          .set({
            status: "paid",
            paymobTransactionId: String(obj.id),
            callbackReceivedAt: new Date(),
            callbackPayload: obj,
            completedAt: new Date(),
          })
          .where(eq(onlinePayments.id, paymentRecord.id));

        // 2. Fetch invoice with pessimistic lock (FOR UPDATE) to prevent concurrency race conditions
        const [invoice] = await tx
          .select({
            id: invoices.id,
            totalAmount: invoices.totalAmount,
            amountPaid: invoices.amountPaid,
          })
          .from(invoices)
          .where(eq(invoices.id, paymentRecord.invoiceId))
          .for("update");

        if (invoice) {
          // 3. Register payment row
          await tx.insert(payments).values({
            hospitalId: paymentRecord.hospitalId,
            invoiceId: paymentRecord.invoiceId,
            patientId: paymentRecord.patientId,
            amount: paymentRecord.amount,
            paymentMethod: "online",
            transactionReference: String(obj.id),
            notes: `Paymob Transaction ID: ${obj.id}`,
            createdAt: new Date(),
          });

          // 4. Calculate aggregate paid volume and transition invoice status using integer cents math to avoid floating-point loss
          const currentPaidCents = Math.round(parseFloat(invoice.amountPaid) * 100);
          const paymentAmtCents = Math.round(parseFloat(paymentRecord.amount) * 100);
          const totalAmtCents = Math.round(parseFloat(invoice.totalAmount) * 100);
          
          const newPaidCents = Math.min(totalAmtCents, currentPaidCents + paymentAmtCents);
          const newPaid = (newPaidCents / 100).toFixed(2);
          
          const invoiceStatus = newPaidCents >= totalAmtCents ? "paid" : "partially_paid";

          await tx
            .update(invoices)
            .set({
              amountPaid: newPaid,
              status: invoiceStatus,
              updatedAt: new Date(),
            })
            .where(eq(invoices.id, invoice.id));
        }
      } else {
        // Record failure event logs
        await tx
          .update(onlinePayments)
          .set({
            status: "failed",
            paymobTransactionId: String(obj.id),
            callbackReceivedAt: new Date(),
            callbackPayload: obj,
            failureReason: obj?.data?.message || "Transaction failed",
          })
          .where(eq(onlinePayments.id, paymentRecord.id));
      }
    });

    console.log(`[PAYMOB_WEBHOOK] Securely processed payment for order ${paymobOrderId}. Success: ${success}`);
    return NextResponse.json({ received: true, success });
  } catch (error) {
    console.error("[PAYMOB_WEBHOOK] Unexpected runtime crash:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
