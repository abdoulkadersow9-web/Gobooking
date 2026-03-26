import { Client } from "@replit/object-storage";

const client = new Client();

export async function uploadParcelPhoto(
  base64Data: string,
  parcelId: string,
): Promise<string | null> {
  try {
    const base64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
    const buffer = Buffer.from(base64, "base64");
    const objectKey = `parcels/${parcelId}/photo_${Date.now()}.jpg`;

    const { ok, error } = await client.uploadFromBuffer(objectKey, buffer, {
      contentType: "image/jpeg",
    });

    if (!ok) {
      console.error("Photo upload failed:", error);
      return null;
    }

    const { ok: urlOk, value: url } = await client.getSignedUrl(objectKey, { expiresIn: 60 * 60 * 24 * 365 });
    if (!urlOk || !url) {
      console.error("Photo URL generation failed");
      return null;
    }

    return url;
  } catch (err) {
    console.error("uploadParcelPhoto error:", err);
    return null;
  }
}
