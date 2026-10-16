import { fileURLToPath } from "node:url";
import createNextIntlPlugin from "next-intl/plugin";
const config = {
  agentRules: false,
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  poweredByHeader: false,
  skipProxyUrlNormalize: true,
  // Runtime data is mounted separately and must never enter deployment traces.
  outputFileTracingExcludes: {
    "/*": ["./data/**/*", "./docs/local/**/*", "./artifacts/**/*", "./.env*"],
  },
  async headers() {
    return [{source: '/:path*', headers: [
      {key: 'Content-Security-Policy', value: "img-src 'self' data: https:; object-src 'none'; base-uri 'self'"},
      {key: 'X-Content-Type-Options', value: 'nosniff'},
      {key: 'Referrer-Policy', value: 'no-referrer'},
    ]}];
  },
  async rewrites() {
    return process.env.NODE_ENV === "development"
      ? [
          {
            source: "/api/:path*",
            destination: "http://127.0.0.1:3001/api/:path*",
          },
        ]
      : [];
  },
};
export default createNextIntlPlugin("./i18n/request.ts")(config);
