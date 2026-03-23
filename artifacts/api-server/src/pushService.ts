export async function sendExpoPush(
  token: string | null | undefined,
  title: string,
  body: string
): Promise<void> {
  if (!token) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ to: token, sound: "default", title, body }),
    });
  } catch (err) {
    console.error("Push notification error:", err);
  }
}
