declare global {
  interface Window {
    FB: {
      init: (params: {
        appId: string
        autoLogAppEvents: boolean
        xfbml: boolean
        version: string
      }) => void
      login: (
        callback: (response: FBLoginResponse) => void,
        params: {
          config_id: string
          response_type: string
          override_default_response_type: boolean
          extras: {
            setup: Record<string, unknown>
            featureType: string
            sessionInfoVersion: string
          }
        },
      ) => void
    }
    fbAsyncInit: () => void
  }

  interface FBLoginResponse {
    authResponse?: {
      code: string
      [key: string]: unknown
    }
    status?: string
  }
}

export {}
