// waiters.js
export const waiters = new Map(); 
// paymentId -> { resolve, reject, timer }

export function isFinalForYourFront(status: string) {
  // você quer devolver somente approved/rejected pro front.
  // então aqui você mapeia qualquer final "não-approved" para "rejected"
  return (
    status === "approved" ||
    status === "rejected" ||
    status === "cancelled" ||
    status === "charged_back" ||
    status === "refunded"
  );
}

export function mapToFrontStatus(status: string) {
  return status === "approved" ? "approved" : "rejected";
}

export function waitPaymentFinal(paymentId: any, { timeoutMs = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters.delete(paymentId);
      reject(new Error("PAYMENT_TIMEOUT"));
    }, timeoutMs);

    waiters.set(paymentId, { resolve, reject, timer });
  });
}

export function resolveWaiter(paymentId: any, paymentObj: any) {
  const w = waiters.get(paymentId);
  if (!w) return false;
  clearTimeout(w.timer);
  waiters.delete(paymentId);
  w.resolve(paymentObj);
  return true;
}