export interface SessionTokens {
  userJwt?: string;
  instanceToken?: string;
}

export class AuthSessionStore {
  private tokens: SessionTokens = {};

  getTokens(): SessionTokens {
    return { ...this.tokens };
  }

  setTokens(tokens: SessionTokens): SessionTokens {
    this.tokens = { ...this.tokens, ...tokens };
    return this.getTokens();
  }

  clear(): void {
    this.tokens = {};
  }
}
