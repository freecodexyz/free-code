// Torch command - enables enhanced reasoning mode
// Part of experimental feature TORCH
const call = async () => {
  return {
    type: 'text',
    value: '🔥 Torch ignited! Energy surge activated.',
  }
}

const torchCommand = {
  type: 'local',
  name: 'torch',
  description: 'Ignite the torch for enhanced reasoning',
  isEnabled: () => true,
  supportsNonInteractive: true,
  load: () => Promise.resolve({ call }),
}

export default torchCommand
