const call = async () => {
  return {
    type: 'text',
    value: '🤝 Buddy mode activated! Your AI companion is ready.',
  }
}

const buddyCommand = {
  type: 'local',
  name: 'buddy',
  description: 'Enable AI companion mode',
  isEnabled: () => true,
  supportsNonInteractive: true,
  load: () => Promise.resolve({ call }),
}

export default buddyCommand