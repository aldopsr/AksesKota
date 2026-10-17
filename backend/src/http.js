// Error dengan status HTTP. Dilempar dari handler mana pun, ditangkap error handler di index.js.
// `extra` ikut dikirim di body respons (mis. { fallback: true } agar frontend beralih ke mode dasar).
export class HttpError extends Error {
  constructor(status, message, extra = undefined) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
