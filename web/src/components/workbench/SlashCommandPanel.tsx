import type { SlashCommand } from '../../types/index.js'

type Props = {
  filteredCommands: SlashCommand[]
  highlightedIndex: number
  onSelect: (cmd: SlashCommand) => void
}

const COMMAND_ICONS: Record<string, string> = {
  '/help': 'help.svg',
  '/clear': 'refresh.svg',
  '/compact': 'arrow-minimize.svg',
  '/config': 'sliders.svg',
  '/cost': 'dollar.svg',
  '/doctor': 'bug.svg',
  '/init': 'gear.svg',
  '/login': 'log-out.svg',
  '/logout': 'log-out.svg',
  '/model': 'sparkles.svg',
  '/permissions': 'shield.svg',
  '/review': 'eye.svg',
  '/status': 'info-circle.svg',
  '/vim': 'type.svg',
}

export function SlashCommandPanel({ filteredCommands, highlightedIndex, onSelect }: Props) {
  return (
    <div className="cc-slash-panel is-visible">
      <div className="cc-slash-panel__header">
        <span style={{ fontSize: 'var(--body-xs-font-size)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          命令
        </span>
      </div>
      {filteredCommands.map((cmd, i) => (
        <div
          key={cmd.name}
          className={`cc-slash-panel__item${i === highlightedIndex ? ' is-highlighted' : ''}`}
          onClick={() => onSelect(cmd)}
        >
          <img src={`/assets/icons/${COMMAND_ICONS[cmd.name] ?? 'file-text.svg'}`} width={14} height={14} alt="" style={{ color: 'var(--icon-secondary)' }} />
          <div className="cc-slash-panel__info">
            <span className="cc-slash-panel__name">{cmd.name}</span>
            <span className="cc-slash-panel__desc">{cmd.description}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
