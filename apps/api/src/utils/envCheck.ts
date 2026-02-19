export function hasEnvVar(provider: string): boolean {
  switch (provider) {
    case 'openai':
      return !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-');
    case 'kimi':
      return !!process.env.KIMI_API_KEY && process.env.KIMI_API_KEY.length > 10;
    case 'claude':
      return !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-');
    default:
      return true;
  }
}
