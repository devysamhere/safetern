export function createEmbeddedDemoClient({ apiUrl, token, role }) {
  const base = String(apiUrl || "").replace(/\/$/, "");
  if (!base || !token) throw new Error("Demo session is not ready.");
  return {
    __safeternDemo: true,
    role,
    async writeContract({ functionName, args = [] }) {
      const response = await fetch(`${base}/demo/tx`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-safetern-demo-token": token },
        body: JSON.stringify({ role, functionName, args }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `Demo service returned ${response.status}`);
      return data.hash;
    },
    async waitForTransactionReceipt() { return null; },
  };
}
