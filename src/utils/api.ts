/**
 * This is the client-side entrypoint for your tRPC API. It is used to create the `api` object which
 * contains the Next.js App-wrapper, as well as your type-safe React Query hooks.
 *
 * We also create a few inference helpers for input and output types.
 */
import { httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCNext } from "@trpc/next";
import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";
import superjson from "superjson";

import { type AppRouter } from "~/server/api/root";

const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    // W przeglądarce używaj względnego URL (localhost)
    return "";
  }
  // Na serwerze używaj localhost bez sprawdzania zewnętrznych URL
  return `http://localhost:${process.env.PORT ?? 3000}`;
};

/** A set of type-safe react-query hooks for your tRPC API. */
export const api = createTRPCNext<AppRouter>({
  config() {
    return {
      /**
       * Transformer used for data de-serialization from the server.
       *
       * @see https://trpc.io/docs/data-transformers
       */
      transformer: superjson,

      /**
       * Links used to determine request flow from client to server.
       *
       * @see https://trpc.io/docs/links
       */
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === "development" ||
            (opts.direction === "down" && opts.result instanceof Error),
        }),
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          // Dodaj nagłówki dla pracy offline
          headers() {
            return {
              'x-trpc-source': 'nextjs-react',
            };
          },
          // Wydłuż timeout dla wolniejszych połączeń lokalnych
          fetch(url, options) {
            return fetch(url, {
              ...options,
              // Krótszy timeout dla lokalnych połączeń
              signal: AbortSignal.timeout(10000),
            });
          },
        }),
      ],
      
      // Konfiguracja React Query dla pracy offline
      queryClientConfig: {
        defaultOptions: {
          queries: {
            // Krótszy czas retry dla lokalnych połączeń
            retry: 2,
            retryDelay: 1000,
            // Cache na dłużej
            staleTime: 30 * 1000, // 30 sekund
            cacheTime: 60 * 60 * 1000, // 1 godzina
            // Nie refetch automatycznie
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            refetchOnMount: false,
          },
          mutations: {
            retry: 1,
          },
        },
      },
    };
  },
  /**
   * Whether tRPC should await queries when server-side rendering pages.
   *
   * @see https://trpc.io/docs/nextjs#ssr-boolean-default-false
   */
  ssr: false,
});

/**
 * Inference helper for inputs.
 *
 * @example type HelloInput = RouterInputs['example']['hello']
 */
export type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helper for outputs.
 *
 * @example type HelloOutput = RouterOutputs['example']['hello']
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;