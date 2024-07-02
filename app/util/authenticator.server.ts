import { OAuth2Strategy } from "remix-auth-oauth2";

export const authenticator = new Authenticator<User>(sessionStorage);

authenticator.use(
  new OAuth2Strategy<User, { providers: "google" }, { id_token: string }>(
    {
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,

      authorizationEndpoint: "https://provider.com/oauth2/authorize",
      tokenEndpoint: "https://provider.com/oauth2/token",
      redirectURI: "https://example.app/auth/callback",

      tokenRevocationEndpoint: "https://provider.com/oauth2/revoke", // optional

      codeChallengeMethod: "S256", // optional
      scopes: ["openid", "email", "profile"], // optional

      authenticateWith: "request_body", // optional
    },
    async ({ tokens, profile, context, request }) => {
      // here you can use the params above to get the user and return it
      // what you do inside this and how you find the user is up to you
      return await getUser(tokens, profile, context, request);
    },
  ),
  // this is optional, but if you setup more than one OAuth2 instance you will
  // need to set a custom name to each one
  "provider-name",
);
