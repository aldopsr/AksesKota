export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data; // body error dari backend (mis. { fallback: true })
  }
}
